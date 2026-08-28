import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

const firebaseConfig = {
  apiKey: "AIzaSyCXDsCumpqmBbFtHk8cfLuU0OeTpfti0vM",
  authDomain: "portuguese-flashcards-8586a.firebaseapp.com",
  projectId: "portuguese-flashcards-8586a",
  storageBucket: "portuguese-flashcards-8586a.firebasestorage.app",
  messagingSenderId: "725114652321",
  appId: "1:725114652321:web:0bacea9ba59efedfc192e0",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(req, res) {
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    req.headers['user-agent']?.includes('vercel-cron') ||
    process.env.NODE_ENV === 'development';

  if (!isCron) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    // Fetch existing words so we can tell Gemini to avoid repeats, and find the highest group in use
    const { getDocs, collection } = await import("firebase/firestore");
    const existingSnap = await getDocs(collection(db, "words"));
    const existingWords = [];
    const wordGroups = [];
    const missingSentences = [];
    existingSnap.forEach(d => {
      const w = d.data();
      existingWords.push(w.pt);
      wordGroups.push(w.group);
      if (!w.sentencePt) missingSentences.push({ id: d.id, pt: w.pt, en: w.en });
    });

    // Backfill sample sentences for words added manually in the app (capped per run)
    const BACKFILL_LIMIT = 10;
    const toBackfill = missingSentences.slice(0, BACKFILL_LIMIT);
    let backfilled = 0;
    if (toBackfill.length > 0) {
      try {
        const backfillPrompt = `For each Portuguese flashcard word below, write a natural, everyday Brazilian Portuguese sentence using the word, plus its English translation.
Return ONLY a JSON array where each object is: { "id": "the same id", "sentencePt": "...", "sentenceEn": "..." }

Words:
${JSON.stringify(toBackfill, null, 2)}`;

        const bRes = await model.generateContent(backfillPrompt);
        const parsed = JSON.parse(bRes.response.text());
        const sentences = Array.isArray(parsed) ? parsed : (parsed.words || parsed.sentences || []);

        const writes = [];
        for (const s of sentences) {
          if (!s?.id || !s.sentencePt) continue;
          if (!toBackfill.some(w => w.id === s.id)) continue; // ignore ids we didn't ask about
          writes.push(setDoc(doc(db, "words", s.id), {
            sentencePt: s.sentencePt,
            sentenceEn: s.sentenceEn || null,
          }, { merge: true }));
        }
        await Promise.all(writes);
        backfilled = writes.length;
      } catch (e) {
        // A backfill failure shouldn't block the daily word
        console.error("Sentence backfill failed:", e);
      }
    }

    const avoidList = existingWords.length > 0
      ? `\nDo NOT use any of these words that already exist: ${existingWords.join(", ")}.`
      : "";

    const prompt = `Generate a single B1-B2 level Portuguese vocabulary word or short phrase commonly used in Brazil.${avoidList}
    Return ONLY a JSON object with this exact structure:
    { "pt": "The Portuguese word", "en": "The English translation", "sentencePt": "A sample sentence using the word in Portuguese", "sentenceEn": "The English translation of the sample sentence" }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const wordData = JSON.parse(response.text());

    // New AI words go to the group the user named "AI Created".
    // If no such group exists, fall back to the highest group number in use.
    const AI_GROUP_NAME = "ai created";
    const deckDoc = await getDoc(doc(db, "users", "my_deck"));
    const deckData = deckDoc.exists() ? deckDoc.data() : {};
    const customGroups = deckData.customGroups || [];
    const groupNames = deckData.groupNames || {};

    const namedEntry = Object.entries(groupNames)
      .find(([, name]) => String(name).trim().toLowerCase() === AI_GROUP_NAME);

    let targetGroup;
    if (namedEntry) {
      targetGroup = Number(namedEntry[0]);
    } else {
      const allNums = [...customGroups, ...wordGroups].filter(n => typeof n === "number");
      targetGroup = allNums.length > 0 ? Math.max(1, ...allNums) : 1;
    }

    const wordId = `ai-${Date.now()}`;
    const wordPayload = {
      id: wordId,
      pt: wordData.pt,
      en: wordData.en,
      sentencePt: wordData.sentencePt,
      sentenceEn: wordData.sentenceEn,
      group: targetGroup,
      createdAt: new Date().toISOString(),
      source: "gemini",
    };

    await setDoc(doc(db, "words", wordId), wordPayload);

    return res.status(200).json({
      success: true,
      word: wordPayload,
      sentencesBackfilled: backfilled,
      sentencesPending: Math.max(0, missingSentences.length - backfilled),
    });
  } catch (error) {
    console.error("Cron failed:", error);
    return res.status(500).json({ error: error.toString() });
  }
}
