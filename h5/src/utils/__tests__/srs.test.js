import { describe, expect, it } from 'vitest';
import { getDueWords } from '../srs.js';

describe('getDueWords', () => {
  it('returns due words below graduation level', () => {
    const progress = {
      srs: {
        alpha: { word: 'alpha', level: 3, nextReview: '2026-07-16' },
        beta: { word: 'beta', level: 4, nextReview: '2026-07-16' },
        gamma: { word: 'gamma', level: 1, nextReview: '2026-07-20' },
      },
    };

    const due = getDueWords(progress);
    expect(due).toHaveLength(1);
    expect(due[0].word).toBe('alpha');
  });
});
