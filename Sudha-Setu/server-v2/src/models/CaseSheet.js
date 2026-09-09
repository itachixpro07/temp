import mongoose from 'mongoose';
import { DANGER_LEVELS } from './KnowledgeBase.js';

export const CASE_STATUSES = [
  'resolved_selfcare',
  'pending_doctor',
  'in_consultation',
  'escalated_human',
  'emergency_alerted',
  
  'pending_support',
  'queued_for_doctor',
  'completed',
];

export const DIALOGUE_SENDERS = ['patient', 'bot', 'doctor', 'support'];

const dialogueTurnSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: DIALOGUE_SENDERS, required: true },
    message: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const symptomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true },
    duration: { type: String, trim: true },
    severity: { type: Number, min: 1, max: 10 },
  },
  { _id: false }
);

const ayurvedicMarkersSchema = new mongoose.Schema(
  {
    suspectedPrakriti: {
      type: String,
      enum: ['vata', 'pitta', 'kapha', 'vata-pitta', 'pitta-kapha', 'vata-kapha', 'tridosha', 'unknown'],
      default: 'unknown',
    },
    agniStatus: {
      type: String,
      enum: ['sama', 'vishama', 'tikshna', 'manda', 'unknown'],
      default: 'unknown',
    },
    dietHabits: { type: String, trim: true },
    sleepPattern: { type: String, trim: true },
  },
  { _id: false }
);

const prescriptionItemSchema = new mongoose.Schema(
  {
    medicineName: { type: String, required: true, trim: true },
    dosage: { type: String, trim: true },
    timing: { type: String, trim: true },
    duration: { type: String, trim: true },
    instructions: { type: String, trim: true },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    address: { type: String, trim: true },
  },
  { _id: false }
);

const caseSheetSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'patientId is required'],
      index: true,
    },
    assignedDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    languageUsed: { type: String, trim: true, lowercase: true, default: 'auto' },
    rawDialogue: { type: [dialogueTurnSchema], default: [] },
    symptoms: { type: [symptomSchema], default: [] },
    ayurvedicMarkers: { type: ayurvedicMarkersSchema, default: () => ({}) },
    dangerLevel: {
      type: String,
      enum: DANGER_LEVELS,
      required: [true, 'dangerLevel is required'],
      index: true,
    },
    
    confidenceScore: { type: Number, default: 1.0, min: 0, max: 1 },
    status: {
      type: String,
      enum: CASE_STATUSES,
      default: 'pending_doctor',
      index: true,
    },
    doctorNotes: { type: String, trim: true },
    prescription: { type: [prescriptionItemSchema], default: [] },
    location: { type: locationSchema, default: undefined },
  },
  { timestamps: true }
);

caseSheetSchema.index({ assignedDoctorId: 1, status: 1, createdAt: 1 });

caseSheetSchema.index({ patientId: 1, createdAt: -1 });

caseSheetSchema.pre('validate', function requireDoctorForPrescription() {
  if (this.prescription?.length > 0 && !this.assignedDoctorId) {
    this.invalidate(
      'assignedDoctorId',
      'A prescription requires an assigned doctor'
    );
  }
});

const CaseSheet = mongoose.model('CaseSheet', caseSheetSchema);

export default CaseSheet;
