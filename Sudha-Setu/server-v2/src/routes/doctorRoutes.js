import { Router } from 'express';

import {
  getDoctorQueue,
  getMyDoctorProfile,
  updateMyDoctorProfile,
} from '../controllers/doctorController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { isDoctor } from '../middlewares/roleMiddleware.js';

const router = Router();

router.use(protect);

router.get('/queue', authorize('doctor', 'support', 'admin'), getDoctorQueue);

router.get('/me/profile', isDoctor, getMyDoctorProfile);
router.patch('/me/profile', isDoctor, updateMyDoctorProfile);

export default router;
