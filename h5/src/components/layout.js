import { escapeHtml } from '../core/dom.js';
import {
  getProgress,
  getDayLabel,
  getTasksForLesson,
  getDayTasks,
  getWeekCompletion,
  formatWeekLabel,
  weekEquals,
} from '../utils/progress.js';

export function shell({ title, back = false, activeTab = '', body, footer = '' }) {
  return `
    <div class="shell">
      <header class="header">
        ${back ? '<button class="header__back" data-action="back" aria-label="返回">←</button>' : '<div class="header__mark">B</div>'}
        <div class="header__center">
          <div class="header__title">${escapeHtml(title)}</div>
        </div>
        <div class="header__slot"></div>
      </header>
      <main class="main">${body}</main>
      ${footer}
      ${tabBar(activeTab)}
    </div>
  `;
}

export function tabBar(active) {
  const tabs = [
    { id: 'home', hash: '#home', icon: '⌂', label: '首页' },
    { id: 'learn', hash: '#learn', icon: '◎', label: '学习' },
    { id: 'memorize', hash: '#memorize', icon: '📚', label: '词汇本' },
    { id: 'quiz', hash: '#quiz', icon: '✎', label: '练习' },
  ];
  return `
    <nav class="tabbar" aria-label="主导航">
      ${tabs
        .map(
          (t) => `
        <button class="tabbar__item ${active === t.id ? 'tabbar__item--active' : ''}"
          data-action="nav" data-hash="${t.hash}" aria-current="${active === t.id ? 'page' : 'false'}">
          <span class="tabbar__icon">${t.icon}</span>
          <span class="tabbar__label">${t.label}</span>
        </button>`
        )
        .join('')}
    </nav>
  `;
}

export function dayBadge(week, day, lesson) {
  const progress = getProgress();
  const key = `w${week}-d${day}`;
  const done = progress.completedDays.includes(key);
  return `
    <div class="day-badge animate-in">
      <div class="day-badge__row">
        <span class="day-badge__week">${escapeHtml(formatWeekLabel(week))}</span>
        <span class="day-badge__dot">·</span>
        <span class="day-badge__day">Day ${day}</span>
        ${done ? '<span class="day-badge__done">✓</span>' : ''}
      </div>
      <span class="chip chip--${lesson?.type || 'lesson'}">${escapeHtml(getDayLabel(lesson))}</span>
    </div>
  `;
}

export function sectionTitle(text, extra = '') {
  return `<div class="section-head animate-in"><h2 class="section-head__title">${escapeHtml(text)}</h2>${extra}</div>`;
}

export function stickyFooter(content) {
  return `<div class="sticky-footer">${content}</div>`;
}

export function reviewCardInner(word, index, total) {
  if (!word) return '';
  return `
    <div class="review-flip-card__inner">
      <div class="review-flip-card__face review-flip-card__face--front">
        <div class="review-flip-card__meta">
          <span class="review-flip-card__index">${index + 1} / ${total}</span>
          ${word.isIdiom ? '<span class="review-flip-card__tag">习语</span>' : ''}
        </div>
        <div class="review-flip-card__head">
          <h3 class="review-flip-card__word">${escapeHtml(word.word)}</h3>
          <button class="speak-btn" data-speak="${escapeHtml(word.word)}" aria-label="发音" type="button">🔊</button>
        </div>
        ${word.phonetic ? `<p class="review-flip-card__phonetic">${escapeHtml(word.phonetic)}</p>` : ''}
      </div>
      <div class="review-flip-card__face review-flip-card__face--back">
        <p class="review-flip-card__def-en">${escapeHtml(word.definition || '暂无释义')}</p>
        ${word.definitionZh ? `<p class="review-flip-card__def-zh">${escapeHtml(word.definitionZh)}</p>` : ''}
      </div>
    </div>`;
}

function reviewWordListItem(word, index, activeIndex) {
  return `
    <button type="button"
      class="review-word-list__item ${index === activeIndex ? 'review-word-list__item--active' : ''}${word.isIdiom ? ' review-word-list__item--idiom' : ''}"
      data-review-pick="${index}">
      <span class="review-word-list__num">${index + 1}</span>
      <span class="review-word-list__word">${escapeHtml(word.word)}</span>
    </button>`;
}

export function reviewStudyPanel(words, activeIndex = 0) {
  const vocab = words.filter((w) => !w.isIdiom);
  const idioms = words.filter((w) => w.isIdiom);
  const pct = words.length ? ((activeIndex + 1) / words.length) * 100 : 0;
  const current = words[activeIndex];

  return `
    <section class="review-studio animate-in">
      <div class="review-studio__header">
        <div class="review-studio__header-top">
          <span class="review-studio__label">复习进度</span>
          <span class="review-studio__counter">${activeIndex + 1} / ${words.length}</span>
        </div>
        <div class="review-studio__bar"><div class="review-studio__bar-fill" style="width:${pct}%"></div></div>
      </div>

      <div class="review-studio__stage">
        <article class="review-flip-card" data-review-card>
          ${reviewCardInner(current, activeIndex, words.length)}
        </article>
        <div class="review-studio__nav">
          <button class="review-studio__arrow" data-review-prev type="button" aria-label="上一个" ${activeIndex === 0 ? 'disabled' : ''}>‹</button>
          <button class="review-studio__flip" data-flip-review type="button">查看释义</button>
          <button class="review-studio__arrow" data-review-next type="button" aria-label="下一个" ${activeIndex >= words.length - 1 ? 'disabled' : ''}>›</button>
        </div>
      </div>

      <div class="review-studio__catalog">
        ${
          vocab.length
            ? `<div class="review-studio__group">
          <h3 class="review-studio__group-title">单词 <span>${vocab.length}</span></h3>
          <div class="review-word-list review-word-list--grid">
            ${words.map((w, i) => (!w.isIdiom ? reviewWordListItem(w, i, activeIndex) : '')).join('')}
          </div>
        </div>`
            : ''
        }
        ${
          idioms.length
            ? `<div class="review-studio__group">
          <h3 class="review-studio__group-title">习语 <span>${idioms.length}</span></h3>
          <div class="review-word-list review-word-list--idioms">
            ${words.map((w, i) => (w.isIdiom ? reviewWordListItem(w, i, activeIndex) : '')).join('')}
          </div>
        </div>`
            : ''
        }
      </div>

      ${wordExamplesPanel(words, activeIndex)}
    </section>`;
}

export function wordCarousel(words) {
  const cards = words
    .map(
      (w, i) => `
    <article class="word-carousel__card" data-index="${i}">
      <div class="word-carousel__inner">
        <div class="word-carousel__face word-carousel__face--front">
          <div class="word-carousel__index">${i + 1} / ${words.length}${w.isIdiom ? ' · 习语' : ''}</div>
          <div class="word-carousel__head">
            <h3 class="word-carousel__word">${escapeHtml(w.word)}</h3>
            <button class="speak-btn" data-speak="${escapeHtml(w.word)}" aria-label="发音" type="button">🔊</button>
          </div>
          <p class="word-carousel__phonetic">${escapeHtml(w.phonetic)}</p>
          <button class="word-carousel__flip-btn" data-flip="${i}" type="button">查看释义</button>
        </div>
        <div class="word-carousel__face word-carousel__face--back">
          <p class="word-carousel__def">${escapeHtml(w.definition || '暂无释义')}</p>
          ${w.definitionZh ? `<p class="word-carousel__def-zh">${escapeHtml(w.definitionZh)}</p>` : ''}
          <button class="word-carousel__flip-btn" data-flip="${i}" type="button">返回单词</button>
        </div>
      </div>
    </article>`
    )
    .join('');

  return `
    <div class="word-carousel animate-in">
      <div class="word-carousel__track">${cards}</div>
      <div class="word-carousel__dots">
        ${words.map((_, i) => `<span class="word-carousel__dot ${i === 0 ? 'word-carousel__dot--active' : ''}" data-dot="${i}"></span>`).join('')}
      </div>
    </div>
    ${wordExamplesPanel(words, 0)}
  `;
}

export function wordExamplesPanel(words, activeIndex = 0) {
  const w = words[activeIndex];
  if (!w) return '';

  const examples = w.examples || [];
  return `
    <section class="examples-panel animate-in" data-examples-panel>
      <div class="examples-panel__head">
        <h3 class="examples-panel__title">${escapeHtml(w.word)} 例句</h3>
        <button class="speak-btn speak-btn--sm" data-speak="${escapeHtml(w.word)}" type="button">🔊</button>
      </div>
      ${
        examples.length
          ? `<ol class="examples-panel__list">
          ${examples
            .map(
              (ex, i) => `
            <li class="examples-panel__item">
              <span class="examples-panel__num">${i + 1}</span>
              <div>
                <p class="examples-panel__en">${escapeHtml(ex.en)}</p>
                ${ex.zh ? `<p class="examples-panel__zh">${escapeHtml(ex.zh)}</p>` : ''}
              </div>
            </li>`
            )
            .join('')}
        </ol>`
          : '<p class="examples-panel__empty">暂无例句</p>'
      }
    </section>
  `;
}

export function taskChecklist(week, day, lesson) {
  const progress = getProgress();
  const tasks = getTasksForLesson(lesson);
  const done = getDayTasks(week, day, progress);
  const completed = tasks.filter((t) => done[t.id]).length;

  return `
    <section class="task-panel animate-in">
      <div class="task-panel__head">
        <h3>今日任务</h3>
        <span class="task-panel__count">${completed} / ${tasks.length}</span>
      </div>
      <ul class="task-list">
        ${tasks
          .map(
            (t) => `
          <li class="task-item ${done[t.id] ? 'task-item--done' : ''}">
            <button class="task-item__btn" data-action="task" data-hash="${t.hash}" data-task="${t.id}">
              <span class="task-item__check">${done[t.id] ? '✓' : ''}</span>
              <span class="task-item__body">
                <span class="task-item__label">${escapeHtml(t.label)}</span>
                ${t.hint ? `<span class="task-item__hint">${escapeHtml(t.hint)}</span>` : ''}
              </span>
              <span class="task-item__arrow">→</span>
            </button>
          </li>`
          )
          .join('')}
      </ul>
    </section>
  `;
}

function renderPickerWeekGrid(weeks, currentWeek, progress) {
  const courseData = { weeks };
  const regular = weeks.filter((w) => typeof w.week === 'number');
  const bonus = weeks.filter((w) => typeof w.week !== 'number');

  const renderWeek = (w) => {
    const { completed, total } = getWeekCompletion(courseData, w.week, progress);
    const pct = total ? Math.round((completed / total) * 100) : 0;
    const isCurrent = weekEquals(w.week, currentWeek);
    const isDone = completed === total && total > 0;
    const label = typeof w.week === 'number' ? w.week : w.week;

    return `
      <button class="picker-week ${isCurrent ? 'picker-week--current' : ''} ${isDone ? 'picker-week--done' : ''}"
        data-action="pick-week" data-week="${w.week}" type="button">
        <span class="picker-week__num">${escapeHtml(String(label))}</span>
        <span class="picker-week__meta">${completed}/${total}</span>
        <span class="picker-week__bar"><span class="picker-week__fill" style="width:${pct}%"></span></span>
        ${isDone ? '<span class="picker-week__check">✓</span>' : ''}
      </button>`;
  };

  return `
    <div class="picker-weeks">
      <div class="picker-weeks__grid">${regular.map(renderWeek).join('')}</div>
      ${
        bonus.length
          ? `<div class="picker-weeks__bonus">
          <p class="picker-weeks__bonus-label">Bonus</p>
          <div class="picker-weeks__grid picker-weeks__grid--bonus">${bonus.map(renderWeek).join('')}</div>
        </div>`
          : ''
      }
    </div>`;
}

function renderPickerDayList(weekData, currentWeek, currentDay, progress) {
  if (!weekData) return '<p class="picker-empty">找不到该周课程</p>';

  return `
    <ul class="picker-days">
      ${weekData.days
        .map((d) => {
          const key = `w${weekData.week}-d${d.day}`;
          const done = progress.completedDays.includes(key);
          const isCurrent = weekEquals(weekData.week, currentWeek) && d.day === currentDay;
          const tasks = getTasksForLesson(d);
          const taskDone = getDayTasks(weekData.week, d.day, progress);
          const taskCompleted = tasks.filter((t) => taskDone[t.id]).length;

          return `
          <li class="picker-day ${isCurrent ? 'picker-day--current' : ''} ${done ? 'picker-day--done' : ''}">
            <button class="picker-day__btn" data-action="pick" data-week="${weekData.week}" data-day="${d.day}" type="button">
              <span class="picker-day__check">${done ? '✓' : d.day}</span>
              <span class="picker-day__body">
                <span class="picker-day__label">Day ${d.day}${d.title ? ` · ${escapeHtml(d.title)}` : ''}</span>
                <span class="picker-day__meta">
                  <span class="chip chip--sm chip--${d.type}">${escapeHtml(getDayLabel(d))}</span>
                  ${tasks.length ? `<span class="picker-day__tasks">${taskCompleted}/${tasks.length} 任务</span>` : ''}
                </span>
              </span>
              <span class="picker-day__arrow">→</span>
            </button>
          </li>`;
        })
        .join('')}
    </ul>`;
}

export function pickerModal(weeks, currentWeek, currentDay, { view = 'weeks', focusWeek = null } = {}) {
  const progress = getProgress();
  const weekData = weeks.find((w) => weekEquals(w.week, focusWeek ?? currentWeek));
  const inDaysView = view === 'days' && focusWeek != null;

  const head = inDaysView
    ? `
      <div class="picker__head picker__head--days">
        <button class="picker__back" data-action="picker-weeks" type="button" aria-label="返回周列表">←</button>
        <h3>${escapeHtml(formatWeekLabel(focusWeek))}</h3>
        <button class="picker__close" data-action="close-picker" type="button">×</button>
      </div>`
    : `
      <div class="picker__head">
        <h3>选择周次</h3>
        <button class="picker__close" data-action="close-picker" type="button">×</button>
      </div>`;

  const body = inDaysView
    ? renderPickerDayList(weekData, currentWeek, currentDay, progress)
    : renderPickerWeekGrid(weeks, currentWeek, progress);

  return `
    <div class="picker-backdrop" data-action="close-picker">
      <div class="picker" role="dialog" aria-label="选择课程">
        ${head}
        <div class="picker__body">${body}</div>
      </div>
    </div>
  `;
}
