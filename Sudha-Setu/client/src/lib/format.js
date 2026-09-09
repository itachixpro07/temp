// Presentation helpers for the backend's enum values.

// CaseSheet.status enum from server-v2/src/models/CaseSheet.js
const STATUS_LABELS = {
  resolved_selfcare: 'Self-care advice given',
  pending_doctor: 'Waiting for a doctor',
  in_consultation: 'With the doctor now',
  escalated_human: 'Passed to the support desk',
  emergency_alerted: 'Emergency alerted',
  pending_support: 'Waiting for the support desk',
  queued_for_doctor: 'In the doctor queue',
  completed: 'Completed',
};

export const statusLabel = (s) => STATUS_LABELS[s] || s || 'Unknown';

// KnowledgeBase.DANGER_LEVELS = ['low', 'medium', 'high']
export const TIER = {
  low: {
    label: 'Low concern',
    tone: 'text-tier-low',
    chip: 'bg-tier-low/10 text-tier-low ring-tier-low/25',
    dot: 'bg-tier-low',
  },
  medium: {
    label: 'Needs a doctor',
    tone: 'text-tier-med',
    chip: 'bg-tier-med/10 text-tier-med ring-tier-med/25',
    dot: 'bg-tier-med',
  },
  high: {
    label: 'Urgent',
    tone: 'text-tier-high',
    chip: 'bg-tier-high/10 text-tier-high ring-tier-high/25',
    dot: 'bg-tier-high',
  },
};

export const tier = (level) => TIER[level] || TIER.medium;

export const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const confidencePercent = (score) =>
  typeof score === 'number' ? `${Math.round(score * 100)}%` : null;
