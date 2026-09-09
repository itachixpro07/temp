import { Router } from 'express';

import { chat, getChatHistory } from '../controllers/aiController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.post('/chat', chat);
router.get('/chat/:chatId', getChatHistory);

export default router;
