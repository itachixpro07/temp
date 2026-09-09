import mongoose from 'mongoose';

export const DANGER_LEVELS = ['low', 'medium', 'high'];

const knowledgeBaseSchema = new mongoose.Schema(
  {
    keywordTriggers: {
      type: [String],
      required: true,
      index: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one keyword trigger is required',
      },
      
      set: (v) =>
        Array.isArray(v)
          ? v.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
          : v,
    },
    dangerClassification: {
      type: String,
      enum: DANGER_LEVELS,
      required: [true, 'dangerClassification is required'],
      index: true,
    },
    verifiedAdvice: {
      generalTips: { type: [String], default: [] },
      ayurvedicDietaryNotes: { type: [String], default: [] },
      safeRemedies: { type: [String], default: [] },
    },
    verifiedByDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

knowledgeBaseSchema.pre('validate', function requireVerifierForAdvice() {
  const advice = this.verifiedAdvice ?? {};
  const hasAdvice = ['generalTips', 'ayurvedicDietaryNotes', 'safeRemedies'].some(
    (key) => Array.isArray(advice[key]) && advice[key].length > 0
  );
  if (hasAdvice && !this.verifiedByDoctorId) {
    this.invalidate(
      'verifiedByDoctorId',
      'verifiedAdvice can only be stored with a verifying doctor'
    );
  }
});

const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema);

export default KnowledgeBase;
