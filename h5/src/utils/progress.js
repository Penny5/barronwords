const STORAGE_KEY = 'barron_progress';

const DEFAULT_PROGRESS = {
  week: 1,
  day: 1,
  completedDays: [],
  tasks: {},
  srs: {},
  weak: {},
  lastStudyAt: null,
};

function dayKey(week, day) {
  return `w${week}-d${day}`;
}

export function getProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return { ...DEFAULT_PROGRESS };
    return {
      ...DEFAULT_PROGRESS,
      ...saved,
      srs: saved.srs || {},
      weak: saved.weak || {},
      tasks: saved.tasks || {},
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...progress, lastStudyAt: new Date().toISOString() })
  );
}

export function exportProgressJson() {
  return JSON.stringify(getProgress(), null, 2);
}

export function importProgressJson(json) {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object') throw new Error('无效的进度文件');
  saveProgress({
    ...DEFAULT_PROGRESS,
    ...data,
    srs: data.srs || {},
    weak: data.weak || {},
    tasks: data.tasks || {},
    completedDays: Array.isArray(data.completedDays) ? data.completedDays : [],
  });
}

export function markDayComplete(week, day) {
  const progress = getProgress();
  const key = dayKey(week, day);
  if (!progress.completedDays.includes(key)) {
    progress.completedDays.push(key);
  }
  saveProgress(progress);
  return progress;
}

export function weekOrderKey(week) {
  if (week === 'A') return 100;
  if (week === 'B') return 101;
  return Number(week) || 0;
}

export function compareWeek(a, b) {
  return weekOrderKey(a) - weekOrderKey(b);
}

export function getOrderedWeeks(courseData) {
  return [...courseData.weeks].sort((a, b) => compareWeek(a.week, b.week));
}

function getAdjacentWeek(courseData, week, direction) {
  const ordered = getOrderedWeeks(courseData);
  const idx = ordered.findIndex((w) => weekEquals(w.week, week));
  if (idx < 0) return null;
  return ordered[idx + direction] || null;
}

export function advanceToNextDay(courseData) {
  const progress = getProgress();
  const weekData = courseData.weeks.find((w) => weekEquals(w.week, progress.week));
  if (!weekData) return progress;

  const dayNums = weekData.days.map((d) => d.day).sort((a, b) => a - b);
  const currentIdx = dayNums.indexOf(progress.day);

  if (currentIdx >= 0 && currentIdx < dayNums.length - 1) {
    progress.day = dayNums[currentIdx + 1];
  } else {
    const nextWeek = getAdjacentWeek(courseData, progress.week, 1);
    if (nextWeek) {
      progress.week = nextWeek.week;
      progress.day = Math.min(...nextWeek.days.map((d) => d.day));
    }
  }

  saveProgress(progress);
  return progress;
}

export function goPrevDay(courseData) {
  const progress = getProgress();
  const weekData = courseData.weeks.find((w) => weekEquals(w.week, progress.week));
  if (!weekData) return progress;

  const dayNums = weekData.days.map((d) => d.day).sort((a, b) => a - b);
  const currentIdx = dayNums.indexOf(progress.day);

  if (currentIdx > 0) {
    progress.day = dayNums[currentIdx - 1];
  } else {
    const prevWeek = getAdjacentWeek(courseData, progress.week, -1);
    if (prevWeek) {
      progress.week = prevWeek.week;
      progress.day = Math.max(...prevWeek.days.map((d) => d.day));
    }
  }

  saveProgress(progress);
  return progress;
}

export function getLesson(courseData, week, day) {
  const weekData = courseData.weeks.find((w) => weekEquals(w.week, week));
  if (!weekData) return null;
  return weekData.days.find((d) => d.day === day) || null;
}

export function getDayLabel(lesson) {
  if (!lesson) return '';
  const typeMap = {
    lesson: '新词学习',
    review: '周复习',
    sensible: '辨析练习',
    wordsearch: '选词填空',
    wordMatch: '词义配对',
    headlines: '头条填空',
    doubleDuty: '一词多词性',
    partsOfSpeech: '词性辨析',
    sentenceCompletion: '句子填空',
  };
  return typeMap[lesson.type] || '学习';
}

export function getTotalDays(courseData) {
  return courseData.weeks.reduce((sum, w) => sum + w.days.length, 0);
}

export function getCompletedCount(progress) {
  return progress.completedDays.length;
}

export function getWeekCompletion(courseData, week, progress = getProgress()) {
  const weekData = courseData.weeks.find((w) => weekEquals(w.week, week));
  if (!weekData) return { completed: 0, total: 0 };
  const total = weekData.days.length;
  const completed = weekData.days.filter((d) =>
    progress.completedDays.includes(dayKey(week, d.day))
  ).length;
  return { completed, total };
}

export function formatWeekLabel(week) {
  if (week === 'A') return 'Bonus A';
  if (week === 'B') return 'Bonus B';
  return `Week ${week}`;
}

export function weekEquals(a, b) {
  return String(a) === String(b);
}

export function jumpToDay(week, day) {
  const progress = getProgress();
  progress.week = week;
  progress.day = day;
  saveProgress(progress);
  return progress;
}

export function isDayCompleted(week, day, progress = getProgress()) {
  return progress.completedDays.includes(dayKey(week, day));
}

export function getTasksForLesson(lesson) {
  if (!lesson) return [];
  if (lesson.type === 'lesson') {
    return [
      { id: 'passage', label: '词汇与短文', hint: '约 8 分钟', hash: '#learn' },
      { id: 'quiz', label: '完成练习', hint: '约 7 分钟', hash: '#quiz' },
    ];
  }
  if (lesson.type === 'wordsearch') {
    return [
      { id: 'passage', label: '阅读故事', hint: '约 10 分钟', hash: '#learn' },
      { id: 'quiz', label: '完成填空', hint: '约 10 分钟', hash: '#quiz' },
    ];
  }
  if (lesson.type === 'doubleDuty') {
    return [
      { id: 'words', label: '查看练习', hint: '约 15 分钟', hash: '#learn' },
      { id: 'quiz', label: '一词多词性', hint: '约 5 分钟', hash: '#quiz' },
    ];
  }
  return [
    { id: 'words', label: '查看内容', hint: '约 5 分钟', hash: '#learn' },
    { id: 'quiz', label: '完成练习', hint: '约 10 分钟', hash: '#quiz' },
  ];
}

export function getDayTasks(week, day, progress = getProgress()) {
  const key = dayKey(week, day);
  return progress.tasks[key] || { words: false, passage: false, quiz: false };
}

export function markTask(week, day, taskId) {
  const progress = getProgress();
  const key = dayKey(week, day);
  if (!progress.tasks[key]) {
    progress.tasks[key] = { words: false, passage: false, quiz: false };
  }
  progress.tasks[key][taskId] = true;
  saveProgress(progress);
  return progress;
}

export function tryCompleteDay(courseData, week, day, progress = getProgress()) {
  const lesson = getLesson(courseData, week, day);
  if (!lesson) return false;

  const required = getTasksForLesson(lesson);
  const done = getDayTasks(week, day, progress);
  const allDone = required.every((t) => done[t.id]);

  if (allDone && !isDayCompleted(week, day, progress)) {
    markDayComplete(week, day);
    return true;
  }
  return false;
}

export function getTaskProgress(week, day, lesson, progress = getProgress()) {
  const required = getTasksForLesson(lesson);
  const done = getDayTasks(week, day, progress);
  const completed = required.filter((t) => done[t.id]).length;
  return { completed, total: required.length, tasks: required, done };
}
