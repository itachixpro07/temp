import { authorize } from './authMiddleware.js';
import Doctor from '../models/Doctor.js';

export const isPatient = authorize('patient');
export const isDoctor = authorize('doctor');
export const isSupport = authorize('support');
export const isAdmin = authorize('admin');
export const isAmbulance = authorize('ambulance');

export const requireVerifiedDoctor = async (req, res, next) => {
  if (req.user.role !== 'doctor') return next();

  const doctor = await Doctor.findOne({ userId: req.user._id });
  if (!doctor || !doctor.verified) {
    return res.status(403).json({ message: 'Doctor account not yet verified' });
  }

  next();
};
