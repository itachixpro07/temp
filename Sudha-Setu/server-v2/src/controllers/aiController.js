import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import CaseSheet from '../models/CaseSheet.js';
import { sendChatMessage } from '../services/aiService.js';

const FALLBACK_REPLY =
  'I\'m sorry, the AI assistant is currently unavailable. Please try again later ' +
  'or consult a verified doctor for medical guidance.';

const MAX_MESSAGE_LENGTH = 2000;

export const chat = async (req, res, next) => {
  try {
    const { message, chatId, caseId } = req.body ?? {};

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'message (non-empty string) is required' });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res
        .status(400)
        .json({ message: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
    }

    let chatDoc;

    if (chatId) {
      if (!mongoose.isValidObjectId(chatId)) {
        return res.status(400).json({ message: 'Invalid chatId' });
      }
      chatDoc = await Chat.findOne({ _id: chatId, userId: req.user._id });
      if (!chatDoc) {
        return res.status(404).json({ message: 'Chat session not found' });
      }
    } else {
      let linkedCase;
      if (caseId !== undefined) {
        if (!mongoose.isValidObjectId(caseId)) {
          return res.status(400).json({ message: 'Invalid caseId' });
        }
        linkedCase = await CaseSheet.findById(caseId).select('patientId');
        if (!linkedCase) {
          return res.status(404).json({ message: 'Case sheet not found' });
        }
        const canAccessCase =
          String(linkedCase.patientId) === String(req.user._id) ||
          ['doctor', 'support', 'admin'].includes(req.user.role);
        if (!canAccessCase) {
          return res.status(403).json({ message: 'Forbidden: this case belongs to another patient' });
        }
      }

      chatDoc = await Chat.create({
        userId: req.user._id,
        caseId: linkedCase?._id,
        messages: [],
      });
    }

    const userMsg = { sender: 'user', content: message.trim(), timestamp: new Date() };
    chatDoc.messages.push(userMsg);

    const priorMessages = chatDoc.messages.slice(0, -1);

    let replyText = FALLBACK_REPLY;
    try {
      replyText = await sendChatMessage(priorMessages, message.trim());
    } catch (aiErr) {
      console.warn('[aiController] Gemini call failed:', aiErr.message);
    }

    const aiMsg = { sender: 'ai', content: replyText, timestamp: new Date() };
    chatDoc.messages.push(aiMsg);
    await chatDoc.save();

    res.status(200).json({
      reply: replyText,
      chatId: String(chatDoc._id),
      messageCount: chatDoc.messages.length,
    });
  } catch (err) {
    next(err);
  }
};

export const getChatHistory = async (req, res, next) => {
  try {
    const { chatId } = req.params;

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: 'Invalid chatId' });
    }

    const chatDoc = await Chat.findOne({ _id: chatId, userId: req.user._id });
    if (!chatDoc) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    res.json({
      chatId: String(chatDoc._id),
      caseId: chatDoc.caseId ?? null,
      messages: chatDoc.messages,
      messageCount: chatDoc.messages.length,
      createdAt: chatDoc.createdAt,
      updatedAt: chatDoc.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};
