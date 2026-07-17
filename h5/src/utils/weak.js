import { getProgress, saveProgress } from './progress.js';
import { normWord } from './srs.js';

export function addWeakWord(word, reason = 'quiz') {
  if (!word) return;
  const key = normWord(word);
  const progress = getProgress();
  if (!progress.weak) progress.weak = {};

  const existing = progress.weak[key];
  progress.weak[key] = {
    word,
    reason,
    count: (existing?.count || 0) + 1,
    addedAt: existing?.addedAt || new Date().toISOString(),
  };
  saveProgress(progress);
}

export function addWeakWords(words, reason = 'quiz') {
  for (const w of words) addWeakWord(w, reason);
}

export function removeWeakWord(word) {
  const key = normWord(word);
  const progress = getProgress();
  if (progress.weak?.[key]) {
    delete progress.weak[key];
    saveProgress(progress);
  }
}

export function getWeakWords(progress = getProgress()) {
  return Object.values(progress.weak || {}).sort(
    (a, b) => b.count - a.count || a.word.localeCompare(b.word)
  );
}

export function getWeakCount(progress = getProgress()) {
  return getWeakWords(progress).length;
}

export function clearWeakWords() {
  const progress = getProgress();
  progress.weak = {};
  saveProgress(progress);
}
