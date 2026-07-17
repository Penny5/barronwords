import { getProgress } from './progress.js';
import { getWordInfo } from './word.js';
import { escapeHtml } from '../core/dom.js';
import { dateStr, formatReviewLabel } from './date.js';

export function isMastered(entry) {
  return entry.level >= 4;
}

export function enrichSrsEntry(courseData, entry, today = dateStr()) {
  const info = getWordInfo(courseData, entry.word);
  const mastered = isMastered(entry);
  return {
    ...entry,
    ...info,
    mastered,
    isDue: !mastered && entry.nextReview <= today,
    reviewLabel: mastered ? '已毕业' : formatReviewLabel(entry.nextReview, today),
  };
}

export function getVocabEntries(courseData, filter = 'all', progress = getProgress()) {
  const today = dateStr();
  let entries = Object.values(progress.srs || {}).map((e) => enrichSrsEntry(courseData, e, today));

  if (filter === 'due') entries = entries.filter((e) => e.isDue);
  else if (filter === 'mastered') entries = entries.filter((e) => e.mastered);
  else if (filter === 'learning') entries = entries.filter((e) => !e.mastered);

  return entries.sort((a, b) => {
    if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
    return a.nextReview.localeCompare(b.nextReview) || a.word.localeCompare(b.word);
  });
}

export function getVocabStats(courseData, progress = getProgress()) {
  const all = getVocabEntries(courseData, 'all', progress);
  const total = all.length;
  const mastered = all.filter((e) => e.mastered).length;
  return {
    total,
    due: all.filter((e) => e.isDue).length,
    learning: all.filter((e) => !e.mastered).length,
    mastered,
    masteryPct: total ? Math.round((mastered / total) * 100) : 0,
  };
}

export function renderSrsLevelDots(level, maxLevel = 5) {
  const filled = Math.min(level + 1, maxLevel);
  return `
    <span class="srs-dots" aria-label="记忆等级 ${filled}/${maxLevel}">
      ${Array.from({ length: maxLevel }, (_, i) => `<span class="srs-dots__dot ${i < filled ? 'srs-dots__dot--on' : ''}"></span>`).join('')}
    </span>`;
}

export function renderVocabList(entries, { action = '', emptyText = '暂无单词', tab = '' } = {}) {
  if (!entries.length) {
    const icons = { due: '⏰', learning: '📝', mastered: '🎓' };
    return `
      <div class="vocab-empty-state">
        <div class="vocab-empty-state__icon">${icons[tab] || '📖'}</div>
        <p class="vocab-empty-state__title">${emptyText}</p>
        ${tab === 'due' ? '<p class="vocab-empty-state__hint">继续学习新词，系统会按遗忘曲线安排复习</p><button class="btn btn--soft btn--sm" data-action="go-learn" type="button">去学习新词</button>' : ''}
        ${tab === 'learning' && !entries.length ? '<button class="btn btn--soft btn--sm" data-action="go-learn" type="button">去学习新词</button>' : ''}
      </div>`;
  }

  return `
    <ul class="vocab-list">
      ${entries
        .map(
          (e) => `
        <li class="vocab-item ${e.isDue ? 'vocab-item--due' : ''} ${e.mastered ? 'vocab-item--done' : ''}">
          <div class="vocab-item__main">
            <div class="vocab-item__row">
              <span class="vocab-item__word">${escapeHtml(e.word)}</span>
              ${e.phonetic ? `<span class="vocab-item__phonetic">${escapeHtml(e.phonetic)}</span>` : ''}
            </div>
            <div class="vocab-item__def">${escapeHtml((e.definition || '').slice(0, 56))}${(e.definition || '').length > 56 ? '…' : ''}</div>
            ${!e.mastered ? renderSrsLevelDots(e.level) : ''}
          </div>
          <span class="vocab-item__badge ${e.mastered ? 'vocab-item__badge--done' : e.isDue ? 'vocab-item__badge--due' : ''}">${escapeHtml(e.reviewLabel)}</span>
          ${action ? `<button class="speak-btn speak-btn--sm" data-speak="${escapeHtml(e.word)}" type="button" aria-label="发音">🔊</button>` : ''}
        </li>`
        )
        .join('')}
    </ul>`;
}

export { formatReviewLabel };
