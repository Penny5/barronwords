import { mount, delegate, toast, escapeHtml } from '../core/dom.js';
import { getCourseData } from '../core/store.js';
import { navigate } from '../core/router.js';
import { getWeakWords, removeWeakWord, clearWeakWords } from '../utils/weak.js';
import { getWordInfo } from '../utils/word.js';
import { startReviewSession } from './review.js';
import { shell, sectionTitle } from '../components/layout.js';
import { speakWord, isSpeechSupported } from '../utils/speech.js';

export function renderWeak() {
  const weakList = getWeakWords();
  const courseData = getCourseData();

  const body =
    weakList.length === 0
      ? `
        <div class="weak-empty animate-in">
          <p class="weak-empty__icon">🎯</p>
          <h2>薄弱词本为空</h2>
          <p>练习做错或复习标记「模糊/不熟」的单词会自动收录到这里。</p>
          <button class="btn btn--primary btn--block" data-action="go-home">返回首页</button>
        </div>
      `
      : `
        <section class="weak-header animate-in">
          <p class="weak-header__count">${weakList.length} 个薄弱词</p>
          <button class="btn btn--primary" data-action="practice-weak">开始专练</button>
        </section>
        ${sectionTitle('单词列表')}
        <ul class="weak-list animate-in">
          ${weakList
            .map((w) => {
              const info = getWordInfo(courseData, w.word);
              return `
            <li class="weak-item">
              <div class="weak-item__main">
                <div class="weak-item__word">${escapeHtml(w.word)}</div>
                <div class="weak-item__def">${escapeHtml(info.definition || '')}</div>
                <div class="weak-item__meta">错题 ${w.count} 次 · ${w.reason === 'quiz' ? '练习' : '复习'}</div>
              </div>
              <div class="weak-item__actions">
                <button class="speak-btn speak-btn--sm" data-speak="${escapeHtml(w.word)}" type="button">🔊</button>
                <button class="weak-item__remove" data-action="remove" data-word="${escapeHtml(w.word)}" type="button">移除</button>
              </div>
            </li>`;
            })
            .join('')}
        </ul>
        <button class="btn btn--ghost btn--block weak-clear" data-action="clear-weak">清空薄弱词本</button>
      `;

  mount(shell({ title: '薄弱词本', back: true, activeTab: 'weak', body }));
  bindWeakEvents();
}

function bindWeakEvents() {
  const root = document.getElementById('app');

  delegate(root, '[data-action="back"]', 'click', () => navigate('#home'));
  delegate(root, '[data-action="go-home"]', 'click', () => navigate('#home'));
  delegate(root, '[data-action="nav"]', 'click', (_, el) => navigate(el.dataset.hash));

  delegate(root, '[data-action="practice-weak"]', 'click', () => {
    startReviewSession(getWeakWords(), 'weak');
  });

  delegate(root, '[data-action="remove"]', 'click', (_, btn) => {
    removeWeakWord(btn.dataset.word);
    toast('已移除', 'success');
    renderWeak();
  });

  delegate(root, '[data-action="clear-weak"]', 'click', () => {
    if (confirm('确定清空薄弱词本吗？')) {
      clearWeakWords();
      toast('已清空', 'success');
      renderWeak();
    }
  });

  delegate(root, '[data-speak]', 'click', (_, btn) => {
    if (!isSpeechSupported()) return toast('当前浏览器不支持语音', 'info');
    speakWord(btn.dataset.speak);
  });
}
