import { mount, delegate, toast } from '../core/dom.js';
import { getCourseData, resetQuizState } from '../core/store.js';
import { navigate } from '../core/router.js';
import { getProgress, getLesson, markTask, tryCompleteDay, getDayTasks, getTasksForLesson } from '../utils/progress.js';
import { enrichWords, enrichReviewWords, enrichIdiom, renderPassageBlock, navigateToLesson } from '../utils/course.js';
import { registerLessonWords } from '../utils/srs.js';
import { speakWord, speakPassage, stopSpeaking, isSpeaking, isSpeechSupported, onSpeakingChange } from '../utils/speech.js';
import {
  shell,
  dayBadge,
  sectionTitle,
  wordCarousel,
  reviewStudyPanel,
  reviewCardInner,
  wordExamplesPanel,
  stickyFooter,
} from '../components/layout.js';
import { escapeHtml } from '../core/dom.js';

let currentWords = [];
let reviewActiveIndex = 0;
let currentPassageText = '';

function passageListenBar() {
  return `
    <div class="passage-card__toolbar">
      <button class="passage-listen" data-action="speak-passage" type="button" aria-label="朗读短文">
        <span class="passage-listen__icon">🔊</span>
        <span class="passage-listen__label">朗读短文</span>
      </button>
    </div>`;
}

function updatePassageListenBtn() {
  const btn = document.getElementById('app')?.querySelector('[data-action="speak-passage"]');
  if (!btn) return;
  const playing = isSpeaking();
  btn.classList.toggle('passage-listen--active', playing);
  btn.querySelector('.passage-listen__icon').textContent = playing ? '⏹' : '🔊';
  btn.querySelector('.passage-listen__label').textContent = playing ? '停止朗读' : '朗读短文';
}

function renderMarkWordsButton(progress, lesson) {
  const taskState = getDayTasks(progress.week, progress.day);
  return `
    <button class="btn btn--soft btn--block passage-read-btn animate-in" data-action="mark-words"
      ${taskState.words ? 'disabled' : ''}>
      ${taskState.words ? '✓ 内容已浏览' : '✓ 标记内容已浏览'}
    </button>`;
}

export function renderLearn() {
  const courseData = getCourseData();
  const progress = getProgress();
  const lesson = getLesson(courseData, progress.week, progress.day);

  if (!lesson) {
    mount(shell({
      title: '学习',
      back: true,
      activeTab: 'learn',
      body: '<p class="empty-state">找不到课程</p>',
    }));
    return;
  }

  stopSpeaking();
  currentPassageText = '';

  let content = '';

  if (lesson.type === 'lesson') {
    currentWords = enrichWords(lesson, courseData);
    currentPassageText = lesson.passage || '';
    registerLessonWords(currentWords);
    const taskState = getDayTasks(progress.week, progress.day);
    const idiom = enrichIdiom(lesson.idiom, courseData);
    content = `
      ${dayBadge(progress.week, progress.day, lesson)}
      ${sectionTitle('今日新词', `<span class="section-head__count">${currentWords.length} 词</span>`)}
      ${wordCarousel(currentWords)}
      ${sectionTitle('阅读短文')}
      <article class="passage-card animate-in">
        ${passageListenBar()}
        <div class="passage-card__body">${renderPassageBlock(lesson.passage, lesson.highlightWords, lesson.footnotes)}</div>
        ${lesson.passageZh ? `<div class="passage-card__zh"><div class="passage-card__zh-label">中文译文</div><p>${escapeHtml(lesson.passageZh)}</p></div>` : ''}
      </article>
      <button class="btn btn--soft btn--block passage-read-btn animate-in" data-action="mark-passage"
        ${taskState.passage ? 'disabled' : ''}>
        ${taskState.passage ? '✓ 今日内容已学完' : '✓ 标记今日内容已学完'}
      </button>
      ${
        idiom
          ? `<section class="idiom-card animate-in">
          <div class="idiom-card__label">Today's Idiom</div>
          <div class="idiom-card__phrase">${escapeHtml(idiom.phrase)}</div>
          <div class="idiom-card__meaning">${escapeHtml(idiom.meaning)}</div>
          ${idiom.meaningZh ? `<div class="idiom-card__meaning-zh">${escapeHtml(idiom.meaningZh)}</div>` : ''}
          <div class="idiom-card__example">${escapeHtml(idiom.example)}</div>
        </section>`
          : ''
      }
    `;
  } else if (lesson.type === 'review') {
    currentWords = enrichReviewWords(lesson, courseData);
    reviewActiveIndex = 0;
    content = `
      ${dayBadge(progress.week, progress.day, lesson)}
      ${reviewStudyPanel(currentWords, reviewActiveIndex)}
    `;
  } else if (lesson.type === 'sensible') {
    currentWords = [];
    content = `
      ${dayBadge(progress.week, progress.day, lesson)}
      ${sectionTitle('辨析选词')}
      ${(lesson.choiceQuestions || [])
        .map((q, i) => `<div class="prompt-card animate-in"><span class="prompt-card__num">${i + 1}</span>${escapeHtml(q.text)}</div>`)
        .join('')}
      ${
        (lesson.idiomQuestions || []).length
          ? `${sectionTitle('习语判断')}${(lesson.idiomQuestions || [])
              .map(
                (q, i) =>
                  `<div class="prompt-card animate-in"><span class="prompt-card__num">${i + 11}</span>${escapeHtml(q.text)}</div>`
              )
              .join('')}`
          : ''
      }
    `;
  } else if (lesson.type === 'wordMatch' || lesson.type === 'partsOfSpeech') {
    currentWords = [];
    const bank = lesson.wordBank || lesson.reviewOptions || [];
    const prompts = lesson.reviewWords || lesson.questions || [];
    content = `
      ${dayBadge(progress.week, progress.day, lesson)}
      ${sectionTitle('词汇表', `<span class="section-head__count">${bank.length} 词</span>`)}
      <div class="review-grid animate-in">
        ${bank
          .map(
            (w) => `
          <div class="review-grid__item">
            <span class="review-grid__num">${w.key}</span>
            <span class="review-grid__word">${escapeHtml(w.word || w.text)}</span>
          </div>`
          )
          .join('')}
      </div>
      ${sectionTitle('题目')}
      ${prompts
        .map(
          (q, i) =>
            `<div class="prompt-card animate-in"><span class="prompt-card__num">${q.id || i + 1}</span>${escapeHtml(q.word || q.text)}</div>`
        )
        .join('')}
    `;
  } else if (lesson.type === 'headlines') {
    currentWords = [];
    content = `
      ${dayBadge(progress.week, progress.day, lesson)}
      ${sectionTitle('词汇表')}
      <div class="review-grid animate-in">
        ${(lesson.wordBank || [])
          .map(
            (w) => `
          <div class="review-grid__item">
            <span class="review-grid__num">${w.key}</span>
            <span class="review-grid__word">${escapeHtml(w.word)}</span>
          </div>`
          )
          .join('')}
      </div>
      ${sectionTitle('头条填空')}
      ${(lesson.questions || [])
        .map((q) => `<div class="prompt-card animate-in"><span class="prompt-card__num">${q.id}</span>${escapeHtml(q.text)}</div>`)
        .join('')}
    `;
  } else if (lesson.type === 'sentenceCompletion') {
    currentWords = [];
    content = `
      ${dayBadge(progress.week, progress.day, lesson)}
      ${sectionTitle('句子填空')}
      ${(lesson.questions || [])
        .map((q) => `<div class="prompt-card animate-in"><span class="prompt-card__num">${q.id}</span>${escapeHtml(q.text)}</div>`)
        .join('')}
    `;
  } else if (lesson.type === 'doubleDuty') {
    currentWords = [];
    content = `
      ${dayBadge(progress.week, progress.day, lesson)}
      <p class="tip-card animate-in">${escapeHtml(lesson.instruction || '')}</p>
      ${sectionTitle('候选词汇', `<span class="section-head__count">${(lesson.words || []).length} 词</span>`)}
      <div class="review-grid animate-in">
        ${(lesson.words || [])
          .map(
            (w) => `
          <div class="review-grid__item">
            <span class="review-grid__num">${w.id}</span>
            <span class="review-grid__word">${escapeHtml(w.word)}</span>
          </div>`
          )
          .join('')}
      </div>
    `;
  } else if (lesson.type === 'wordsearch') {
    currentWords = [];
    currentPassageText = lesson.story || '';
    const taskState = getDayTasks(progress.week, progress.day);
    content = `
      ${dayBadge(progress.week, progress.day, lesson)}
      ${sectionTitle(lesson.storyTitle || '选词故事')}
      <article class="passage-card animate-in story-text">
        ${passageListenBar()}
        <div class="passage-card__en">${escapeHtml(lesson.story || '')}</div>
        ${lesson.storyZh ? `<div class="passage-card__zh"><div class="passage-card__zh-label">中文译文</div><p>${escapeHtml(lesson.storyZh)}</p></div>` : ''}
      </article>
      <button class="btn btn--soft btn--block passage-read-btn animate-in" data-action="mark-passage"
        ${taskState.passage ? 'disabled' : ''}>
        ${taskState.passage ? '✓ 故事已读完' : '✓ 标记故事已读完'}
      </button>
      ${sectionTitle('填空提示')}
      ${(lesson.clues || [])
        .map((c) => `<div class="clue-card animate-in"><strong>${c.id}</strong> 参考 ${escapeHtml(c.hint)}</div>`)
        .join('')}
    `;
  }

  if (getTasksForLesson(lesson).some((t) => t.id === 'words')) {
    content += renderMarkWordsButton(progress, lesson);
  }

  const footer = stickyFooter('<button class="btn btn--primary btn--block" data-action="quiz">开始练习</button>');

  mount(
    shell({
      title: '学习',
      back: true,
      activeTab: 'learn',
      body: `<div class="learn-page">${content}</div>`,
      footer,
    })
  );

  bindLearnEvents();
}

function updateReviewStudio(root, index) {
  if (!currentWords.length || index < 0 || index >= currentWords.length) return;

  reviewActiveIndex = index;
  const word = currentWords[index];
  const card = root.querySelector('[data-review-card]');
  if (card) {
    card.classList.remove('is-flipped');
    card.innerHTML = reviewCardInner(word, index, currentWords.length);
  }

  const counter = root.querySelector('.review-studio__counter');
  if (counter) counter.textContent = `${index + 1} / ${currentWords.length}`;

  const barFill = root.querySelector('.review-studio__bar-fill');
  if (barFill) barFill.style.width = `${((index + 1) / currentWords.length) * 100}%`;

  root.querySelectorAll('[data-review-pick]').forEach((btn) => {
    btn.classList.toggle('review-word-list__item--active', Number(btn.dataset.reviewPick) === index);
  });

  const prevBtn = root.querySelector('[data-review-prev]');
  const nextBtn = root.querySelector('[data-review-next]');
  if (prevBtn) prevBtn.disabled = index === 0;
  if (nextBtn) nextBtn.disabled = index >= currentWords.length - 1;

  const flipBtn = root.querySelector('[data-flip-review]');
  if (flipBtn) flipBtn.textContent = '查看释义';

  const panel = root.querySelector('[data-examples-panel]');
  if (panel) panel.outerHTML = wordExamplesPanel(currentWords, index);

  root.querySelector('.review-word-list__item--active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function bindLearnEvents() {
  const root = document.getElementById('app');
  const courseData = getCourseData();
  const progress = getProgress();

  delegate(root, '[data-action="back"]', 'click', () => {
    stopSpeaking();
    onSpeakingChange(null);
    navigate('#home');
  });
  delegate(root, '[data-action="nav"]', 'click', (_, el) => {
    stopSpeaking();
    onSpeakingChange(null);
    navigate(el.dataset.hash);
  });
  delegate(root, '[data-action="quiz"]', 'click', () => {
    resetQuizState();
    navigate('#quiz');
  });

  delegate(root, '[data-action="mark-passage"]', 'click', () => {
    markTask(progress.week, progress.day, 'passage');
    if (tryCompleteDay(courseData, progress.week, progress.day)) {
      toast('今日任务全部完成！', 'success');
    } else {
      toast('已标记为学完', 'success');
    }
    renderLearn();
  });

  delegate(root, '[data-action="mark-words"]', 'click', () => {
    markTask(progress.week, progress.day, 'words');
    if (tryCompleteDay(courseData, progress.week, progress.day)) {
      toast('今日任务全部完成！', 'success');
    } else {
      toast('已标记内容已浏览', 'success');
    }
    renderLearn();
  });

  delegate(root, '.cross-ref', 'click', (_, btn) => {
    const targetId = btn.dataset.targetId;
    const found = navigateToLesson(courseData, targetId);
    if (!found) {
      toast('找不到对应课程', 'info');
      return;
    }
    resetQuizState();
    toast(`已跳转到 ${found.lesson.title || targetId}`, 'success');
    navigate('#learn');
  });

  delegate(root, '[data-action="speak-passage"]', 'click', () => {
    if (!isSpeechSupported()) {
      toast('当前浏览器不支持语音朗读', 'info');
      return;
    }
    if (isSpeaking()) {
      stopSpeaking();
      updatePassageListenBtn();
      return;
    }
    if (!currentPassageText) {
      toast('暂无短文内容', 'info');
      return;
    }
    if (!speakPassage(currentPassageText)) {
      toast('朗读失败，请重试', 'info');
    }
  });

  onSpeakingChange(() => updatePassageListenBtn());

  delegate(root, '[data-speak]', 'click', (e, btn) => {
    e.stopPropagation();
    if (!isSpeechSupported()) {
      toast('当前浏览器不支持语音', 'info');
      return;
    }
    speakWord(btn.dataset.speak);
  });

  delegate(root, '[data-flip]', 'click', (e, btn) => {
    e.stopPropagation();
    const card = btn.closest('.word-carousel__card');
    if (card) card.classList.toggle('is-flipped');
  });

  delegate(root, '[data-review-pick]', 'click', (_, btn) => {
    updateReviewStudio(root, Number(btn.dataset.reviewPick));
  });

  delegate(root, '[data-review-prev]', 'click', () => {
    updateReviewStudio(root, reviewActiveIndex - 1);
  });

  delegate(root, '[data-review-next]', 'click', () => {
    updateReviewStudio(root, reviewActiveIndex + 1);
  });

  delegate(root, '[data-flip-review]', 'click', () => {
    const card = root.querySelector('[data-review-card]');
    const flipBtn = root.querySelector('[data-flip-review]');
    if (!card || !flipBtn) return;
    card.classList.toggle('is-flipped');
    flipBtn.textContent = card.classList.contains('is-flipped') ? '返回单词' : '查看释义';
  });

  const track = root.querySelector('.word-carousel__track');
  if (track) {
    const updateCarousel = () => {
      const cardWidth = track.querySelector('.word-carousel__card')?.offsetWidth || 1;
      const index = Math.round(track.scrollLeft / (cardWidth + 12));
      root.querySelectorAll('.word-carousel__dot').forEach((dot, i) => {
        dot.classList.toggle('word-carousel__dot--active', i === index);
      });
      const panel = root.querySelector('[data-examples-panel]');
      if (panel && currentWords[index]) {
        panel.outerHTML = wordExamplesPanel(currentWords, index);
      }
    };
    track.addEventListener('scroll', updateCarousel);
  }
}
