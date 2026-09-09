import { Router } from 'express';

import { getMyAmbulanceProfile } from '../controllers/ambulanceController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { isAmbulance } from '../middlewares/roleMiddleware.js';

const router = Router();

router.use(protect, isAmbulance);

router.get('/me/profile', getMyAmbulanceProfile);

export default router;
