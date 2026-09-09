import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-3.6-flash';

const SYSTEM_INSTRUCTION =
  'You are Sudha Setu AI, a medical triage and Ayurvedic wellness assistant ' +
  'built for the Ministry of Ayush. Offer helpful, empathetic, non-definitive guidance ' +
  'grounded in Ayurvedic principles. Always remind users to consult a verified doctor ' +
  'for diagnosis or prescriptions. Do not provide emergency medical advice — if a user ' +
  'describes a life-threatening situation, instruct them to call emergency services immediately.';

const buildHistory = (storedMessages) =>
  storedMessages.map((m) => ({
    role: m.sender === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

let _client = null;

const getClient = () => {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your_actual')) {
    return null;
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
};

export const sendChatMessage = async (storedMessages, userMessage) => {
  const client = getClient();

  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const priorHistory = buildHistory(storedMessages);

  const chat = client.chats.create({
    model: MODEL,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
    history: priorHistory,
  });

  const response = await chat.sendMessage({ message: userMessage });
  return response.text;
};
