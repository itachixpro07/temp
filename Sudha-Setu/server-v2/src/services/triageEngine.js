import KnowledgeBase, { DANGER_LEVELS } from '../models/KnowledgeBase.js';

const LEVEL_RANK = { low: 1, medium: 2, high: 3 };

export const LOW_CONFIDENCE_THRESHOLD = 0.55;

const NEGATION_CUES = [
  'no', 'not', 'never', 'without', 'denies', 'denied',
  'nahi', 'nahin', 'naa', 'नहीं', 'नही',
];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildMatcher = (keyword) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(keyword)}(?![\\p{L}\\p{N}])`, 'iu');

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round2 = (n) => Math.round(n * 100) / 100;

const isNegated = (text, matchIndex) => {
  const window = text.slice(Math.max(0, matchIndex - 40), matchIndex);
  return NEGATION_CUES.some((cue) => buildMatcher(cue).test(window));
};

export const analyzeSymptoms = async (patientText) => {
  const text = String(patientText ?? '').trim();

  if (!text) {
    return {
      dangerLevel: 'medium',
      confidenceScore: 0.1,
      verifiedAdvice: null,
      matchedKeywords: [],
      matchedRuleIds: [],
      requiresHumanReview: true,
      reason: 'empty_input',
    };
  }

  const rules = await KnowledgeBase.find({ active: true }).lean();

  const matches = [];
  for (const rule of rules) {
    const hits = [];
    let negatedHits = 0;

    for (const keyword of rule.keywordTriggers ?? []) {
      const found = buildMatcher(keyword).exec(text);
      if (!found) continue;
      if (isNegated(text, found.index)) {
        negatedHits += 1;
      } else {
        hits.push(keyword);
      }
    }

    if (hits.length > 0) {
      matches.push({ rule, hits, negatedHits });
    }
  }

  if (matches.length === 0) {
    
    return {
      dangerLevel: 'medium',
      confidenceScore: 0.25,
      verifiedAdvice: null,
      matchedKeywords: [],
      matchedRuleIds: [],
      requiresHumanReview: true,
      reason: 'no_rule_matched',
    };
  }

  const dangerLevel = matches.reduce(
    (worst, m) =>
      LEVEL_RANK[m.rule.dangerClassification] > LEVEL_RANK[worst]
        ? m.rule.dangerClassification
        : worst,
    'low'
  );

  const winning = matches.filter((m) => m.rule.dangerClassification === dangerLevel);
  const distinctHits = new Set(winning.flatMap((m) => m.hits)).size;
  const negated = winning.reduce((sum, m) => sum + m.negatedHits, 0);

  let confidence = 0.45 + 0.15 * distinctHits;

  const conflicting = new Set(matches.map((m) => m.rule.dangerClassification)).size - 1;
  if (conflicting > 0) confidence -= 0.1 * conflicting;

  if (negated > 0) confidence -= 0.15 * (negated / distinctHits);

  confidence = round2(clamp(confidence, 0.1, 0.95));

  const requiresHumanReview =
    dangerLevel !== 'low' || confidence < LOW_CONFIDENCE_THRESHOLD;

  let verifiedAdvice = null;
  if (dangerLevel === 'low' && confidence >= LOW_CONFIDENCE_THRESHOLD) {
    const merged = { generalTips: [], ayurvedicDietaryNotes: [], safeRemedies: [] };
    for (const m of winning) {
      
      if (!m.rule.verifiedByDoctorId) continue;
      for (const key of Object.keys(merged)) {
        merged[key].push(...(m.rule.verifiedAdvice?.[key] ?? []));
      }
    }
    for (const key of Object.keys(merged)) {
      merged[key] = [...new Set(merged[key])];
    }
    const hasAny = Object.values(merged).some((v) => v.length > 0);
    if (hasAny) verifiedAdvice = merged;
  }

  return {
    dangerLevel,
    confidenceScore: confidence,
    verifiedAdvice,
    matchedKeywords: [...new Set(winning.flatMap((m) => m.hits))],
    matchedRuleIds: winning.map((m) => String(m.rule._id)),
    requiresHumanReview,
    reason: 'rule_matched',
  };
};

export const statusForAssessment = ({ dangerLevel, confidenceScore, verifiedAdvice }) => {
  if (dangerLevel === 'high') return 'emergency_alerted';
  if (dangerLevel === 'medium') return 'pending_doctor';
  
  if (confidenceScore >= LOW_CONFIDENCE_THRESHOLD && verifiedAdvice) {
    return 'resolved_selfcare';
  }
  return 'pending_doctor';
};

export { DANGER_LEVELS };
