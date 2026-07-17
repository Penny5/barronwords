import { mount, delegate, toast, escapeHtml } from '../core/dom.js';
import { getCourseData, getPickerState, openPicker, closePicker, setPickerView, resetQuizState } from '../core/store.js';
import { navigate } from '../core/router.js';
import {
  getProgress,
  saveProgress,
  advanceToNextDay,
  goPrevDay,
  getLesson,
  getTotalDays,
  getCompletedCount,
  jumpToDay,
  getTaskProgress,
  isDayCompleted,
  formatWeekLabel,
} from '../utils/progress.js';
import { getDueCount, getDueWords } from '../utils/srs.js';
import { getWeakCount } from '../utils/weak.js';
import { startReviewSession } from './review.js';
import { shell, dayBadge, pickerModal, taskChecklist } from '../components/layout.js';

export function renderHome() {
  const courseData = getCourseData();
  const progress = getProgress();
  const lesson = getLesson(courseData, progress.week, progress.day);
  const totalDays = getTotalDays(courseData);
  const completedCount = getCompletedCount(progress);
  const pct = Math.round((completedCount / totalDays) * 100);
  const done = isDayCompleted(progress.week, progress.day, progress);
  const taskProg = getTaskProgress(progress.week, progress.day, lesson, progress);
  const dueCount = getDueCount(progress);
  const weakCount = getWeakCount(progress);
  const picker = getPickerState();

  const alerts =
    dueCount || weakCount
      ? `
    <div class="home-alerts animate-in">
      ${dueCount ? `<button class="home-alert" data-action="start-review" type="button">复习 ${dueCount}</button>` : ''}
      ${weakCount ? `<button class="home-alert home-alert--warn" data-action="go-weak" type="button">薄弱 ${weakCount}</button>` : ''}
    </div>`
      : '';

  const body = `
    <section class="home-hero animate-in">
      <div class="home-hero__row">
        ${dayBadge(progress.week, progress.day, lesson)}
        <button class="link-btn home-hero__link" data-action="open-picker-weeks" type="button">学习地图</button>
      </div>
      <h1 class="home-hero__title">${escapeHtml(lesson?.title || '今日词汇训练')}</h1>
      <div class="home-hero__progress">
        <div class="home-hero__bar"><div class="home-hero__fill" style="width:${pct}%"></div></div>
        <span class="home-hero__pct">${pct}%</span>
      </div>
      <p class="home-hero__meta">
        <span>${completedCount} / ${totalDays} 天</span>
        <span class="home-hero__dot">·</span>
        <span class="${done ? 'home-hero__done' : ''}">${done ? '今日已完成' : `任务 ${taskProg.completed}/${taskProg.total}`}</span>
        ${lesson?.words?.length ? `<span class="home-hero__dot">·</span><span>${lesson.words.length} 新词</span>` : ''}
      </p>
    </section>

    ${taskChecklist(progress.week, progress.day, lesson)}
    ${alerts}

    <nav class="home-daynav animate-in">
      <button class="btn btn--soft btn--icon" data-action="prev" type="button" aria-label="上一天">←</button>
      <button class="home-daynav__picker" data-action="open-picker-days" type="button">
        <span class="home-daynav__label">${escapeHtml(formatWeekLabel(progress.week))} · Day ${progress.day}</span>
        <span class="home-daynav__chev">▾</span>
      </button>
      <button class="btn btn--soft btn--icon" data-action="next" type="button" aria-label="下一天">→</button>
    </nav>

    <div class="footer-note">
      <button class="link-btn link-btn--muted" data-action="reset" type="button">重置进度</button>
    </div>
    ${picker.open ? pickerModal(courseData.weeks, progress.week, progress.day, picker) : ''}
  `;

  mount(shell({ title: 'Barron 1100', activeTab: 'home', body }));
  bindHomeEvents();
}

function bindHomeEvents() {
  const root = document.getElementById('app');

  delegate(root, '[data-action="task"]', 'click', (_, el) => navigate(el.dataset.hash));
  delegate(root, '[data-action="nav"]', 'click', (_, el) => navigate(el.dataset.hash));
  delegate(root, '[data-action="prev"]', 'click', () => {
    goPrevDay(getCourseData());
    resetQuizState();
    navigate('#home');
  });
  delegate(root, '[data-action="next"]', 'click', () => {
    advanceToNextDay(getCourseData());
    resetQuizState();
    navigate('#home');
  });
  delegate(root, '[data-action="start-review"]', 'click', () => startReviewSession(getDueWords(), 'srs', 'mixed'));
  delegate(root, '[data-action="go-weak"]', 'click', () => navigate('#weak'));
  delegate(root, '[data-action="reset"]', 'click', () => {
    if (confirm('确定要从 Week 1 Day 1 重新开始吗？')) {
      saveProgress({ week: 1, day: 1, completedDays: [], tasks: {}, srs: {}, weak: {} });
      toast('进度已重置', 'success');
      renderHome();
    }
  });
  delegate(root, '[data-action="open-picker-weeks"]', 'click', () => {
    openPicker({ view: 'weeks' });
    renderHome();
  });
  delegate(root, '[data-action="open-picker-days"]', 'click', () => {
    openPicker({ view: 'days', focusWeek: getProgress().week });
    renderHome();
  });
  delegate(root, '[data-action="close-picker"]', 'click', (e, el) => {
    const onBackdrop = el.classList.contains('picker-backdrop') && e.target === el;
    const onCloseBtn = el.classList.contains('picker__close');
    if (onBackdrop || onCloseBtn) {
      closePicker();
      renderHome();
    }
  });
  delegate(root, '[data-action="picker-weeks"]', 'click', (e) => {
    e.stopPropagation();
    setPickerView('weeks', null);
    renderHome();
  });
  delegate(root, '[data-action="pick-week"]', 'click', (e, el) => {
    e.stopPropagation();
    const week = Number(el.dataset.week) || el.dataset.week;
    setPickerView('days', week);
    renderHome();
  });
  delegate(root, '[data-action="pick"]', 'click', (e, el) => {
    e.stopPropagation();
    const week = Number(el.dataset.week) || el.dataset.week;
    jumpToDay(week, Number(el.dataset.day));
    resetQuizState();
    closePicker();
    toast(`已跳转到 ${formatWeekLabel(week)} Day ${el.dataset.day}`);
    renderHome();
  });
  delegate(root, '[data-action="back"]', 'click', () => navigate('#home'));
}
