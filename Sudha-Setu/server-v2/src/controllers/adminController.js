import mongoose from 'mongoose';

import User, { USER_ROLES } from '../models/User.js';
import Doctor from '../models/Doctor.js';
import Ambulance from '../models/Ambulance.js';
import CaseSheet, { CASE_STATUSES } from '../models/CaseSheet.js';
import KnowledgeBase, { DANGER_LEVELS } from '../models/KnowledgeBase.js';

const ROLES_WITHOUT_PROFILE = ['support', 'admin'];

export const createDoctor = async (req, res, next) => {
  try {
    const { userId, specialization, medicalRegistrationNumber, yearsOfExperience } = req.body ?? {};

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'A valid userId is required' });
    }
    if (!specialization || !medicalRegistrationNumber) {
      return res.status(400).json({
        message: 'specialization and medicalRegistrationNumber are required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existing = await Doctor.findOne({ userId });
    if (existing) {
      return res.status(400).json({ message: 'This user already has a doctor profile' });
    }

    const doctor = await Doctor.create({
      userId,
      specialization,
      medicalRegistrationNumber,
      yearsOfExperience,
    });

    user.role = 'doctor';
    await user.save({ validateBeforeSave: false });

    res.status(201).json({ doctor });
  } catch (err) {
    if (err.name === 'ValidationError' || err.code === 11000) {
      return res.status(400).json({ message: 'Validation failed', detail: err.message });
    }
    next(err);
  }
};

export const verifyDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid doctor id' });
    }

    const doctor = await Doctor.findByIdAndUpdate(id, { verified: true }, { new: true });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    res.json({ doctor });
  } catch (err) {
    next(err);
  }
};

export const createAmbulance = async (req, res, next) => {
  try {
    const { userId, vehicleNumber, stationName, serviceProvider } = req.body ?? {};

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'A valid userId is required' });
    }
    if (!vehicleNumber || !stationName) {
      return res.status(400).json({ message: 'vehicleNumber and stationName are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existing = await Ambulance.findOne({ userId });
    if (existing) {
      return res.status(400).json({ message: 'This user already has an ambulance profile' });
    }

    const ambulance = await Ambulance.create({
      userId,
      vehicleNumber,
      stationName,
      serviceProvider,
    });

    user.role = 'ambulance';
    await user.save({ validateBeforeSave: false });

    res.status(201).json({ ambulance });
  } catch (err) {
    if (err.name === 'ValidationError' || err.code === 11000) {
      return res.status(400).json({ message: 'Validation failed', detail: err.message });
    }
    next(err);
  }
};

export const listDoctors = async (req, res, next) => {
  try {
    const doctors = await Doctor.find().populate('userId', 'name email phone');
    res.json({ doctors });
  } catch (err) {
    next(err);
  }
};

export const listAmbulances = async (req, res, next) => {
  try {
    const ambulances = await Ambulance.find().populate('userId', 'name email phone');
    res.json({ ambulances });
  } catch (err) {
    next(err);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    const filter = {};

    if (role) {
      if (!USER_ROLES.includes(role)) {
        return res.status(400).json({ message: `role must be one of: ${USER_ROLES.join(', ')}` });
      }
      filter.role = role;
    }

    const users = await User.find(filter).select('-password -refreshToken');
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body ?? {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (!ROLES_WITHOUT_PROFILE.includes(role)) {
      return res.status(400).json({
        message: `This endpoint only sets role to one of: ${ROLES_WITHOUT_PROFILE.join(', ')}. Use POST /api/admin/doctors or POST /api/admin/ambulances to elevate to doctor or ambulance.`,
      });
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const getTelemetry = async (req, res, next) => {
  try {
    const [byStatus, byDanger, confidenceAgg, kbActiveCount, doctorVerifiedAgg] = await Promise.all([
      CaseSheet.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      CaseSheet.aggregate([{ $group: { _id: '$dangerLevel', count: { $sum: 1 } } }]),
      CaseSheet.aggregate([{ $group: { _id: null, avgConfidence: { $avg: '$confidenceScore' } } }]),
      KnowledgeBase.countDocuments({ active: true }),
      Doctor.aggregate([{ $group: { _id: '$verified', count: { $sum: 1 } } }]),
    ]);

    const casesByStatus = Object.fromEntries(CASE_STATUSES.map((s) => [s, 0]));
    byStatus.forEach((row) => {
      casesByStatus[row._id] = row.count;
    });

    const casesByDangerLevel = Object.fromEntries(DANGER_LEVELS.map((d) => [d, 0]));
    byDanger.forEach((row) => {
      casesByDangerLevel[row._id] = row.count;
    });

    const doctors = { verified: 0, unverified: 0 };
    doctorVerifiedAgg.forEach((row) => {
      if (row._id) doctors.verified = row.count;
      else doctors.unverified = row.count;
    });

    res.json({
      casesByStatus,
      casesByDangerLevel,
      averageConfidenceScore: confidenceAgg[0]?.avgConfidence ?? null,
      activeKnowledgeBaseRules: kbActiveCount,
      doctors,
    });
  } catch (err) {
    next(err);
  }
};
