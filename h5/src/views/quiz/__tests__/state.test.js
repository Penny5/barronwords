import { describe, expect, it, beforeEach } from 'vitest';
import { setCourseData } from '../../../core/store.js';
import { jumpToDay } from '../../../utils/progress.js';
import { prepareQuizState, getQuizTotal, findQuizItem, getItemResult } from '../state.js';

const doubleDutyLesson = {
  id: 'w28-d6',
  week: 28,
  day: 6,
  type: 'doubleDuty',
  words: [
    { id: 1, word: 'hoard' },
    { id: 7, word: 'sage' },
    { id: 12, word: 'senile' },
  ],
  answers: { 1: 'hoard', 7: 'sage' },
};

const mockCourse = {
  weeks: [{ week: 28, days: [doubleDutyLesson] }],
};

describe('prepareQuizState', () => {
  beforeEach(() => {
    setCourseData(mockCourse);
    jumpToDay(28, 6);
  });

  it('doubleDuty 生成 yes/no 题目', () => {
    const state = prepareQuizState();
    expect(state.doubleDutyItems).toHaveLength(3);
    expect(state.doubleDutyItems.find((i) => i.word === 'hoard').answer).toBe('yes');
    expect(state.doubleDutyItems.find((i) => i.word === 'senile').answer).toBe('no');
  });

  it('getQuizTotal 返回 doubleDuty 题数', () => {
    const state = prepareQuizState();
    expect(getQuizTotal(state)).toBe(3);
  });

  it('findQuizItem 定位 doubleDuty 题目', () => {
    const state = prepareQuizState();
    const found = findQuizItem(state, 7);
    expect(found.item.word).toBe('sage');
    expect(found.mode).toBe('letter');
  });
});

describe('getItemResult', () => {
  it('支持数字与字符串 id', () => {
    const state = { itemResults: { 1: { correct: true } } };
    expect(getItemResult(state, 1)?.correct).toBe(true);
    expect(getItemResult(state, '1')?.correct).toBe(true);
  });
});
