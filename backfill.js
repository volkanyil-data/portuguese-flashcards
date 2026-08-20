import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const API_KEY = process.env.GEMINI_API_KEY.replace(/"/g, '');
const genAI = new GoogleGenerativeAI(API_KEY);

const MASTER_WORDS = [
  { id: "1", pt: "Mole", en: "Soft / easy / weak", group: 1 },
  { id: "2", pt: "Pingando", en: "Dripping", group: 1 },
  { id: "3", pt: "Cascavel", en: "Rattlesnake", group: 1 },
  { id: "4", pt: "Bater um papo", en: "Having a chat", group: 1 },
  { id: "5", pt: "Pretender", en: "To intend / to plan", group: 1 },
  { id: "6", pt: "Carimbado", en: "Stamped / certified", group: 1 },
  { id: "7", pt: "Por engano", en: "By mistake", group: 1 },
  { id: "8", pt: "Capoeira", en: "Brazilian martial art / dance", group: 1 },
  { id: "9", pt: "Encomenda", en: "Order / package", group: 1 },
  { id: "10", pt: "Calota", en: "Hubcap", group: 1 },
  { id: "11", pt: "Roda", en: "Wheel / circle / round", group: 1 },
  { id: "12", pt: "Cagando", en: "Taking a dump (vulgar/casual)", group: 1 },
  { id: "13", pt: "Fedondo", en: "Stinky / smelly", group: 1 },
  { id: "14", pt: "Sombra", en: "Shadow / shade", group: 1 },
  { id: "15", pt: "Recolher", en: "To collect / to gather", group: 1 },
  { id: "16", pt: "De propósito", en: "On purpose", group: 1 },
  { id: "17", pt: "Deapegando", en: "Letting it go / detaching", group: 1 },
  { id: "18", pt: "Bate-papo", en: "Chat / Q&A / casual talk", group: 1 },
  { id: "19", pt: "Encanador", en: "Plumber", group: 1 },
  { id: "20", pt: "Macho", en: "Male (as opposed to female)", group: 1 },
  { id: "21", pt: "Fêmea", en: "Female", group: 1 },
  { id: "22", pt: "Gavetas", en: "Drawers (furniture)", group: 1 },
  { id: "23", pt: "Gravar", en: "To record / to engrave", group: 1 },
  { id: "24", pt: "Gorjeta", en: "Tip (gratuity)", group: 1 },
  { id: "25", pt: "Aperta de mão", en: "Handshake", group: 1 },
  { id: "26", pt: "Pesadelo", en: "Nightmare", group: 1 },
  { id: "27", pt: "Apertar", en: "To tighten / to press / to click", group: 1 },
  { id: "28", pt: "Magoado", en: "Hurt", group: 2 },
  { id: "29", pt: "Desafiar", en: "To challenge / to defy", group: 2 },
  { id: "30", pt: "Prejudicar", en: "To harm / to damage / to jeopardize", group: 2 },
  { id: "31", pt: "Desabafar", en: "To vent / to open up / to let off steam", group: 2 },
  { id: "32", pt: "Apreciar", en: "To appreciate / to enjoy / to esteem", group: 2 },
  { id: "33", pt: "Enxergar", en: "To see / to perceive / to distinguish visually", group: 2 },
  { id: "34", pt: "Lidar", en: "To deal with / to cope with / to handle", group: 2 },
  { id: "35", pt: "Picar", en: "To chop / to sting / to stink", group: 2 },
  { id: "36", pt: "Desempenho", en: "Performance / throughput", group: 2 },
  { id: "37", pt: "Comprovar", en: "To prove / to verify / to confirm", group: 2 },
  { id: "38", pt: "Abordar", en: "To approach / to address / to tackle", group: 2 },
  { id: "39", pt: "A queda", en: "The drop / the fall", group: 2 },
  { id: "40", pt: "Surgir", en: "To arise / to appear / to emerge", group: 2 },
];

async function run() {
  console.log("Testing Gemini API... requesting 40 sample sentences.");
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `I have a list of Portuguese flashcard words. 
For each word, I want you to write a natural, everyday Brazilian Portuguese sentence using the word, and its English translation.
Return exactly a JSON array of objects. Each object should have:
- "id": The same ID as the input word
- "sentencePt": The Portuguese sentence
- "sentenceEn": The English translation

Here is the input array of words:
${JSON.stringify(MASTER_WORDS.map(w => ({ id: w.id, pt: w.pt })), null, 2)}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const sentences = JSON.parse(text);

    // Merge back into MASTER_WORDS
    const updatedWords = MASTER_WORDS.map(w => {
      const match = sentences.find(s => s.id === w.id);
      if (match) {
        return { ...w, sentencePt: match.sentencePt, sentenceEn: match.sentenceEn };
      }
      return w;
    });

    fs.writeFileSync('updated_words.json', JSON.stringify(updatedWords, null, 2));
    console.log("Successfully generated sentences! Wrote to updated_words.json");
  } catch (error) {
    console.error("Error calling Gemini API:", error);
  }
}

run();
