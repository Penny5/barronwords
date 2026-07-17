import { getProgress, getLesson, compareWeek, weekEquals, getOrderedWeeks } from './progress.js';
import { enrichWords } from './course.js';
import { normWord } from './srs.js';

function dedupeWords(words) {
  const seen = new Set();
  const out = [];
  for (const w of words) {
    const key = normWord(w.word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

export function getTodayWords(courseData, progress = getProgress()) {
  const lesson = getLesson(courseData, progress.week, progress.day);
  if (!lesson || lesson.type !== 'lesson' || !lesson.words?.length) return [];
  return enrichWords(lesson, courseData);
}

export function getWeekWords(courseData, week = getProgress().week) {
  const weekData = courseData.weeks.find((w) => weekEquals(w.week, week));
  if (!weekData) return [];

  const words = [];
  for (const day of weekData.days) {
    if (day.type === 'lesson' && day.words?.length) {
      words.push(...enrichWords(day, courseData));
    }
  }
  return dedupeWords(words);
}

export function getLearnedWords(courseData, progress = getProgress()) {
  const words = [];

  for (const weekData of getOrderedWeeks(courseData)) {
    if (compareWeek(weekData.week, progress.week) > 0) break;

    for (const day of weekData.days) {
      if (weekEquals(weekData.week, progress.week) && day.day > progress.day) continue;
      if (day.type === 'lesson' && day.words?.length) {
        words.push(...enrichWords(day, courseData));
      }
    }
  }

  return dedupeWords(words);
}

export const MEMORIZE_SCOPES = [
  { id: 'today', label: '今日新词', hint: '当前课程' },
  { id: 'week', label: '本周词汇', hint: '本周 Day 1–4' },
  { id: 'learned', label: '已学词汇', hint: '进度范围内' },
];

export function getWordsByScope(courseData, scope, progress = getProgress()) {
  if (scope === 'today') return getTodayWords(courseData, progress);
  if (scope === 'week') return getWeekWords(courseData, progress.week);
  return getLearnedWords(courseData, progress);
}
