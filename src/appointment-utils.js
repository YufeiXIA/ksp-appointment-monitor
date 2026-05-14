const DEFAULT_URL = 'https://telegov.egov.com/KSP/AppointmentWizard';
const DEFAULT_APPOINTMENT_TYPE = 'Driver License, CDL or Motorcycle Written (Permit) Test';
const DEFAULT_LOCATION = 'Louisville (Bowman) Regional Test Site-Written Test';

const REQUIRED_APPLICANT_FIELDS = [
  'FIRST_NAME',
  'LAST_NAME',
  'DATE_OF_BIRTH',
  'PHONE',
  'EMAIL',
];

const GENERIC_MATCH_TOKENS = new Set([
  'and',
  'for',
  'the',
  'check',
  'earliest',
  'availability',
  'regional',
  'test',
  'testing',
  'site',
  'written',
  'license',
  'driver',
  'drivers',
  'cdl',
  'permit',
  'motorcycle',
]);

function normalizeText(value) {
  return String(value || '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function textScore(candidate, target) {
  const normalizedCandidate = normalizeText(candidate);
  const normalizedTarget = normalizeText(target);

  if (!normalizedCandidate || !normalizedTarget) return 0;
  if (normalizedCandidate === normalizedTarget) return 100;
  if (normalizedCandidate.includes(normalizedTarget)) return 90;
  if (normalizedTarget.includes(normalizedCandidate)) return 70;

  const candidateTokens = new Set(normalizedCandidate.split(' '));
  const targetTokens = [...new Set(normalizedTarget.split(' '))];
  const distinctiveTargetTokens = targetTokens.filter((token) => !GENERIC_MATCH_TOKENS.has(token));
  const missingDistinctiveTokens = distinctiveTargetTokens.filter((token) => !candidateTokens.has(token));

  if (distinctiveTargetTokens.length && missingDistinctiveTokens.length) {
    return 0;
  }

  const matches = targetTokens.filter((token) => candidateTokens.has(token)).length;

  return matches / targetTokens.length;
}

function bestTextMatch(options, target) {
  let best = null;
  let bestScore = 0;

  for (const option of options) {
    const score = textScore(option, target);
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  }

  return bestScore >= 0.6 ? best : null;
}

function isLikelySlotText(value) {
  const text = String(value || '').trim();
  const normalized = normalizeText(text);

  if (!text || /^(continue|next|back|cancel|home|help)$/i.test(text)) return false;
  if (/back|cancel|administrator/.test(normalized)) return false;

  return /\b\d{1,2}:\d{2}\s*(AM|PM)?\b/i.test(text)
    || /\b(AM|PM)\b/i.test(text)
    || /\bavailable\b/i.test(text);
}

function isInPersonAppointmentActionText(value) {
  const normalized = normalizeText(value);
  return normalized === 'select in person appointment';
}

function getLocationAvailabilityStatus(bodyText, target) {
  const targetText = normalizeText(target);
  const lines = String(bodyText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const targetIndex = lines.findIndex((line) => {
    const normalizedLine = normalizeText(line);
    return normalizedLine
      && (normalizedLine === targetText
      || normalizedLine.includes(targetText)
      || targetText.includes(normalizedLine));
  });

  if (targetIndex === -1) return 'missing';

  const targetWindow = lines.slice(targetIndex, targetIndex + 10).join('\n');
  if (/no availability/i.test(targetWindow)) return 'unavailable';
  if (/check earliest availability|select in person appointment/i.test(targetWindow)) return 'available';

  return 'missing';
}

function escapePowerShellSingleQuotedString(value) {
  return String(value || '').replace(/'/g, "''");
}

function buildWindowsPopupCommand(message, title = 'KSP Appointment Alert') {
  const safeMessage = escapePowerShellSingleQuotedString(message);
  const safeTitle = escapePowerShellSingleQuotedString(title);

  return [
    'Add-Type -AssemblyName System.Windows.Forms;',
    `[System.Windows.Forms.MessageBox]::Show('${safeMessage}', '${safeTitle}', 'OK', 'Information')`,
  ].join(' ');
}

function boolFromEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
}

function numberFromEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envToConfig(env) {
  return {
    url: env.KSP_URL || DEFAULT_URL,
    appointmentTypeText: env.APPOINTMENT_TYPE_TEXT || DEFAULT_APPOINTMENT_TYPE,
    locationText: env.LOCATION_TEXT || DEFAULT_LOCATION,
    preferredDate: env.PREFERRED_DATE || '',
    pollSeconds: Math.max(60, numberFromEnv(env.POLL_SECONDS, 60)),
    headless: boolFromEnv(env.HEADLESS, false),
    slowMoMs: numberFromEnv(env.SLOW_MO_MS, 75),
    applicant: {
      FIRST_NAME: env.FIRST_NAME || '',
      MIDDLE_NAME: env.MIDDLE_NAME || '',
      LAST_NAME: env.LAST_NAME || '',
      DATE_OF_BIRTH: env.DATE_OF_BIRTH || '',
      PHONE: env.PHONE || '',
      EMAIL: env.EMAIL || '',
      ADDRESS: env.ADDRESS || '',
      CITY: env.CITY || '',
      STATE: env.STATE || 'KY',
      ZIP: env.ZIP || '',
      LICENSE_OR_PERMIT_NUMBER: env.LICENSE_OR_PERMIT_NUMBER || '',
    },
  };
}

function validateRequiredConfig(config) {
  return REQUIRED_APPLICANT_FIELDS.filter((field) => !config.applicant[field]);
}

module.exports = {
  DEFAULT_APPOINTMENT_TYPE,
  DEFAULT_LOCATION,
  DEFAULT_URL,
  REQUIRED_APPLICANT_FIELDS,
  bestTextMatch,
  buildWindowsPopupCommand,
  envToConfig,
  getLocationAvailabilityStatus,
  isInPersonAppointmentActionText,
  isLikelySlotText,
  normalizeText,
  validateRequiredConfig,
};
