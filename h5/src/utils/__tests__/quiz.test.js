import { describe, expect, it } from 'vitest';
import { checkFillAnswer, gradeOneAnswer, normalizeAnswer } from '../quiz.js';

describe('normalizeAnswer', () => {
  it('lowercases and strips non-letters', () => {
    expect(normalizeAnswer(' Impede! ')).toBe('impede');
  });
});

describe('checkFillAnswer', () => {
  it('accepts pipe-separated variants', () => {
    expect(checkFillAnswer('impede', 'impede|hinder')).toBe(true);
  });

  it('accepts simple plural mismatch', () => {
    expect(checkFillAnswer('words', 'word')).toBe(true);
  });
});

describe('gradeOneAnswer', () => {
  it('grades letter mode by normalized key', () => {
    const result = gradeOneAnswer({ answer: 'b' }, 'B', 'letter');
    expect(result.correct).toBe(true);
  });

  it('grades fill mode with variants', () => {
    const result = gradeOneAnswer({ answer: 'exploit' }, 'Exploit', 'fill');
    expect(result.correct).toBe(true);
  });
});
