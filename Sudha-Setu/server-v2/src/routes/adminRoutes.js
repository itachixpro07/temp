import { Router } from 'express';

import {
  createDoctor,
  verifyDoctor,
  createAmbulance,
  listDoctors,
  listAmbulances,
  listUsers,
  updateUserRole,
  getTelemetry,
} from '../controllers/adminController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/roleMiddleware.js';

const router = Router();

router.use(protect, isAdmin);

router.get('/telemetry', getTelemetry);

router.post('/doctors', createDoctor);
router.get('/doctors', listDoctors);
router.patch('/doctors/:id/verify', verifyDoctor);

router.post('/ambulances', createAmbulance);
router.get('/ambulances', listAmbulances);

router.get('/users', listUsers);
router.patch('/users/:id/role', updateUserRole);

export default router;
