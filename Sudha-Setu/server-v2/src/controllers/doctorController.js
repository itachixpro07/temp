import CaseSheet from '../models/CaseSheet.js';
import Doctor from '../models/Doctor.js';

const DANGER_SORT_WEIGHT = { high: 3, medium: 2, low: 1 };

export const getDoctorQueue = async (req, res, next) => {
  try {
    const { status, dangerLevel, mine } = req.query ?? {};

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

    const filter = {};

    if (status) {
      filter.status = { $in: String(status).split(',').map((s) => s.trim()) };
    } else {
      filter.status = { $in: ['pending_doctor', 'in_consultation', 'emergency_alerted', 'escalated_human', 'queued_for_doctor'] };
    }

    if (dangerLevel) {
      filter.dangerLevel = { $in: String(dangerLevel).split(',').map((s) => s.trim()) };
    }

    if (mine === 'true') {
      filter.assignedDoctorId = req.user._id;
    }

    const [cases, total] = await Promise.all([
      CaseSheet.aggregate([
        { $match: filter },
        { $addFields: { dangerRank: { $switch: {
          branches: Object.entries(DANGER_SORT_WEIGHT).map(([level, weight]) => ({
            case: { $eq: ['$dangerLevel', level] },
            then: weight,
          })),
          default: 0,
        } } } },
        { $sort: { dangerRank: -1, createdAt: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $lookup: {
          from: 'users',
          localField: 'patientId',
          foreignField: '_id',
          as: 'patient',
          pipeline: [{ $project: { name: 1, phone: 1, languagePreference: 1 } }],
        } },
        { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
        { $project: {
          patient: 1,
          assignedDoctorId: 1,
          dangerLevel: 1,
          status: 1,
          confidenceScore: 1,
          symptoms: 1,
          languageUsed: 1,
          location: 1,
          createdAt: 1,
          firstMessage: { $first: '$rawDialogue.message' },
        } },
      ]),
      CaseSheet.countDocuments(filter),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      cases,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyDoctorProfile = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id }).populate('userId', 'name email phone');
    if (!doctor) {
      return res.status(404).json({ message: 'No doctor profile found for this account' });
    }
    res.json({ doctor });
  } catch (err) {
    next(err);
  }
};

export const updateMyDoctorProfile = async (req, res, next) => {
  try {
    const { specialization, medicalRegistrationNumber, yearsOfExperience } = req.body ?? {};

    if (specialization !== undefined || medicalRegistrationNumber !== undefined) {
      return res.status(400).json({
        message: 'specialization and medicalRegistrationNumber are admin-controlled after verification and cannot be changed here',
      });
    }

    const doctor = await Doctor.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { yearsOfExperience } },
      { new: true, runValidators: true }
    );

    if (!doctor) {
      return res.status(404).json({ message: 'No doctor profile found for this account' });
    }

    res.json({ doctor });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation failed', detail: err.message });
    }
    next(err);
  }
};
