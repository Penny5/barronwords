import { getProgress, saveProgress } from './progress.js';
import { dateStr, addDays } from './date.js';

export const SRS_INTERVALS = [1, 3, 7, 14, 30, 60];

export function normWord(word) {
  return (word || '').toLowerCase().replace(/[^a-z]/g, '');
}

export function ensureWordInSrs(word) {
  if (!word) return;
  const key = normWord(word);
  const progress = getProgress();
  if (!progress.srs) progress.srs = {};
  if (!progress.srs[key]) {
    progress.srs[key] = {
      word,
      level: 0,
      nextReview: addDays(dateStr(), SRS_INTERVALS[0]),
      lastReview: null,
    };
    saveProgress(progress);
  }
}

export function registerLessonWords(words) {
  if (!words?.length) return;
  for (const w of words) {
    ensureWordInSrs(w.word || w);
  }
}

export function getDueWords(progress = getProgress()) {
  const today = dateStr();
  return Object.values(progress.srs || {})
    .filter((w) => w.nextReview <= today && w.level < 4)
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview) || a.level - b.level);
}

export function getDueCount(progress = getProgress()) {
  return getDueWords(progress).length;
}

export function rateWord(word, rating) {
  const key = normWord(word);
  const progress = getProgress();
  if (!progress.srs?.[key]) ensureWordInSrs(word);

  const entry = progress.srs[key];
  const today = dateStr();

  if (rating === 'know') {
    entry.level = Math.min(entry.level + 1, SRS_INTERVALS.length - 1);
    entry.nextReview = addDays(today, SRS_INTERVALS[entry.level]);
  } else if (rating === 'fuzzy') {
    entry.nextReview = addDays(today, 1);
  } else if (rating === 'dont_know') {
    entry.level = 0;
    entry.nextReview = today;
  }

  entry.lastReview = today;
  saveProgress(progress);
  return entry;
}
