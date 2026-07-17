import { escapeHtml } from '../../core/dom.js';
import { shuffleArray } from '../../utils/course.js';
import { normalizeAnswer } from '../../utils/quiz.js';

export const REVIEW_IDIOM_START = 21;

function itemResult(s, id) {
  if (!s) return null;
  return s.itemResults?.[id] ?? s.itemResults?.[String(id)] ?? null;
}

export function sortReviewOptions(options) {
  return [...options].sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

export function buildPhaseDefOptions(allOptions, phaseItems) {
  const answerKeys = new Set(phaseItems.map((i) => normalizeAnswer(i.answer)));
  return shuffleArray(allOptions.filter((o) => answerKeys.has(normalizeAnswer(o.key))));
}

export function isReviewIdiom(item) {
  return item.id >= REVIEW_IDIOM_START;
}

export function getReviewVocabItems(s) {
  return (s.reviewItems || []).filter((i) => !isReviewIdiom(i));
}

export function getReviewIdiomItems(s) {
  return (s.reviewItems || []).filter((i) => isReviewIdiom(i));
}

export function getReviewPhaseItems(s) {
  return s.reviewPhase === 'idiom' ? getReviewIdiomItems(s) : getReviewVocabItems(s);
}

export function countPhaseAnswered(s, phase) {
  const items = phase === 'idiom' ? getReviewIdiomItems(s) : getReviewVocabItems(s);
  return items.filter((i) => itemResult(s, i.id)).length;
}

export function setReviewPhase(s, phase) {
  s.reviewPhase = phase;
  const items = getReviewPhaseItems(s);
  const firstUnanswered = items.findIndex((i) => !itemResult(s, i.id));
  s.reviewIndex = firstUnanswered >= 0 ? firstUnanswered : 0;
}

export function getReviewOptions(s) {
  if (s.reviewOptions?.length) return s.reviewOptions;
  return sortReviewOptions(s.lesson?.reviewOptions || []);
}

export function getReviewPhaseOptions(s) {
  if (s.reviewPhase === 'idiom' && s.idiomDefOptions?.length) return s.idiomDefOptions;
  if (s.reviewPhase !== 'idiom' && s.vocabDefOptions?.length) return s.vocabDefOptions;
  const phaseItems = getReviewPhaseItems(s);
  const answerKeys = new Set(phaseItems.map((i) => normalizeAnswer(i.answer)));
  return getReviewOptions(s).filter((o) => answerKeys.has(normalizeAnswer(o.key)));
}

export function getVisibleDefOptions(s, currentItemId) {
  const options = getReviewPhaseOptions(s);
  if (s.reviewDefFilter !== 'available') return options;
  return options.filter((opt) => !isDefTakenByOther(s, opt.key, currentItemId));
}

export function getReviewDefinitionText(s, answerKey) {
  const opt = getReviewOptions(s).find((o) => normalizeAnswer(o.key) === normalizeAnswer(answerKey));
  return opt ? escapeHtml(opt.text) : escapeHtml(answerKey);
}

export function isDefTakenByOther(s, optKey, currentItemId) {
  const key = normalizeAnswer(optKey);
  for (const item of getReviewPhaseItems(s)) {
    if (String(item.id) === String(currentItemId)) continue;
    const r = itemResult(s, item.id);
    if (r?.correct && normalizeAnswer(item.answer) === key) return true;
  }
  return false;
}

export function defCardClass(opt, userAnswer, result, correctKey, s, currentItemId) {
  const locked = !!result;
  const selected = normalizeAnswer(userAnswer) === normalizeAnswer(opt.key);
  const isCorrect = normalizeAnswer(opt.key) === normalizeAnswer(correctKey);
  const taken = isDefTakenByOther(s, opt.key, currentItemId);

  if (locked) {
    if (isCorrect) return 'def-card def-card--correct';
    if (selected && !result.correct) return 'def-card def-card--wrong';
    if (taken) return 'def-card def-card--used';
    return 'def-card';
  }
  if (taken) return 'def-card def-card--used';
  return `def-card${selected ? ' def-card--on' : ''}`;
}

export function isDefOptionDisabled(opt, s, currentItemId, locked) {
  if (locked) return true;
  return isDefTakenByOther(s, opt.key, currentItemId);
}
