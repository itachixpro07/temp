import { Router } from 'express';

import {
  intakeCase,
  getCaseQueue,
  getCaseById,
  prescribeCase,
  getCasePDF,
} from '../controllers/caseController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { requireVerifiedDoctor } from '../middlewares/roleMiddleware.js';

const router = Router();

router.use(protect);

router.get('/queue', authorize('doctor', 'admin'), getCaseQueue);

router.post('/intake', authorize('patient'), intakeCase);

router.patch('/:id', authorize('doctor', 'admin'), requireVerifiedDoctor, prescribeCase);

router.get('/:id/pdf', getCasePDF);
router.get('/:id', getCaseById);

export default router;
