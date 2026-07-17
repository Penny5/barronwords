import { getCourseData, getQuizState } from '../../core/store.js';
import { getProgress, getLesson } from '../../utils/progress.js';
import { shuffleArray } from '../../utils/course.js';
import { normalizeAnswer } from '../../utils/quiz.js';
import {
  REVIEW_IDIOM_START,
  sortReviewOptions,
  buildPhaseDefOptions,
} from './review-utils.js';

export function prepareQuizState() {
  const courseData = getCourseData();
  const progress = getProgress();
  const lesson = getLesson(courseData, progress.week, progress.day);
  if (!lesson) return null;

  const state = {
    week: progress.week,
    day: progress.day,
    lesson,
    userAnswers: {},
    itemResults: {},
    submitted: false,
    exercises: [],
    reviewItems: [],
    reviewOptions: [],
    reviewIndex: 0,
    reviewPhase: 'vocab',
    reviewDefFilter: 'all',
    vocabDefOptions: [],
    idiomDefOptions: [],
    choiceItems: [],
    idiomItems: [],
    wordsearchItems: [],
    headlineItems: [],
    completionItems: [],
    doubleDutyItems: [],
  };

  if (lesson.type === 'lesson') {
    state.exercises = (lesson.exercises || []).map((ex) =>
      ex.type === 'matching' ? { ...ex, shuffledOptions: shuffleArray(ex.options) } : ex
    );
  } else if (lesson.type === 'review') {
    const reviewWords = lesson.reviewWords || [];
    const allOptions = sortReviewOptions(lesson.reviewOptions || []);
    const vocabItems = reviewWords.filter((w) => w.id < REVIEW_IDIOM_START);
    const idiomItems = reviewWords.filter((w) => w.id >= REVIEW_IDIOM_START);
    state.reviewOptions = allOptions;
    state.reviewItems = reviewWords;
    state.vocabDefOptions = buildPhaseDefOptions(allOptions, vocabItems);
    state.idiomDefOptions = buildPhaseDefOptions(allOptions, idiomItems);
  } else if (lesson.type === 'wordMatch') {
    state.reviewItems = (lesson.reviewWords || []).map((w) => ({
      ...w,
      options: shuffleArray(lesson.reviewOptions || []),
    }));
  } else if (lesson.type === 'partsOfSpeech') {
    const options = shuffleArray((lesson.wordBank || []).map((w) => ({ key: w.key, text: w.word })));
    state.reviewItems = (lesson.questions || []).map((q) => ({
      ...q,
      word: q.text,
      options,
    }));
  } else if (lesson.type === 'sensible') {
    state.choiceItems = (lesson.choiceQuestions || []).map((q) => ({
      ...q,
      shuffledChoices: shuffleArray(q.choices),
    }));
    state.idiomItems = lesson.idiomQuestions || [];
  } else if (lesson.type === 'wordsearch') {
    state.wordsearchItems = lesson.clues || [];
  } else if (lesson.type === 'headlines') {
    state.headlineItems = lesson.questions || [];
  } else if (lesson.type === 'sentenceCompletion') {
    state.completionItems = (lesson.questions || []).map((q) => ({
      ...q,
      shuffledChoices: shuffleArray(q.choices || []),
    }));
  } else if (lesson.type === 'doubleDuty') {
    const yesWords = new Set(Object.values(lesson.answers || {}).map((w) => normalizeAnswer(w)));
    state.doubleDutyItems = (lesson.words || []).map((w) => ({
      id: w.id,
      word: w.word,
      answer: yesWords.has(normalizeAnswer(w.word)) ? 'yes' : 'no',
    }));
  }

  return state;
}

export function getQuizTotal(s) {
  if (!s?.lesson) return 0;
  switch (s.lesson.type) {
    case 'lesson':
      return s.exercises.length;
    case 'review':
    case 'wordMatch':
    case 'partsOfSpeech':
      return s.reviewItems.length;
    case 'sensible':
      return s.choiceItems.length + s.idiomItems.length;
    case 'wordsearch':
      return s.wordsearchItems.length;
    case 'headlines':
      return s.headlineItems.length;
    case 'sentenceCompletion':
      return s.completionItems.length;
    case 'doubleDuty':
      return s.doubleDutyItems.length;
    default:
      return 0;
  }
}

export function getItemResult(s, id) {
  if (!s) return null;
  return (
    s.itemResults?.[id] ??
    s.itemResults?.[String(id)] ??
    (s.submitted ? s.results?.[id] ?? s.results?.[String(id)] : null)
  );
}

export function isItemLocked(s, id) {
  return !!getItemResult(s, id);
}

export function findQuizItem(s, qid) {
  const id = Number(qid);
  const key = Number.isNaN(id) ? qid : id;
  const { lesson } = s;

  if (lesson.type === 'lesson') {
    const ex = s.exercises.find((e) => e.id === key);
    if (ex) return { item: ex, mode: ex.type === 'fillBlank' ? 'fill' : 'letter' };
  }
  if (lesson.type === 'review' || lesson.type === 'wordMatch' || lesson.type === 'partsOfSpeech') {
    const item = s.reviewItems.find((e) => e.id === key);
    if (item) return { item, mode: 'letter' };
  }
  if (lesson.type === 'sensible') {
    const choice = s.choiceItems.find((e) => e.id === key);
    if (choice) return { item: choice, mode: 'letter' };
    const idiom = s.idiomItems.find((e) => e.id === key);
    if (idiom) return { item: idiom, mode: 'letter' };
  }
  if (lesson.type === 'wordsearch') {
    const item = s.wordsearchItems.find((e) => e.id === key);
    if (item) return { item, mode: 'fill' };
  }
  if (lesson.type === 'headlines') {
    const item = s.headlineItems.find((e) => e.id === key);
    if (item) return { item, mode: 'fill' };
  }
  if (lesson.type === 'sentenceCompletion') {
    const item = s.completionItems.find((e) => e.id === key);
    if (item) return { item, mode: 'letter' };
  }
  if (lesson.type === 'doubleDuty') {
    const item = s.doubleDutyItems.find((e) => e.id === key);
    if (item) return { item, mode: 'letter' };
  }
  return null;
}

export function isQuizStateStale(state) {
  if (!state) return true;
  const progress = getProgress();
  const lesson = getLesson(getCourseData(), progress.week, progress.day);
  return state.week !== progress.week || state.day !== progress.day || state.lesson?.id !== lesson?.id;
}
