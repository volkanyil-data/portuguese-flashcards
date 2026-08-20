import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
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
  const isCron = req.headers['x-vercel-cron'] === '1' || process.env.NODE_ENV === 'development';
  if (!isCron) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", 
      generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `Generate a single B1-B2 level Portuguese vocabulary word or short phrase commonly used in Brazil. 
    Return ONLY a JSON object with this exact structure:
    { "pt": "The Portuguese word", "en": "The English translation", "group": 100, "sentencePt": "A sample sentence using the word in Portuguese", "sentenceEn": "The English translation of the sample sentence" }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const wordData = JSON.parse(response.text());

    const wordId = `ai-${Date.now()}`;
    const wordPayload = {
      id: wordId,
      pt: wordData.pt,
      en: wordData.en,
      sentencePt: wordData.sentencePt,
      sentenceEn: wordData.sentenceEn,
      group: 100,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "daily_words", wordId), wordPayload);

    return res.status(200).json({ success: true, word: wordPayload });
  } catch (error) {
    console.error("Cron failed:", error);
    return res.status(500).json({ error: error.toString() });
  }
}
