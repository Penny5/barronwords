import { escapeHtml } from '../core/dom.js';
import { getWordInfo } from './word.js';
import { jumpToDay } from './progress.js';

export function enrichWords(lesson, courseData) {
  if (!lesson || !lesson.words) return [];
  const translateCache = courseData?.translateCache || {};

  return lesson.words.map((w) => {
    const matchEx = (lesson.exercises || []).find(
      (e) => e.type === 'matching' && e.word && e.word.toLowerCase() === w.word.toLowerCase()
    );
    const definition = w.definition || (matchEx && matchEx.correctDefinition) || '';
    const definitionZh = w.definitionZh || translateCache[definition] || '';

    return {
      ...w,
      definition,
      definitionZh,
      examples: w.examples || [],
    };
  });
}

export function enrichIdiom(idiom, courseData) {
  if (!idiom) return null;
  const translateCache = courseData?.translateCache || {};
  return {
    ...idiom,
    meaningZh: idiom.meaningZh || translateCache[idiom.meaning] || '',
  };
}

export function enrichReviewWords(lesson, courseData) {
  const translateCache = courseData?.translateCache || {};
  const optionMap = Object.fromEntries((lesson.reviewOptions || []).map((o) => [o.key, o.text]));
  const weekLessons = (courseData.weeks.find((w) => w.week === lesson.week)?.days || []).filter(
    (d) => d.type === 'lesson'
  );

  function weekWordData(word) {
    for (const day of weekLessons) {
      const match = (day.words || []).find((w) => w.word.toLowerCase() === word.toLowerCase());
      if (match) return match;
    }
    return null;
  }

  return (lesson.reviewWords || []).map((rw) => {
    const info = getWordInfo(courseData, rw.word);
    const fromWeek = weekWordData(rw.word);
    const definition = info?.definition || fromWeek?.definition || optionMap[rw.answer] || '';
    const definitionZh = translateCache[definition] || info?.definitionZh || '';

    return {
      word: rw.word,
      phonetic: info?.phonetic || fromWeek?.phonetic || '',
      definition,
      definitionZh,
      examples: fromWeek?.examples || info?.examples || [],
      isIdiom: rw.id >= 21,
    };
  });
}

export function findLessonById(courseData, lessonId) {
  if (!courseData?.weeks || !lessonId) return null;
  const id = lessonId.toLowerCase();
  for (const week of courseData.weeks) {
    for (const day of week.days || []) {
      if (day.id?.toLowerCase() === id) {
        return { week: week.week, day: day.day, lesson: day };
      }
    }
  }
  return null;
}

export function navigateToLesson(courseData, lessonId) {
  const found = findLessonById(courseData, lessonId);
  if (!found) return null;
  jumpToDay(found.week, found.day);
  return found;
}

export function renderPassageHtml(passage, highlightWords) {
  if (!passage) return '';
  const words = (highlightWords || []).map((w) => w.replace(/ly$/, ''));
  if (!words.length) return escapeHtml(passage); // ponytail: 空词表时 ()\w* 在非单词字符处匹配空串、lastIndex 不前进 → 死循环
  const pattern = new RegExp(
    `(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}\\w*)`,
    'gi'
  );

  let html = '';
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(passage)) !== null) {
    if (match.index > lastIndex) {
      html += escapeHtml(passage.slice(lastIndex, match.index));
    }
    html += `<em class="highlight">${escapeHtml(match[0])}</em>`;
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < passage.length) {
    html += escapeHtml(passage.slice(lastIndex));
  }
  if (!html) html = escapeHtml(passage);
  return html;
}

const CLICK_HERE = 'click here';

export function renderFootnoteHtml(footnote) {
  if (!footnote?.text) return '';
  const links = footnote.links || [];
  let html = '';
  let remaining = footnote.text;
  let linkIdx = 0;

  while (linkIdx < links.length) {
    const pos = remaining.toLowerCase().indexOf(CLICK_HERE);
    if (pos < 0) break;
    html += escapeHtml(remaining.slice(0, pos));
    html += `<button type="button" class="cross-ref" data-target-id="${escapeHtml(links[linkIdx].targetId)}">${CLICK_HERE}</button>`;
    remaining = remaining.slice(pos + CLICK_HERE.length);
    linkIdx++;
  }
  html += escapeHtml(remaining);
  return html;
}

export function getPassageFootnotes(footnotes) {
  return (footnotes || []).filter((f) => f.placement === 'passage');
}

export function getExerciseFootnote(footnotes, exerciseId) {
  return (footnotes || []).find((f) => f.placement === 'exercise' && f.exerciseId === exerciseId) || null;
}

export function renderPassageBlock(passage, highlightWords, footnotes) {
  const notes = getPassageFootnotes(footnotes);
  const notesHtml = notes
    .map((f) => `<p class="passage-footnote">${renderFootnoteHtml(f)}</p>`)
    .join('');

  return `
    <div class="passage-card__en">${renderPassageHtml(passage, highlightWords)}</div>
    ${notesHtml ? `<div class="passage-footnotes">${notesHtml}</div>` : ''}`;
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
