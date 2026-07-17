import { toast } from '../../core/dom.js';
import { getCourseData, getQuizState } from '../../core/store.js';
import { markTask, tryCompleteDay } from '../../utils/progress.js';
import { gradeOneAnswer } from '../../utils/quiz.js';
import { addWeakWords } from '../../utils/weak.js';
import { findQuizItem, getItemResult, getQuizTotal } from './state.js';

export function checkQuizItem(s, qid) {
  if (getItemResult(s, qid) || s.submitted) return;

  const found = findQuizItem(s, qid);
  if (!found) return;

  const user = s.userAnswers[qid] ?? s.userAnswers[String(qid)] ?? '';
  if (found.mode === 'fill' && !String(user).trim()) return;
  if (found.mode === 'letter' && !user) return;

  const result = gradeOneAnswer(found.item, user, found.mode);
  if (!s.itemResults) s.itemResults = {};
  s.itemResults[qid] = result;

  if (!result.correct) addWeakForQuizItem(s, found);

  finalizeIfComplete(s);
}

function addWeakForQuizItem(s, found) {
  const { item } = found;
  const lesson = s.lesson;
  const words = [];

  if (lesson.type === 'lesson') {
    if (item.type === 'matching' && item.word) words.push(item.word);
    if (item.type === 'fillBlank' && item.answer) words.push(item.answer.split('|')[0].trim());
  } else if (lesson.type === 'review' || lesson.type === 'wordMatch' || lesson.type === 'partsOfSpeech') {
    if (item.word) words.push(item.word);
  } else if (lesson.type === 'sensible') {
    if (item.answer && item.answer !== 'yes' && item.answer !== 'no') words.push(item.answer);
  } else if (lesson.type === 'wordsearch' || lesson.type === 'headlines') {
    if (item.answer) words.push(item.answer);
  } else if (lesson.type === 'sentenceCompletion') {
    const matched = (item.choices || []).find((c) => c.key === item.answer);
    if (matched?.text) {
      matched.text.split(/[^a-zA-Z'-]+/).filter(Boolean).forEach((w) => words.push(w));
    }
  } else if (lesson.type === 'doubleDuty') {
    if (item.word) words.push(item.word);
  }

  if (words.length) addWeakWords(words, 'quiz');
}

function finalizeIfComplete(s) {
  const total = getQuizTotal(s);
  if (Object.keys(s.itemResults || {}).length < total) return;

  const score = Object.values(s.itemResults).filter((r) => r.correct).length;
  Object.assign(s, {
    submitted: true,
    results: { ...s.itemResults },
    score,
    total,
    scorePercent: total ? Math.round((score / total) * 100) : 0,
    passed: total > 0 && score >= total * 0.6,
  });

  if (s.passed) {
    markTask(s.week, s.day, 'quiz');
    const completed = tryCompleteDay(getCourseData(), s.week, s.day);
    toast(completed ? '今日任务全部完成！' : '练习已通过', 'success');
  }
}

export function getQuizFooterInner(s) {
  const total = getQuizTotal(s);
  if (total <= 0) return null;

  if (!s.submitted) {
    const checked = Object.keys(s.itemResults || {}).length;
    return `<div class="quiz-progress-hint">已判题 ${checked} / ${total} · 答完即反馈</div>`;
  }

  return `
    <div class="score-panel ${s.passed ? 'score-panel--pass' : 'score-panel--fail'}">
      <div class="score-panel__main">
        <span class="score-panel__score">${s.score}</span>
        <span class="score-panel__total">/ ${s.total}</span>
      </div>
      <div class="score-panel__pct">${s.scorePercent}%</div>
      <p class="score-panel__tip">${s.passed ? '做得好！今日已标记完成' : '正确率需达到 60%，再试一次'}</p>
    </div>
    ${
      s.passed
        ? '<button class="btn btn--primary btn--block" data-action="next-day">完成，进入下一天</button>'
        : '<button class="btn btn--ghost btn--block" data-action="retry">重新练习</button>'
    }`;
}

export function updateQuizFooter(s) {
  const footer = document.querySelector('.sticky-footer');
  const html = getQuizFooterInner(s);
  if (footer && html) footer.innerHTML = html;
}

export function updateQuizHint() {
  const s = getQuizState();
  if (!s) return;
  const total = getQuizTotal(s);
  const checked = Object.keys(s.itemResults || {}).length;
  const hint = document.querySelector('.quiz-progress-hint');
  if (hint) hint.textContent = `已判题 ${checked} / ${total} · 答完即反馈`;
}
