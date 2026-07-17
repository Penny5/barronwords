import { escapeHtml } from '../../core/dom.js';
import { normalizeAnswer } from '../../utils/quiz.js';
import { getExerciseFootnote, renderFootnoteHtml } from '../../utils/course.js';
import { findQuizItem, getItemResult, isItemLocked } from './state.js';
import { renderReviewMatchCard } from './review-match.js';

export function optionBtnClass(opt, userAnswer, result, correctKey) {
  const locked = !!result;
  const selected = userAnswer === opt.key;
  const isCorrect = normalizeAnswer(opt.key) === normalizeAnswer(correctKey);
  if (locked) {
    if (isCorrect) return 'option-item option-item--correct';
    if (selected && !result.correct) return 'option-item option-item--wrong';
    return 'option-item';
  }
  return `option-item${selected ? ' option-item--on' : ''}`;
}

export function choiceBtnClass(value, userAnswer, result, correctAnswer) {
  const locked = !!result;
  const selected = userAnswer === value;
  const isCorrect = normalizeAnswer(value) === normalizeAnswer(correctAnswer);
  if (locked) {
    if (isCorrect) return 'choice-item choice-item--correct';
    if (selected && !result.correct) return 'choice-item choice-item--wrong';
    return 'choice-item';
  }
  return `choice-item${selected ? ' choice-item--on' : ''}`;
}

export function renderItemFeedback(result, correctLabel) {
  if (!result) return '';
  if (result.correct) {
    return `<div class="quiz-card__feedback quiz-card__feedback--ok">✓ 正确 · ${correctLabel}</div>`;
  }
  return `<div class="quiz-card__answer">正确：${correctLabel}</div>`;
}

export function renderFillQuestion(ex, s, lesson) {
  const result = getItemResult(s, ex.id);
  const locked = isItemLocked(s, ex.id);
  const cls = result ? (result.correct ? 'quiz-card--ok' : 'quiz-card--bad') : '';
  const userAnswers = s.userAnswers;
  const footnote = getExerciseFootnote(lesson?.footnotes, ex.id);
  const footnoteHtml = footnote
    ? `<p class="quiz-card__footnote">${renderFootnoteHtml(footnote)}</p>`
    : '';
  return `
    <div class="quiz-card ${cls}" data-qid="${ex.id}">
      <div class="quiz-card__num">${ex.id}</div>
      <p class="quiz-card__text">${escapeHtml(ex.text)}</p>
      ${footnoteHtml}
      <input class="field-input" type="text" placeholder="填写单词，Enter 或失焦判题" data-qid="${ex.id}"
        value="${escapeHtml(userAnswers[ex.id] || '')}" ${locked ? 'disabled' : ''} autocomplete="off" autocapitalize="off" />
      ${renderItemFeedback(result, escapeHtml(ex.answer))}
    </div>`;
}

export function renderMatchQuestion(ex, s) {
  const result = getItemResult(s, ex.id);
  const locked = isItemLocked(s, ex.id);
  const cls = result ? (result.correct ? 'quiz-card--ok' : 'quiz-card--bad') : '';
  const userAnswers = s.userAnswers;
  const answerLabel = `${escapeHtml(ex.answer)}${ex.correctDefinition ? ' — ' + escapeHtml(ex.correctDefinition) : ''}`;
  return `
    <div class="quiz-card ${cls}" data-qid="${ex.id}">
      <div class="quiz-card__word">${escapeHtml(ex.word)}</div>
      <div class="option-list">
        ${(ex.shuffledOptions || ex.options || [])
          .map(
            (opt) => `
          <button type="button" class="${optionBtnClass(opt, userAnswers[ex.id], result, ex.answer)}"
            data-qid="${ex.id}" data-value="${opt.key}" ${locked ? 'disabled' : ''}>
            <span class="option-item__key">${opt.key}</span>
            <span>${escapeHtml(opt.text)}</span>
          </button>`
          )
          .join('')}
      </div>
      ${renderItemFeedback(result, answerLabel)}
    </div>`;
}

export function renderReviewQuestion(item, s) {
  const result = getItemResult(s, item.id);
  const locked = isItemLocked(s, item.id);
  const cls = result ? (result.correct ? 'quiz-card--ok' : 'quiz-card--bad') : '';
  const userAnswers = s.userAnswers;
  return `
    <div class="quiz-card ${cls}" data-qid="${item.id}">
      <div class="quiz-card__word">${item.id}. ${escapeHtml(item.word)}</div>
      <div class="option-list">
        ${item.options
          .map(
            (opt) => `
          <button type="button" class="${optionBtnClass(opt, userAnswers[item.id], result, item.answer)}"
            data-qid="${item.id}" data-value="${opt.key}" ${locked ? 'disabled' : ''}>
            <span class="option-item__key">${opt.key}</span>
            <span>${escapeHtml(opt.text)}</span>
          </button>`
          )
          .join('')}
      </div>
      ${renderItemFeedback(result, escapeHtml(item.answer))}
    </div>`;
}

export function renderIdiomQuestion(item, s) {
  const result = getItemResult(s, item.id);
  const locked = isItemLocked(s, item.id);
  const cls = result ? (result.correct ? 'quiz-card--ok' : 'quiz-card--bad') : '';
  const userAnswers = s.userAnswers;
  const correctLabel = item.answer === 'no' ? '用法错误' : '用法正确';
  return `
    <div class="quiz-card ${cls}" data-qid="${item.id}">
      <div class="quiz-card__num">${item.id}</div>
      <p class="quiz-card__text">${escapeHtml(item.text)}</p>
      <div class="choice-list">
        ${['yes', 'no']
          .map(
            (c) => `
          <button type="button" class="${choiceBtnClass(c, userAnswers[item.id], result, item.answer)}"
            data-qid="${item.id}" data-value="${c}" ${locked ? 'disabled' : ''}>${c === 'yes' ? '用法正确' : '用法错误'}</button>`
          )
          .join('')}
      </div>
      ${renderItemFeedback(result, correctLabel)}
    </div>`;
}

export function renderDoubleDutyQuestion(item, s) {
  const result = getItemResult(s, item.id);
  const locked = isItemLocked(s, item.id);
  const cls = result ? (result.correct ? 'quiz-card--ok' : 'quiz-card--bad') : '';
  const userAnswers = s.userAnswers;
  const correctLabel = item.answer === 'yes' ? '可兼作多种词性' : '仅一种词性';
  return `
    <div class="quiz-card ${cls}" data-qid="${item.id}">
      <div class="quiz-card__word">${item.id}. ${escapeHtml(item.word)}</div>
      <p class="quiz-card__text">该词能否兼作多种词性？</p>
      <div class="choice-list">
        ${['yes', 'no']
          .map(
            (c) => `
          <button type="button" class="${choiceBtnClass(c, userAnswers[item.id], result, item.answer)}"
            data-qid="${item.id}" data-value="${c}" ${locked ? 'disabled' : ''}>${c === 'yes' ? '可以' : '不可以'}</button>`
          )
          .join('')}
      </div>
      ${renderItemFeedback(result, correctLabel)}
    </div>`;
}

export function renderHeadlineQuestion(item, s) {
  const result = getItemResult(s, item.id);
  const locked = isItemLocked(s, item.id);
  const cls = result ? (result.correct ? 'quiz-card--ok' : 'quiz-card--bad') : '';
  const userAnswers = s.userAnswers;
  return `
    <div class="quiz-card ${cls}" data-qid="${item.id}">
      <div class="quiz-card__num">${item.id}</div>
      <p class="quiz-card__text">${escapeHtml(item.text)}</p>
      <input class="field-input" type="text" placeholder="填写单词，Enter 或失焦判题" data-qid="${item.id}"
        value="${escapeHtml(userAnswers[item.id] || '')}" ${locked ? 'disabled' : ''} autocomplete="off" autocapitalize="off" />
      ${renderItemFeedback(result, escapeHtml(item.answer))}
    </div>`;
}

export function renderCompletionQuestion(item, s) {
  const result = getItemResult(s, item.id);
  const locked = isItemLocked(s, item.id);
  const cls = result ? (result.correct ? 'quiz-card--ok' : 'quiz-card--bad') : '';
  const userAnswers = s.userAnswers;
  return `
    <div class="quiz-card ${cls}" data-qid="${item.id}">
      <p class="quiz-card__text">${escapeHtml(item.text)}</p>
      <div class="choice-list">
        ${item.shuffledChoices
          .map(
            (c) => `
          <button type="button" class="${optionBtnClass(c, userAnswers[item.id], result, item.answer)}"
            data-qid="${item.id}" data-value="${escapeHtml(c.key)}" ${locked ? 'disabled' : ''}>
            <span class="option-item__key">${escapeHtml(c.key)}</span>
            <span>${escapeHtml(c.text)}</span>
          </button>`
          )
          .join('')}
      </div>
      ${renderItemFeedback(result, escapeHtml(item.answer))}
    </div>`;
}

export function renderWordsearchQuestion(item, s) {
  const result = getItemResult(s, item.id);
  const locked = isItemLocked(s, item.id);
  const cls = result ? (result.correct ? 'quiz-card--ok' : 'quiz-card--bad') : '';
  const userAnswers = s.userAnswers;
  return `
    <div class="quiz-card ${cls}" data-qid="${item.id}">
      <div class="quiz-card__num">空 ${item.id}</div>
      <p class="quiz-card__text">提示：参考 ${escapeHtml(item.hint)} 所学词汇</p>
      <input class="field-input" type="text" placeholder="填写单词，Enter 或失焦判题" data-qid="${item.id}"
        value="${escapeHtml(userAnswers[item.id] || '')}" ${locked ? 'disabled' : ''} autocomplete="off" autocapitalize="off" />
      ${renderItemFeedback(result, escapeHtml(item.answer))}
    </div>`;
}

export function renderChoiceQuestion(item, s) {
  const result = getItemResult(s, item.id);
  const locked = isItemLocked(s, item.id);
  const cls = result ? (result.correct ? 'quiz-card--ok' : 'quiz-card--bad') : '';
  const userAnswers = s.userAnswers;
  return `
    <div class="quiz-card ${cls}" data-qid="${item.id}">
      <p class="quiz-card__text">${escapeHtml(item.text)}</p>
      <div class="choice-list">
        ${item.shuffledChoices
          .map(
            (c) => `
          <button type="button" class="${choiceBtnClass(c, userAnswers[item.id], result, item.answer)}"
            data-qid="${item.id}" data-value="${escapeHtml(c)}" ${locked ? 'disabled' : ''}>${escapeHtml(c)}</button>`
          )
          .join('')}
      </div>
      ${renderItemFeedback(result, escapeHtml(item.answer))}
    </div>`;
}

export function renderQuestionItem(s, qid) {
  const found = findQuizItem(s, qid);
  if (!found) return '';

  const { item } = found;
  const { lesson } = s;

  if (lesson.type === 'lesson') {
    if (item.type === 'fillBlank') return renderFillQuestion(item, s, lesson);
    if (item.type === 'matching') return renderMatchQuestion(item, s);
  }
  if (lesson.type === 'review' || lesson.type === 'wordMatch' || lesson.type === 'partsOfSpeech') {
    if (lesson.type === 'review') return renderReviewMatchCard(item, s);
    return renderReviewQuestion(item, s);
  }
  if (lesson.type === 'sensible') {
    if (s.choiceItems.some((e) => e.id === item.id)) return renderChoiceQuestion(item, s);
    return renderIdiomQuestion(item, s);
  }
  if (lesson.type === 'wordsearch') return renderWordsearchQuestion(item, s);
  if (lesson.type === 'headlines') return renderHeadlineQuestion(item, s);
  if (lesson.type === 'sentenceCompletion') return renderCompletionQuestion(item, s);
  if (lesson.type === 'doubleDuty') return renderDoubleDutyQuestion(item, s);
  return '';
}
