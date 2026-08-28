import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";
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

// Loose match so "Dar um jeito" and "dar um jeito" count as the same word.
const normalize = (s) =>
  String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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

    // Two configs: creative for coming up with new vocabulary, near-deterministic
    // for the mechanical job of writing a sentence for a word we already have.
    const wordModel = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 1.4,
        topP: 0.95,
      }
    });
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 }
    });

    // Fetch existing words so we can tell Gemini to avoid repeats, and find the highest group in use
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

    // Words live in `words`, but deleting one there would make it eligible again.
    // `meta/generated` is an append-only log of every word we've ever generated,
    // so a word you delete never comes back.
    const historyRef = doc(db, "meta", "generated");
    const historySnap = await getDoc(historyRef);
    const history = (historySnap.exists() ? historySnap.data().words : null) || [];

    const known = [...existingWords, ...history].filter(Boolean);
    const seen = new Set(known.map(normalize));
    // Cap what we put in the prompt so it can't grow without bound; the local
    // dedupe below is the real guarantee.
    const AVOID_IN_PROMPT = 300;
    const avoidList = known.length > 0
      ? `\nDo NOT return any of these, they have all been used before: ${known.slice(-AVOID_IN_PROMPT).join(", ")}.`
      : "";

    // Nudge the model into a different corner of the vocabulary each run.
    const THEMES = [
      "work and office life", "emotions and reactions", "food and eating out",
      "travel and getting around", "friendship and social life", "money and shopping",
      "health and the body", "housing and daily chores", "arguments and disagreement",
      "plans, promises and time", "weather and nature", "technology and media",
      "studying and learning", "humour, slang and teasing",
    ];
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];

    const WORDS_PER_RUN = 3;
    const prompt = `Generate ${WORDS_PER_RUN} distinct Portuguese vocabulary words or short phrases commonly used in Brazil: 2 at B2 level and 1 at B1 level. Favour the B2 entries being genuinely B2 — idiomatic expressions, phrasal constructions, or less obvious vocabulary, not textbook basics.
Loosely theme this batch around: ${theme}.${avoidList}
Return ONLY a JSON array of ${WORDS_PER_RUN} objects with this exact structure:
[{ "pt": "The Portuguese word or phrase", "en": "The English translation" }]`;

    // The model doesn't always honour the avoid list — enforce it ourselves, and
    // ask again if it handed back words we already have.
    const fresh = [];
    let duplicatesRejected = 0;
    for (let attempt = 0; attempt < 2 && fresh.length < WORDS_PER_RUN; attempt++) {
      const result = await wordModel.generateContent(prompt);
      const parsedWords = JSON.parse((await result.response).text());
      const candidates = Array.isArray(parsedWords) ? parsedWords : (parsedWords.words || []);

      for (const w of candidates) {
        if (!w?.pt || !w.en) continue;
        const key = normalize(w.pt);
        if (seen.has(key)) { duplicatesRejected++; continue; }
        seen.add(key);
        fresh.push(w);
      }
    }
    fresh.length = Math.min(fresh.length, WORDS_PER_RUN);

    // Sentences are written by the low-temperature model — we want the new words
    // to be surprising, but their example sentences to be plain and correct.
    if (fresh.length > 0) {
      try {
        const sentencePrompt = `For each Portuguese flashcard word below, write a natural, everyday Brazilian Portuguese sentence using the word, plus its English translation.
Return ONLY a JSON array where each object is: { "id": "the same id", "sentencePt": "...", "sentenceEn": "..." }

Words:
${JSON.stringify(fresh.map((w, i) => ({ id: String(i), pt: w.pt, en: w.en })), null, 2)}`;

        const sRes = await model.generateContent(sentencePrompt);
        const sParsed = JSON.parse(sRes.response.text());
        const sList = Array.isArray(sParsed) ? sParsed : (sParsed.words || sParsed.sentences || []);
        for (const s of sList) {
          const i = Number(s?.id);
          if (!Number.isInteger(i) || !fresh[i] || !s.sentencePt) continue;
          fresh[i].sentencePt = s.sentencePt;
          fresh[i].sentenceEn = s.sentenceEn || null;
        }
      } catch (e) {
        // Words without a sentence get picked up by the backfill on the next run.
        console.error("Sentence generation failed:", e);
      }
    }

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

    const now = Date.now();
    const added = fresh.map((w, i) => {
      const wordId = `ai-${now + i}`;
      return {
        id: wordId,
        pt: w.pt,
        en: w.en,
        sentencePt: w.sentencePt || null,
        sentenceEn: w.sentenceEn || null,
        group: targetGroup,
        createdAt: new Date(now + i).toISOString(),
        source: "gemini",
      };
    });

    await Promise.all(added.map(w => setDoc(doc(db, "words", w.id), w)));

    // Fold everything currently in the deck into the log too, so deleting any
    // word — not just an AI-generated one — keeps it out of future batches.
    const nextHistory = [];
    const historySeen = new Set();
    for (const pt of [...history, ...existingWords, ...added.map(w => w.pt)]) {
      if (!pt) continue;
      const key = normalize(pt);
      if (historySeen.has(key)) continue;
      historySeen.add(key);
      nextHistory.push(pt);
    }
    await setDoc(historyRef, {
      words: nextHistory,
      updatedAt: new Date(now).toISOString(),
    }, { merge: true });

    return res.status(200).json({
      success: true,
      requested: WORDS_PER_RUN,
      added: added.length,
      words: added,
      duplicatesRejected,
      theme,
      sentencesBackfilled: backfilled,
      sentencesPending: Math.max(0, missingSentences.length - backfilled),
    });
  } catch (error) {
    console.error("Cron failed:", error);
    return res.status(500).json({ error: error.toString() });
  }
}
