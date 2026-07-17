import { delegate, toast } from '../../core/dom.js';
import { getCourseData, getQuizState, setQuizState, resetQuizState } from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { advanceToNextDay } from '../../utils/progress.js';
import { navigateToLesson } from '../../utils/course.js';
import { prepareQuizState, getItemResult } from './state.js';
import { checkQuizItem, updateQuizFooter, updateQuizHint } from './grading.js';
import { renderQuestionItem } from './questions.js';
import {
  getReviewPhaseItems,
  patchReviewCatalog,
  patchReviewQuizStage,
  patchReviewQuizUI,
  setReviewPhase,
  updateReviewDefFilterBtn,
  updateReviewNav,
  updateReviewPhaseTabs,
} from './review-match.js';

export function patchQuizItem(s, qid) {
  if (s.lesson?.type === 'review') {
    patchReviewQuizUI(s, qid);
    return;
  }

  const html = renderQuestionItem(s, qid);
  if (!html) return;

  const card = document.querySelector(`.quiz-card[data-qid="${CSS.escape(String(qid))}"]`);
  if (card) card.outerHTML = html;

  updateQuizHint();
  if (s.submitted) updateQuizFooter(s);
}

export function bindQuizEvents(onRetry) {
  const root = document.getElementById('app');

  delegate(root, '[data-action="back"]', 'click', () => navigate('#home'));
  delegate(root, '[data-action="nav"]', 'click', (_, el) => {
    if (el.dataset.hash === '#quiz' && !getQuizState()) setQuizState(prepareQuizState());
    navigate(el.dataset.hash);
  });

  delegate(root, '[data-review-phase]', 'click', (_, btn) => {
    const state = getQuizState();
    if (!state || state.reviewPhase === btn.dataset.reviewPhase) return;
    setReviewPhase(state, btn.dataset.reviewPhase);
    patchReviewQuizStage(state);
    patchReviewCatalog(state);
    updateReviewNav(state);
    updateReviewPhaseTabs(state);

    const title = document.querySelector('.review-match-quiz .quiz-section__title');
    if (title) {
      title.textContent = `周复习 · ${state.reviewPhase === 'idiom' ? '习语配对' : '单词配对'}`;
    }
  });

  delegate(root, '[data-action="toggle-def-filter"]', 'click', () => {
    const state = getQuizState();
    if (!state) return;
    state.reviewDefFilter = state.reviewDefFilter === 'available' ? 'all' : 'available';
    patchReviewQuizStage(state);
    updateReviewDefFilterBtn(state);
  });

  delegate(root, '[data-review-quiz-prev]', 'click', () => {
    const state = getQuizState();
    if (!state || (state.reviewIndex ?? 0) <= 0) return;
    state.reviewIndex -= 1;
    patchReviewQuizStage(state);
    patchReviewCatalog(state);
    updateReviewNav(state);
  });

  delegate(root, '[data-review-quiz-next]', 'click', () => {
    const state = getQuizState();
    if (!state) return;
    const items = getReviewPhaseItems(state);
    const idx = state.reviewIndex ?? 0;
    if (idx >= items.length - 1) return;
    state.reviewIndex = idx + 1;
    patchReviewQuizStage(state);
    patchReviewCatalog(state);
    updateReviewNav(state);
  });

  delegate(root, '[data-review-quiz-pick]', 'click', (_, btn) => {
    const state = getQuizState();
    if (!state) return;
    state.reviewIndex = Number(btn.dataset.reviewQuizPick);
    patchReviewQuizStage(state);
    patchReviewCatalog(state);
    updateReviewNav(state);
  });

  delegate(root, '.field-input', 'input', (_, input) => {
    const state = getQuizState();
    if (!state) return;
    state.userAnswers[input.dataset.qid] = input.value;
    updateQuizHint();
  });

  delegate(root, '.field-input', 'blur', (_, input) => {
    const state = getQuizState();
    if (!state || input.disabled) return;
    state.userAnswers[input.dataset.qid] = input.value;
    const before = !!getItemResult(state, input.dataset.qid);
    checkQuizItem(state, input.dataset.qid);
    if (!before && getItemResult(state, input.dataset.qid)) patchQuizItem(state, input.dataset.qid);
  });

  delegate(root, '.field-input', 'keydown', (e, input) => {
    if (e.key !== 'Enter') return;
    const state = getQuizState();
    if (!state || input.disabled) return;
    state.userAnswers[input.dataset.qid] = input.value;
    const before = !!getItemResult(state, input.dataset.qid);
    checkQuizItem(state, input.dataset.qid);
    if (!before && getItemResult(state, input.dataset.qid)) patchQuizItem(state, input.dataset.qid);
  });

  delegate(root, '.def-card:not([disabled])', 'click', (_, el) => {
    const state = getQuizState();
    if (!state) return;
    state.userAnswers[el.dataset.qid] = el.dataset.value;
    checkQuizItem(state, el.dataset.qid);
    patchQuizItem(state, el.dataset.qid);
  });

  delegate(root, '.option-item:not([disabled])', 'click', (_, el) => {
    const state = getQuizState();
    if (!state) return;
    state.userAnswers[el.dataset.qid] = el.dataset.value;
    checkQuizItem(state, el.dataset.qid);
    patchQuizItem(state, el.dataset.qid);
  });

  delegate(root, '.choice-item:not([disabled])', 'click', (_, el) => {
    const state = getQuizState();
    if (!state) return;
    state.userAnswers[el.dataset.qid] = el.dataset.value;
    checkQuizItem(state, el.dataset.qid);
    patchQuizItem(state, el.dataset.qid);
  });

  delegate(root, '[data-action="retry"]', 'click', () => {
    setQuizState(prepareQuizState());
    onRetry();
  });

  delegate(root, '[data-action="next-day"]', 'click', () => {
    advanceToNextDay(getCourseData());
    resetQuizState();
    toast('已进入下一天', 'success');
    navigate('#home');
  });

  delegate(root, '.cross-ref', 'click', (_, btn) => {
    const found = navigateToLesson(getCourseData(), btn.dataset.targetId);
    if (!found) {
      toast('找不到对应课程', 'info');
      return;
    }
    resetQuizState();
    toast(`已跳转到 ${found.lesson.title || btn.dataset.targetId}`, 'success');
    navigate('#learn');
  });
}
