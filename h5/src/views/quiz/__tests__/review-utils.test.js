import { describe, expect, it } from 'vitest';
import { getVisibleDefOptions, isDefTakenByOther, setReviewPhase } from '../review-utils.js';

const baseState = {
  reviewPhase: 'vocab',
  reviewDefFilter: 'all',
  reviewItems: [
    { id: 1, word: 'a', answer: 'x' },
    { id: 2, word: 'b', answer: 'y' },
  ],
  vocabDefOptions: [
    { key: 'x', text: 'def x' },
    { key: 'y', text: 'def y' },
    { key: 'z', text: 'def z' },
  ],
  itemResults: {
    2: { correct: true },
  },
};

describe('isDefTakenByOther', () => {
  it('marks defs correctly matched by other items', () => {
    expect(isDefTakenByOther(baseState, 'y', 1)).toBe(true);
    expect(isDefTakenByOther(baseState, 'x', 1)).toBe(false);
  });
});

describe('getVisibleDefOptions', () => {
  it('filters taken defs when available-only mode is on', () => {
    const state = { ...baseState, reviewDefFilter: 'available' };
    const options = getVisibleDefOptions(state, 1);
    expect(options.map((o) => o.key)).toEqual(['x', 'z']);
  });
});

describe('setReviewPhase', () => {
  it('跳转到第一个未答题', () => {
    const state = {
      reviewPhase: 'vocab',
      reviewItems: [
        { id: 1, answer: 'a' },
        { id: 2, answer: 'b' },
        { id: 3, answer: 'c' },
      ],
      itemResults: { 1: { correct: true } },
    };
    setReviewPhase(state, 'vocab');
    expect(state.reviewIndex).toBe(1);
  });
});
