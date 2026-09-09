import { Router } from 'express';

import {
  listRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
} from '../controllers/kbController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { requireVerifiedDoctor } from '../middlewares/roleMiddleware.js';

const router = Router();

router.get('/', listRules);
router.get('/:id', getRuleById);

router.post('/', protect, authorize('doctor', 'admin'), requireVerifiedDoctor, createRule);
router.put('/:id', protect, authorize('doctor', 'admin'), requireVerifiedDoctor, updateRule);
router.delete('/:id', protect, authorize('doctor', 'admin'), requireVerifiedDoctor, deleteRule);

export default router;
