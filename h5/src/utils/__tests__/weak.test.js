import { describe, expect, it, beforeEach } from 'vitest';
import { addWeakWord, getWeakWords, getWeakCount, removeWeakWord, clearWeakWords } from '../weak.js';

describe('weak words', () => {
  beforeEach(() => {
    clearWeakWords();
  });

  it('addWeakWord 累加次数', () => {
    addWeakWord('Impede');
    addWeakWord('impede');
    expect(getWeakCount()).toBe(1);
    expect(getWeakWords()[0].count).toBe(2);
  });

  it('removeWeakWord 删除', () => {
    addWeakWord('alpha');
    removeWeakWord('ALPHA');
    expect(getWeakCount()).toBe(0);
  });

  it('按 count 降序排列', () => {
    addWeakWord('a');
    addWeakWord('b');
    addWeakWord('b');
    expect(getWeakWords().map((w) => w.word)).toEqual(['b', 'a']);
  });
});
