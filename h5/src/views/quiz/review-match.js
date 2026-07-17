import { escapeHtml, toast } from '../../core/dom.js';
import { getQuizState } from '../../core/store.js';
import { normalizeAnswer } from '../../utils/quiz.js';
import { getItemResult, isItemLocked } from './state.js';
import { updateQuizHint, updateQuizFooter } from './grading.js';
import {
  countPhaseAnswered,
  defCardClass,
  getReviewDefinitionText,
  getReviewIdiomItems,
  getReviewOptions,
  getReviewPhaseItems,
  getReviewVocabItems,
  getVisibleDefOptions,
  isDefOptionDisabled,
  isReviewIdiom,
  setReviewPhase,
} from './review-utils.js';

function renderReviewItemFeedback(result, s, answerKey, userAnswer) {
  if (!result) return '';
  const correctText = getReviewDefinitionText(s, answerKey);
  if (result.correct) {
    return `<div class="quiz-card__feedback quiz-card__feedback--ok">✓ ${correctText}</div>`;
  }
  const userOpt = getReviewOptions(s).find((o) => normalizeAnswer(o.key) === normalizeAnswer(userAnswer));
  const wrongLine = userOpt ? `<div class="quiz-card__wrong-pick">你选了：${escapeHtml(userOpt.text)}</div>` : '';
  return `<div class="quiz-card__answer">正确：${correctText}${wrongLine}</div>`;
}

function catalogPickClass(item, s, index, activeIndex) {
  const result = getItemResult(s, item.id);
  let cls = 'review-match__pick';
  if (index === activeIndex) cls += ' review-match__pick--active';
  if (result?.correct) cls += ' review-match__pick--ok';
  else if (result) cls += ' review-match__pick--bad';
  return cls;
}

export function renderReviewMatchCard(item, s) {
  const result = getItemResult(s, item.id);
  const locked = isItemLocked(s, item.id);
  const cls = result ? (result.correct ? 'quiz-card--ok' : 'quiz-card--bad') : '';
  const userAnswer = s.userAnswers[item.id] ?? s.userAnswers[String(item.id)] ?? '';
  const options = getVisibleDefOptions(s, item.id);
  const isIdiom = isReviewIdiom(item);
  const listCls = options.length <= 6 ? 'def-card-list def-card-list--compact' : 'def-card-list';

  return `
    <div class="quiz-card review-match-card ${cls}" data-qid="${item.id}">
      <div class="review-match-card__meta">
        <span class="quiz-card__num">${item.id}</span>
        ${isIdiom ? '<span class="chip chip--review">习语</span>' : ''}
      </div>
      <div class="quiz-card__word review-match-card__word">${escapeHtml(item.word)}</div>
      <p class="review-match-card__hint">选择正确的释义 · ${options.length} 项</p>
      <div class="${listCls}">
        ${options
          .map(
            (opt) => `
          <button type="button" class="${defCardClass(opt, userAnswer, result, item.answer, s, item.id)}"
            data-qid="${item.id}" data-value="${escapeHtml(opt.key)}"
            ${isDefOptionDisabled(opt, s, item.id, locked) ? 'disabled' : ''}>
            <span class="def-card__text">${escapeHtml(opt.text)}</span>
          </button>`
          )
          .join('')}
      </div>
      ${renderReviewItemFeedback(result, s, item.answer, userAnswer)}
    </div>`;
}

function renderCatalogPick(item, s, index, activeIndex) {
  return `<button type="button" class="${catalogPickClass(item, s, index, activeIndex)}"
    data-review-quiz-pick="${index}">${item.id}</button>`;
}

export function renderReviewMatchQuiz(s) {
  const phase = s.reviewPhase || 'vocab';
  const phaseItems = getReviewPhaseItems(s);
  const vocabItems = getReviewVocabItems(s);
  const idiomItems = getReviewIdiomItems(s);
  const idx = Math.min(s.reviewIndex ?? 0, Math.max(phaseItems.length - 1, 0));
  const current = phaseItems[idx];
  const phaseTitle = phase === 'idiom' ? '习语配对' : '单词配对';
  const stageLabel = phase === 'idiom' ? '当前习语' : '当前单词';
  const filterOn = s.reviewDefFilter === 'available';

  return `
    <div class="quiz-section review-match-quiz animate-in">
      <h3 class="quiz-section__title">周复习 · ${phaseTitle}</h3>
      <div class="review-match__toolbar">
        <div class="review-match__phases" data-review-phases>
          <button type="button" class="review-match__phase ${phase === 'vocab' ? 'review-match__phase--active' : ''}"
            data-review-phase="vocab">
            <span class="review-match__phase-name">单词</span>
            <span class="review-match__phase-meta" data-review-phase-meta>${countPhaseAnswered(s, 'vocab')}/${vocabItems.length}</span>
          </button>
          <button type="button" class="review-match__phase ${phase === 'idiom' ? 'review-match__phase--active' : ''}"
            data-review-phase="idiom">
            <span class="review-match__phase-name">习语</span>
            <span class="review-match__phase-meta" data-review-phase-meta>${countPhaseAnswered(s, 'idiom')}/${idiomItems.length}</span>
          </button>
        </div>
        <button type="button" class="review-match__filter${filterOn ? ' review-match__filter--on' : ''}"
          data-action="toggle-def-filter" aria-pressed="${filterOn ? 'true' : 'false'}">
          仅显示可用释义
        </button>
      </div>
      <div class="review-match__stage-header">
        <span class="review-match__stage-label" data-review-match-label>${stageLabel}</span>
        <span class="review-match__stage-counter" data-review-match-counter>${idx + 1} / ${phaseItems.length}</span>
      </div>
      <div data-review-match-stage>
        ${current ? renderReviewMatchCard(current, s) : ''}
      </div>
      <div class="review-match__nav">
        <button type="button" class="review-match__arrow" data-review-quiz-prev aria-label="上一题" ${idx === 0 ? 'disabled' : ''}>‹</button>
        <span class="review-match__nav-hint">点选释义 · 答对自动下一题</span>
        <button type="button" class="review-match__arrow" data-review-quiz-next aria-label="下一题" ${idx >= phaseItems.length - 1 ? 'disabled' : ''}>›</button>
      </div>
      <div class="review-match__catalog" data-review-match-catalog>
        <div class="review-match__group">
          <h4 class="review-match__group-title">${phase === 'idiom' ? '习语' : '单词'}</h4>
          <div class="review-match__picks">
            ${phaseItems.map((item, i) => renderCatalogPick(item, s, i, idx)).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

export function patchReviewQuizStage(s) {
  const stage = document.querySelector('[data-review-match-stage]');
  if (!stage) return;
  const items = getReviewPhaseItems(s);
  const idx = Math.min(s.reviewIndex ?? 0, Math.max(items.length - 1, 0));
  s.reviewIndex = idx;
  const current = items[idx];
  if (current) stage.innerHTML = renderReviewMatchCard(current, s);

  const label = document.querySelector('[data-review-match-label]');
  if (label) label.textContent = s.reviewPhase === 'idiom' ? '当前习语' : '当前单词';
}

export function updateReviewNav(s) {
  const items = getReviewPhaseItems(s);
  const idx = s.reviewIndex ?? 0;
  const prev = document.querySelector('[data-review-quiz-prev]');
  const next = document.querySelector('[data-review-quiz-next]');
  const counter = document.querySelector('[data-review-match-counter]');
  if (prev) prev.disabled = idx === 0;
  if (next) next.disabled = idx >= items.length - 1;
  if (counter) counter.textContent = `${idx + 1} / ${items.length}`;
}

export function patchReviewCatalog(s) {
  const catalog = document.querySelector('[data-review-match-catalog]');
  if (!catalog) return;
  const items = getReviewPhaseItems(s);
  const idx = s.reviewIndex ?? 0;
  const title = s.reviewPhase === 'idiom' ? '习语' : '单词';
  catalog.innerHTML = `
    <div class="review-match__group">
      <h4 class="review-match__group-title">${title}</h4>
      <div class="review-match__picks">
        ${items.map((item, i) => renderCatalogPick(item, s, i, idx)).join('')}
      </div>
    </div>`;
}

export function updateReviewPhaseTabs(s) {
  const tabs = document.querySelector('[data-review-phases]');
  if (!tabs) return;

  tabs.querySelectorAll('[data-review-phase]').forEach((btn) => {
    const phase = btn.dataset.reviewPhase;
    const total = phase === 'idiom' ? getReviewIdiomItems(s).length : getReviewVocabItems(s).length;
    const answered = countPhaseAnswered(s, phase);
    btn.classList.toggle('review-match__phase--active', s.reviewPhase === phase);
    btn.classList.toggle('review-match__phase--done', total > 0 && answered >= total);
    const meta = btn.querySelector('[data-review-phase-meta]');
    if (meta) meta.textContent = `${answered}/${total}`;
  });
}

export function updateReviewDefFilterBtn(s) {
  const btn = document.querySelector('[data-action="toggle-def-filter"]');
  if (!btn) return;
  const on = s.reviewDefFilter === 'available';
  btn.classList.toggle('review-match__filter--on', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

export function patchReviewQuizUI(s, qid) {
  const phaseItems = getReviewPhaseItems(s);
  const idx = phaseItems.findIndex((i) => String(i.id) === String(qid));
  if (idx >= 0) s.reviewIndex = idx;

  patchReviewQuizStage(s);
  patchReviewCatalog(s);
  updateReviewNav(s);
  updateReviewPhaseTabs(s);
  updateReviewDefFilterBtn(s);
  updateQuizHint();

  if (s.submitted) {
    updateQuizFooter(s);
    return;
  }

  if (idx < 0) return;

  if (s._advanceTimer != null) clearTimeout(s._advanceTimer);
  const result = getItemResult(s, qid);
  if (!result?.correct) return;

  s._advanceTimer = window.setTimeout(() => {
    s._advanceTimer = null;
    const state = getQuizState();
    if (!state || state !== s || state.lesson?.type !== 'review') return;
    if (!getItemResult(state, qid)) return;

    const items = getReviewPhaseItems(state);
    const curIdx = items.findIndex((i) => String(i.id) === String(qid));
    if (curIdx < 0) return;

    if (curIdx < items.length - 1) {
      state.reviewIndex = curIdx + 1;
    } else if (state.reviewPhase === 'vocab' && getReviewIdiomItems(state).length) {
      setReviewPhase(state, 'idiom');
      toast('单词完成，开始习语', 'success');
    }

    patchReviewQuizStage(state);
    patchReviewCatalog(state);
    updateReviewNav(state);
    updateReviewPhaseTabs(state);
  }, 700);
}

export { setReviewPhase, getReviewPhaseItems };
