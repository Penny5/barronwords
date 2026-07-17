import { mount, delegate, toast } from '../core/dom.js';
import {
  getCourseData,
  getMemorizeState,
  setMemorizeState,
  resetMemorizeState,
} from '../core/store.js';
import { navigate } from '../core/router.js';
import { getProgress } from '../utils/progress.js';
import {
  MEMORIZE_SCOPES,
  getWordsByScope,
  getTodayWords,
  getWeekWords,
  getLearnedWords,
} from '../utils/memorize.js';
import { getVocabStats, getVocabEntries, renderVocabList } from '../utils/vocab.js';
import { getDueWords, normWord } from '../utils/srs.js';
import { getWeakCount } from '../utils/weak.js';
import { startReviewSession } from './review.js';
import { shuffleArray } from '../utils/course.js';
import { buildDefPickItems } from '../utils/def-pick.js';
import { speakWord, isSpeechSupported } from '../utils/speech.js';
import { renderReviewProgress, renderFlipCard, renderDefPickCard } from '../components/review-ui.js';
import { shell, stickyFooter } from '../components/layout.js';

const TABS = [
  { id: 'due', label: '待复习' },
  { id: 'learning', label: '学习中' },
  { id: 'mastered', label: '已毕业' },
];

const REVIEW_STYLES = [
  { id: 'mixed', label: '混合' },
  { id: 'flip', label: '翻卡' },
  { id: 'defPick', label: '看义选词' },
];

const PRACTICE_MODES = [
  { id: 'flip', label: '翻卡' },
  { id: 'defPick', label: '看义选词' },
];

export function startMemorizeSession(scope, shuffle = false, practiceMode = 'flip') {
  const courseData = getCourseData();
  let queue = getWordsByScope(courseData, scope);
  if (!queue.length) {
    toast('该范围暂无单词', 'info');
    return;
  }
  if (shuffle) queue = shuffleArray(queue);

  if (practiceMode === 'defPick') {
    queue = buildDefPickItems(courseData, queue);
  }

  setMemorizeState({
    ...getMemorizeState(),
    queue,
    index: 0,
    flipped: false,
    picked: null,
    pickCorrect: null,
    scope,
    shuffle,
    mode: practiceMode,
  });
  renderMemorize();
}

export function renderMemorizeHome() {
  const courseData = getCourseData();
  const progress = getProgress();
  const session = getMemorizeState();
  const stats = getVocabStats(courseData, progress);
  const tab = session?.tab || (stats.due ? 'due' : 'learning');
  const entries = getVocabEntries(courseData, tab, progress);
  const weakCount = getWeakCount(progress);
  const practiceCounts = {
    today: getTodayWords(courseData, progress).length,
    week: getWeekWords(courseData, progress.week).length,
    learned: getLearnedWords(courseData, progress).length,
  };
  const practiceScope = session?.scope || (practiceCounts.today ? 'today' : 'learned');
  const reviewStyle = session?.reviewStyle || 'mixed';
  const practiceMode = session?.practiceMode || 'flip';
  const estMinutes = stats.due ? Math.max(1, Math.ceil(stats.due * 0.4)) : 0;
  const ringPct = stats.due
    ? Math.min(100, Math.round((stats.due / Math.max(stats.learning, 1)) * 100))
    : stats.masteryPct;

  const heroBody = stats.due
    ? `
      <div class="vocab-hero__ring" style="--ring-pct: ${ringPct}">
        <div class="vocab-hero__ring-inner">
          <span class="vocab-hero__ring-num">${stats.due}</span>
          <span class="vocab-hero__ring-label">待复习</span>
        </div>
      </div>
      <div class="vocab-hero__info">
        <h2 class="vocab-hero__title">今日复习</h2>
        <p class="vocab-hero__meta">约 ${estMinutes} 分钟 · 间隔重复算法</p>
        <div class="vocab-hero__styles">
          ${REVIEW_STYLES.map(
            (s) => `
            <button class="vocab-hero__chip ${reviewStyle === s.id ? 'vocab-hero__chip--on' : ''}" data-action="pick-review-style" data-style="${s.id}" type="button">${s.label}</button>`
          ).join('')}
        </div>
        <button class="btn btn--gold btn--block" data-action="start-review" type="button">开始复习</button>
      </div>`
    : `
      <div class="vocab-hero__ring vocab-hero__ring--done" style="--ring-pct: ${stats.masteryPct}">
        <div class="vocab-hero__ring-inner">
          <span class="vocab-hero__ring-num">${stats.masteryPct}<small>%</small></span>
          <span class="vocab-hero__ring-label">已掌握</span>
        </div>
      </div>
      <div class="vocab-hero__info">
        <h2 class="vocab-hero__title">${stats.total ? '今日复习已完成' : '词汇本还是空的'}</h2>
        <p class="vocab-hero__meta">${stats.total ? `共 ${stats.total} 词 · ${stats.mastered} 已毕业` : '学完新词后会自动收录到这里'}</p>
        <button class="btn btn--gold btn--block" data-action="go-learn" type="button">${stats.total ? '继续学习新词' : '开始学习'}</button>
      </div>`;

  mount(
    shell({
      title: '词汇本',
      activeTab: 'memorize',
      body: `
        <section class="vocab-hero animate-in">
          <div class="vocab-hero__body">${heroBody}</div>
        </section>

        ${stats.total ? `
        <section class="vocab-overview animate-in">
          <div class="vocab-mastery">
            <div class="vocab-mastery__head">
              <span class="vocab-mastery__label">掌握进度</span>
              <span class="vocab-mastery__pct">${stats.masteryPct}%</span>
            </div>
            <div class="vocab-mastery__bar">
              <div class="vocab-mastery__fill" style="width:${stats.masteryPct}%"></div>
            </div>
            <p class="vocab-mastery__meta">${stats.mastered} 已毕业 · ${stats.learning} 学习中 · 共 ${stats.total} 词</p>
          </div>
          <div class="vocab-stat-row">
            ${TABS.map(
              (t) => {
                const count = stats[t.id];
                return `
              <button class="vocab-stat-pill ${tab === t.id ? 'vocab-stat-pill--on' : ''} ${t.id === 'due' && count ? 'vocab-stat-pill--due' : ''}"
                data-action="pick-tab" data-tab="${t.id}" type="button">
                <span class="vocab-stat-pill__num">${count}</span>
                <span class="vocab-stat-pill__label">${t.label}</span>
              </button>`;
              }
            ).join('')}
          </div>
        </section>` : ''}

        <section class="vocab-list-section animate-in">
          ${stats.total ? `
          <div class="vocab-list-head">
            <h3 class="vocab-list-head__title">${TABS.find((t) => t.id === tab)?.label || '词表'}</h3>
            <span class="vocab-list-head__count">${entries.length} 词</span>
          </div>` : ''}
          ${renderVocabList(entries, {
            action: 'speak',
            tab,
            emptyText:
              tab === 'due'
                ? '暂无到期复习'
                : tab === 'mastered'
                  ? '还没有毕业的词'
                  : '词汇本为空',
          })}
        </section>

        ${weakCount ? `
        <section class="vocab-quick animate-in">
          <button class="vocab-quick-link vocab-quick-link--warn" data-action="go-weak" type="button">
            <span class="vocab-quick-link__icon">🎯</span>
            <span class="vocab-quick-link__text">薄弱词专练</span>
            <span class="vocab-quick-link__badge">${weakCount}</span>
          </button>
        </section>` : ''}

        <section class="vocab-practice animate-in">
          <div class="vocab-practice__head">
            <div>
              <h3 class="vocab-practice__title">自由练习</h3>
              <p class="vocab-practice__hint">不计入复习计划，随时巩固</p>
            </div>
          </div>
          <div class="vocab-practice__group">
            <span class="vocab-practice__label">练习方式</span>
            <div class="practice-scopes">
              ${PRACTICE_MODES.map(
                (m) => `
                <button class="practice-chip ${practiceMode === m.id ? 'practice-chip--on' : ''}" data-action="pick-practice-mode" data-mode="${m.id}" type="button">${m.label}</button>`
              ).join('')}
            </div>
          </div>
          <div class="vocab-practice__group">
            <span class="vocab-practice__label">词库范围</span>
            <div class="practice-scopes practice-scopes--grid">
              ${MEMORIZE_SCOPES.map(
                (s) => `
                <button class="practice-chip practice-chip--block ${practiceScope === s.id ? 'practice-chip--on' : ''} ${!practiceCounts[s.id] ? 'practice-chip--empty' : ''}"
                  data-action="pick-scope" data-scope="${s.id}" type="button" ${!practiceCounts[s.id] ? 'disabled' : ''}>
                  <span class="practice-chip__label">${s.label}</span>
                  <span class="practice-chip__count">${practiceCounts[s.id]}</span>
                </button>`
              ).join('')}
            </div>
          </div>
          <label class="memorize-option">
            <input type="checkbox" data-action="toggle-shuffle" ${session?.shuffle ? 'checked' : ''} />
            <span>随机打乱顺序</span>
          </label>
        </section>
      `,
      footer: stickyFooter(
        `<button class="btn btn--soft btn--block" data-action="start-practice" data-scope="${practiceScope}" data-mode="${practiceMode}" type="button" ${!practiceCounts[practiceScope] ? 'disabled' : ''}>
          开始${practiceMode === 'defPick' ? '看义选词' : '翻卡'} · ${practiceCounts[practiceScope] || 0} 词
        </button>`
      ),
    })
  );
  bindMemorizeEvents();
}

export function renderMemorize() {
  const session = getMemorizeState();
  if (!session?.queue?.length || !session.mode) {
    renderMemorizeHome();
    return;
  }

  if (session.mode === 'defPick') {
    renderMemorizeDefPick(session);
    return;
  }

  if (session.mode !== 'flip') {
    renderMemorizeHome();
    return;
  }

  const item = session.queue[session.index];
  const total = session.queue.length;
  const scopeLabel = MEMORIZE_SCOPES.find((s) => s.id === session.scope)?.label || '翻卡练习';

  mount(
    shell({
      title: scopeLabel,
      back: true,
      activeTab: 'memorize',
      body: `
        <div class="memorize-session">
          ${renderReviewProgress(session.index, total)}
          ${renderFlipCard(item, session.flipped)}
        </div>
      `,
      footer: stickyFooter(`
        <div class="memorize-nav">
          <button class="btn btn--soft" data-action="prev-word" type="button" ${session.index === 0 ? 'disabled' : ''}>← 上一个</button>
          <button class="btn btn--ghost memorize-nav__flip" data-action="flip" type="button">${session.flipped ? '看单词' : '看释义'}</button>
          <button class="btn btn--soft" data-action="next-word" type="button">${session.index >= total - 1 ? '完成' : '下一个 →'}</button>
        </div>
      `),
    })
  );
  bindMemorizeEvents();
}

function renderMemorizeDefPick(session) {
  const item = session.queue[session.index];
  const total = session.queue.length;
  const scopeLabel = MEMORIZE_SCOPES.find((s) => s.id === session.scope)?.label || '看义选词';
  const showResult = session.picked !== null;

  mount(
    shell({
      title: `${scopeLabel} · 看义选词`,
      back: true,
      activeTab: 'memorize',
      body: `
        <div class="memorize-session">
          ${renderReviewProgress(session.index, total)}
          ${renderDefPickCard(item, session, 'pick-practice')}
        </div>
      `,
      footer: stickyFooter(`
        <button class="btn btn--primary btn--block" data-action="next-practice" type="button" ${!showResult ? 'disabled' : ''}>
          ${session.index >= total - 1 ? '完成' : '下一个 →'}
        </button>
      `),
    })
  );
  bindMemorizeEvents();
}

function bindMemorizeEvents() {
  const root = document.getElementById('app');

  delegate(root, '[data-action="back"]', 'click', () => {
    resetMemorizeState();
    renderMemorizeHome();
  });
  delegate(root, '[data-action="go-home"]', 'click', () => navigate('#home'));
  delegate(root, '[data-action="nav"]', 'click', (_, el) => navigate(el.dataset.hash));

  delegate(root, '[data-action="pick-tab"]', 'click', (_, btn) => {
    const session = getMemorizeState() || {};
    session.tab = btn.dataset.tab;
    setMemorizeState(session);
    renderMemorizeHome();
  });

  delegate(root, '[data-action="start-review"]', 'click', () => {
    const session = getMemorizeState() || {};
    startReviewSession(getDueWords(), 'srs', session.reviewStyle || 'mixed');
  });

  delegate(root, '[data-action="go-learn"]', 'click', () => navigate('#learn'));
  delegate(root, '[data-action="go-weak"]', 'click', () => navigate('#weak'));

  delegate(root, '[data-action="pick-review-style"]', 'click', (_, btn) => {
    const session = getMemorizeState() || {};
    session.reviewStyle = btn.dataset.style;
    setMemorizeState(session);
    renderMemorizeHome();
  });

  delegate(root, '[data-action="pick-practice-mode"]', 'click', (_, btn) => {
    const session = getMemorizeState() || {};
    session.practiceMode = btn.dataset.mode;
    setMemorizeState(session);
    renderMemorizeHome();
  });

  delegate(root, '[data-action="pick-scope"]', 'click', (_, btn) => {
    const session = getMemorizeState() || {};
    session.scope = btn.dataset.scope;
    setMemorizeState(session);
    renderMemorizeHome();
  });

  delegate(root, '[data-action="toggle-shuffle"]', 'change', (e) => {
    const session = getMemorizeState() || {};
    session.shuffle = e.target.checked;
    setMemorizeState(session);
  });

  delegate(root, '[data-action="start-practice"]', 'click', (_, btn) => {
    const session = getMemorizeState() || {};
    startMemorizeSession(
      btn.dataset.scope || session.scope || 'today',
      session.shuffle,
      btn.dataset.mode || session.practiceMode || 'flip'
    );
  });

  delegate(root, '[data-action="pick-practice"]', 'click', (_, btn) => {
    const session = getMemorizeState();
    if (!session || session.picked || session.mode !== 'defPick') return;
    const item = session.queue[session.index];
    session.picked = btn.dataset.value;
    session.pickCorrect = normWord(session.picked) === normWord(item.word);
    renderMemorize();
  });

  delegate(root, '[data-action="next-practice"]', 'click', () => {
    const session = getMemorizeState();
    if (!session || !session.picked) return;
    if (session.index >= session.queue.length - 1) {
      toast('练习完成', 'success');
      const kept = {
        tab: session.tab,
        scope: session.scope,
        shuffle: session.shuffle,
        reviewStyle: session.reviewStyle,
        practiceMode: session.practiceMode,
      };
      resetMemorizeState();
      setMemorizeState(kept);
      renderMemorizeHome();
      return;
    }
    session.index++;
    session.picked = null;
    session.pickCorrect = null;
    renderMemorize();
  });

  delegate(root, '[data-speak]', 'click', (e, btn) => {
    e.stopPropagation();
    if (!isSpeechSupported()) return toast('当前浏览器不支持语音', 'info');
    speakWord(btn.dataset.speak);
  });

  delegate(root, '[data-action="flip"], [data-action="flip-card"]', 'click', (e, el) => {
    if (el.dataset.speak || e.target.closest('[data-speak]')) return;
    const session = getMemorizeState();
    if (session?.mode === 'flip') {
      session.flipped = !session.flipped;
      renderMemorize();
    }
  });

  delegate(root, '[data-action="prev-word"]', 'click', () => {
    const session = getMemorizeState();
    if (!session || session.index === 0) return;
    session.index--;
    session.flipped = false;
    renderMemorize();
  });

  delegate(root, '[data-action="next-word"]', 'click', () => {
    const session = getMemorizeState();
    if (!session) return;
    if (session.index >= session.queue.length - 1) {
      toast('本轮翻卡完成', 'success');
      const kept = { tab: session.tab, scope: session.scope, shuffle: session.shuffle, reviewStyle: session.reviewStyle, practiceMode: session.practiceMode };
      resetMemorizeState();
      setMemorizeState(kept);
      renderMemorizeHome();
      return;
    }
    session.index++;
    session.flipped = false;
    renderMemorize();
  });
}
