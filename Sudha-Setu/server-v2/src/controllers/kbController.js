import mongoose from 'mongoose';
import KnowledgeBase, { DANGER_LEVELS } from '../models/KnowledgeBase.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listRules = async (req, res, next) => {
  try {
    const { search, dangerLevel } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

    const filter = {};

    if (search) {
      filter.keywordTriggers = { $regex: escapeRegex(search.trim()), $options: 'i' };
    }

    if (dangerLevel && DANGER_LEVELS.includes(dangerLevel)) {
      filter.dangerClassification = dangerLevel;
    }

    filter.active = true;

    const [rules, total] = await Promise.all([
      KnowledgeBase.find(filter)
        .sort({ dangerClassification: 1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('verifiedByDoctorId', 'name role')
        .lean(),
      KnowledgeBase.countDocuments(filter),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      rules,
    });
  } catch (err) {
    next(err);
  }
};

export const getRuleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid rule id' });
    }

    const rule = await KnowledgeBase.findOne({ _id: id, active: true })
      .populate('verifiedByDoctorId', 'name role');

    if (!rule) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    res.json({ rule });
  } catch (err) {
    next(err);
  }
};

export const createRule = async (req, res, next) => {
  try {
    const {
      keywordTriggers,
      dangerClassification,
      verifiedAdvice,
      active,
    } = req.body ?? {};

    if (!keywordTriggers || !Array.isArray(keywordTriggers) || keywordTriggers.length === 0) {
      return res.status(400).json({ message: 'keywordTriggers (non-empty array) is required' });
    }

    if (!dangerClassification || !DANGER_LEVELS.includes(dangerClassification)) {
      return res.status(400).json({
        message: `dangerClassification is required and must be one of: ${DANGER_LEVELS.join(', ')}`,
      });
    }

    const rule = await KnowledgeBase.create({
      keywordTriggers,
      dangerClassification,
      verifiedAdvice: verifiedAdvice ?? {},
      
      verifiedByDoctorId: req.user._id,
      active: active !== false,
    });

    res.status(201).json({ rule });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed',
        errors: Object.fromEntries(
          Object.entries(err.errors).map(([field, e]) => [field, e.message])
        ),
      });
    }
    next(err);
  }
};

export const updateRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid rule id' });
    }

    const rule = await KnowledgeBase.findById(id);
    if (!rule) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    const {
      keywordTriggers,
      dangerClassification,
      verifiedAdvice,
      active,
    } = req.body ?? {};

    if (keywordTriggers !== undefined) rule.keywordTriggers = keywordTriggers;
    if (dangerClassification !== undefined) {
      if (!DANGER_LEVELS.includes(dangerClassification)) {
        return res.status(400).json({
          message: `dangerClassification must be one of: ${DANGER_LEVELS.join(', ')}`,
        });
      }
      rule.dangerClassification = dangerClassification;
    }
    if (verifiedAdvice !== undefined) rule.verifiedAdvice = verifiedAdvice;
    if (active !== undefined) rule.active = active;

    rule.verifiedByDoctorId = req.user._id;

    await rule.save();

    res.json({ rule });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed',
        errors: Object.fromEntries(
          Object.entries(err.errors).map(([field, e]) => [field, e.message])
        ),
      });
    }
    next(err);
  }
};

export const deleteRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid rule id' });
    }

    const rule = await KnowledgeBase.findByIdAndDelete(id);
    if (!rule) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    res.json({ message: 'Rule deleted', id });
  } catch (err) {
    next(err);
  }
};
