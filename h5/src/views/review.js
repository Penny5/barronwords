import { mount, delegate, toast } from '../core/dom.js';
import { getCourseData, getReviewState, setReviewState, resetReviewState } from '../core/store.js';
import { navigate } from '../core/router.js';
import { rateWord, normWord } from '../utils/srs.js';
import { addWeakWord, removeWeakWord } from '../utils/weak.js';
import { getWordInfo } from '../utils/word.js';
import { speakWord, isSpeechSupported } from '../utils/speech.js';
import { formatReviewLabel, isMastered } from '../utils/vocab.js';
import { buildMixedReviewItems, buildDefPickItems } from '../utils/def-pick.js';
import {
  renderReviewProgress,
  renderFlipCard,
  renderDefPickCard,
  renderRatingPanel,
} from '../components/review-ui.js';
import { shell, stickyFooter } from '../components/layout.js';

const MAX_REQUEUE = 1;

export function startReviewSession(words, mode = 'srs', reviewStyle = 'mixed') {
  const courseData = getCourseData();
  let queue;

  if (reviewStyle === 'defPick') {
    queue = buildDefPickItems(courseData, words);
  } else if (reviewStyle === 'mixed') {
    queue = buildMixedReviewItems(courseData, words);
  } else {
    queue = words.map((w) => {
      const word = w.word || w;
      return { ...getWordInfo(courseData, word), _ref: w, cardType: 'flip' };
    });
  }

  if (!queue.length) {
    toast(mode === 'weak' ? '薄弱词本为空' : '暂无到期复习', 'info');
    return;
  }

  setReviewState({
    queue,
    index: 0,
    mode,
    reviewStyle,
    flipped: false,
    picked: null,
    pickCorrect: null,
    requeues: {},
    stats: { know: 0, fuzzy: 0, dont_know: 0, graduated: 0 },
    totalSeen: queue.length,
  });
  navigate('#review');
}

export function renderReview() {
  const session = getReviewState();

  if (!session?.queue?.length) {
    mount(
      shell({
        title: '间隔复习',
        back: true,
        activeTab: 'memorize',
        body: `
          <div class="review-empty animate-in">
            <p class="review-empty__icon">📚</p>
            <h2>暂无复习任务</h2>
            <p>学过的词会按遗忘曲线出现在词汇本里。</p>
            <button class="btn btn--primary btn--block" data-action="go-vocab">去词汇本</button>
          </div>
        `,
      })
    );
    bindReviewEvents();
    return;
  }

  if (session.index >= session.queue.length) {
    const { know, fuzzy, dont_know, graduated } = session.stats;
    mount(
      shell({
        title: '复习完成',
        back: true,
        activeTab: 'memorize',
        body: `
          <div class="review-done animate-in">
            <p class="review-done__icon">✓</p>
            <h2>本轮复习完成</h2>
            <p class="review-done__sub">共复习 ${session.totalSeen} 词${session.requeued ? `，不熟词加练 ${session.requeued} 次` : ''}</p>
            <div class="review-done__stats">
              <span class="tag tag--know">认识 ${know}</span>
              <span class="tag tag--fuzzy">模糊 ${fuzzy}</span>
              <span class="tag tag--dont">不熟 ${dont_know}</span>
              ${graduated ? `<span class="tag tag--grad">毕业 ${graduated}</span>` : ''}
            </div>
            <button class="btn btn--primary btn--block" data-action="go-vocab">返回词汇本</button>
          </div>
        `,
      })
    );
    bindReviewEvents();
    return;
  }

  const item = session.queue[session.index];
  const srsRef = item._ref || {};
  const levelHint = srsRef.level !== undefined ? `Lv.${srsRef.level + 1}` : '';
  const isDefPick = item.cardType === 'defPick';
  const canRate = isDefPick ? !!session.picked : session.flipped;
  const tip = isDefPick ? '看释义，选出对应单词' : '先回忆词义，再翻面核对';
  const modeTag = isDefPick ? '看义选词' : '看词翻卡';

  mount(
    shell({
      title: session.mode === 'weak' ? '薄弱词专练' : '间隔复习',
      back: true,
      activeTab: 'memorize',
      body: `
        <div class="review-session">
          ${renderReviewProgress(session.index, session.queue.length, levelHint)}
          <div class="review-mode-tag animate-in">${modeTag}</div>
          <p class="review-session__tip animate-in">${tip}</p>
          ${isDefPick ? renderDefPickCard(item, session) : renderFlipCard(item, session.flipped)}
          ${renderRatingPanel({ canRate, isDefPick })}
        </div>
      `,
      footer:
        session.mode === 'srs'
          ? stickyFooter(`<button class="btn btn--ghost btn--block" data-action="skip-review" type="button">暂时跳过</button>`)
          : '',
    })
  );
  bindReviewEvents();
}

function handleRate(session, item, rating) {
  const key = normWord(item.word);
  let entry = null;

  if (session.mode === 'srs') {
    const wasMastered = item._ref && isMastered(item._ref);
    entry = rateWord(item.word, rating);
    if (!wasMastered && entry && isMastered(entry)) {
      session.stats.graduated++;
      toast(`${item.word} 已毕业 🎓`, 'success');
    }
  }

  if (rating === 'know') {
    session.stats.know++;
    removeWeakWord(item.word);
  } else if (rating === 'fuzzy') {
    session.stats.fuzzy++;
    addWeakWord(item.word, 'review');
  } else {
    session.stats.dont_know++;
    addWeakWord(item.word, 'review');
  }

  if (rating !== 'know') {
    const count = session.requeues[key] || 0;
    if (count < MAX_REQUEUE) {
      session.queue.push({ ...item, _ref: entry || item._ref });
      session.requeues[key] = count + 1;
      session.requeued = (session.requeued || 0) + 1;
    }
  }

  if (session.mode === 'srs' && entry && rating === 'know') {
    const label = formatReviewLabel(entry.nextReview);
    if (label !== '今天') toast(`下次复习：${label}`, 'info');
  }

  session.index++;
  session.flipped = false;
  session.picked = null;
  session.pickCorrect = null;
}

function bindReviewEvents() {
  const root = document.getElementById('app');

  delegate(root, '[data-action="back"]', 'click', () => {
    resetReviewState();
    navigate('#memorize');
  });
  delegate(root, '[data-action="go-home"]', 'click', () => {
    resetReviewState();
    navigate('#home');
  });
  delegate(root, '[data-action="go-vocab"]', 'click', () => {
    resetReviewState();
    navigate('#memorize');
  });
  delegate(root, '[data-action="skip-review"]', 'click', () => {
    resetReviewState();
    navigate('#memorize');
  });
  delegate(root, '[data-action="nav"]', 'click', (_, el) => navigate(el.dataset.hash));

  delegate(root, '[data-speak]', 'click', (e, btn) => {
    e.stopPropagation();
    if (!isSpeechSupported()) return toast('当前浏览器不支持语音', 'info');
    speakWord(btn.dataset.speak);
  });

  delegate(root, '[data-action="flip"], [data-action="flip-card"]', 'click', (e, el) => {
    if (el.dataset.speak || e.target.closest('[data-speak]')) return;
    const session = getReviewState();
    if (session) {
      session.flipped = !session.flipped;
      renderReview();
    }
  });

  delegate(root, '[data-action="pick-word"]', 'click', (_, btn) => {
    const session = getReviewState();
    if (!session || session.picked) return;

    const item = session.queue[session.index];
    session.picked = btn.dataset.value;
    session.pickCorrect = normWord(session.picked) === normWord(item.word);
    renderReview();
  });

  delegate(root, '[data-action="rate"]', 'click', (_, btn) => {
    const session = getReviewState();
    if (!session) return;

    const item = session.queue[session.index];
    const isDefPick = item.cardType === 'defPick';
    if (isDefPick ? !session.picked : !session.flipped) return;

    handleRate(session, item, btn.dataset.rate);
    setReviewState(session);
    renderReview();
  });
}

export function renderReviewHome() {
  navigate('#memorize');
}
