import { escapeHtml } from '../core/dom.js';

export function renderReviewProgress(index, total, extra = '') {
  const pct = total ? Math.round((index / total) * 100) : 0;
  return `
    <div class="review-progress animate-in">
      <div class="review-progress__bar"><div class="review-progress__fill" style="width:${pct}%"></div></div>
      <span class="review-progress__text">${index + 1} / ${total}${extra ? ` · ${extra}` : ''}</span>
    </div>`;
}

export function renderExamples(item, limit = 2) {
  const examples = item.examples || [];
  if (!examples.length) return '';
  return `
    <div class="review-card__examples">
      ${examples
        .slice(0, limit)
        .map(
          (ex) => `
        <p class="review-card__ex">
          <em>${escapeHtml(ex.en)}</em>
          ${ex.zh ? `<br>${escapeHtml(ex.zh)}` : ''}
        </p>`
        )
        .join('')}
    </div>`;
}

export function renderFlipCard(item, flipped) {
  return `
    <article class="review-card animate-in ${flipped ? 'is-flipped' : ''} memorize-card" data-action="flip-card">
      <div class="review-card__inner">
        <div class="review-card__face review-card__face--front">
          <div class="review-card__head">
            <h2 class="review-card__word">${escapeHtml(item.word)}</h2>
            <button class="speak-btn" data-speak="${escapeHtml(item.word)}" type="button">🔊</button>
          </div>
          <p class="review-card__phonetic">${escapeHtml(item.phonetic || '')}</p>
          <p class="memorize-card__hint">点击卡片查看释义</p>
        </div>
        <div class="review-card__face review-card__face--back">
          <p class="review-card__def">${escapeHtml(item.definition || '暂无释义')}</p>
          ${renderExamples(item)}
          <p class="memorize-card__hint">点击返回单词</p>
        </div>
      </div>
    </article>`;
}

export function renderDefPickCard(item, { picked, pickCorrect }, pickAction = 'pick-word') {
  const showResult = picked !== null;
  return `
    <div class="def-pick-card animate-in ${showResult ? (pickCorrect ? 'def-pick-card--ok' : 'def-pick-card--bad') : ''}">
      <p class="def-pick-card__def">${escapeHtml(item.definition || '暂无释义')}</p>
      <div class="choice-list">
        ${(item.choices || [])
          .map(
            (c) => `
          <button type="button" class="choice-item ${picked === c ? 'choice-item--on' : ''} ${showResult && c === item.word ? 'choice-item--correct' : ''} ${showResult && picked === c && !pickCorrect ? 'choice-item--wrong' : ''}"
            data-action="${pickAction}" data-value="${escapeHtml(c)}" ${showResult ? 'disabled' : ''}>${escapeHtml(c)}</button>`
          )
          .join('')}
      </div>
      ${
        showResult
          ? `<p class="pick-feedback ${pickCorrect ? 'pick-feedback--ok' : 'pick-feedback--bad'}">
          ${pickCorrect ? '✓ 选对了' : `✗ 正确答案：${escapeHtml(item.word)}`}
          <button class="speak-btn speak-btn--sm" data-speak="${escapeHtml(item.word)}" type="button">🔊</button>
        </p>`
          : ''
      }
    </div>`;
}

export function renderRatingPanel({ canRate, isDefPick }) {
  return `
    <div class="rating-panel animate-in ${canRate ? '' : 'rating-panel--locked'}">
      <p class="rating-panel__hint">${canRate ? '掌握得怎么样？' : isDefPick ? '先选出单词' : '翻面后再评分'}</p>
      <div class="rating-btns">
        <button class="rating-btn rating-btn--know" data-action="rate" data-rate="know" ${canRate ? '' : 'disabled'}>认识</button>
        <button class="rating-btn rating-btn--fuzzy" data-action="rate" data-rate="fuzzy" ${canRate ? '' : 'disabled'}>模糊</button>
        <button class="rating-btn rating-btn--dont" data-action="rate" data-rate="dont_know" ${canRate ? '' : 'disabled'}>不熟</button>
      </div>
    </div>`;
}
