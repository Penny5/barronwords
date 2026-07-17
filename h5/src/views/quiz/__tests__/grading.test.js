import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../core/dom.js', () => ({ toast: vi.fn() }));

import { toast } from '../../../core/dom.js';
import { setCourseData } from '../../../core/store.js';
import { jumpToDay, getProgress } from '../../../utils/progress.js';
import { checkQuizItem, getQuizFooterInner } from '../grading.js';
import { prepareQuizState } from '../state.js';

const doubleDutyLesson = {
  id: 'w28-d6',
  week: 28,
  day: 6,
  type: 'doubleDuty',
  words: [
    { id: 1, word: 'hoard' },
    { id: 2, word: 'senile' },
  ],
  answers: { 1: 'hoard' },
};

const mockCourse = {
  weeks: [{ week: 28, days: [doubleDutyLesson] }],
};

describe('quiz grading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCourseData(mockCourse);
    jumpToDay(28, 6);
  });

  describe('checkQuizItem', () => {
    it('答对全部题目后 submitted 且 passed', () => {
      const state = prepareQuizState();
      state.userAnswers[1] = 'yes';
      state.userAnswers[2] = 'no';
      checkQuizItem(state, 1);
      checkQuizItem(state, 2);
      expect(state.submitted).toBe(true);
      expect(state.passed).toBe(true);
      expect(state.score).toBe(2);
      expect(getProgress().tasks['w28-d6'].quiz).toBe(true);
      expect(toast).toHaveBeenCalled();
    });

    it('未答完不 submitted', () => {
      const state = prepareQuizState();
      state.userAnswers[1] = 'yes';
      checkQuizItem(state, 1);
      expect(state.submitted).toBe(false);
    });

    it('已判题题目不重复判', () => {
      const state = prepareQuizState();
      state.userAnswers[1] = 'yes';
      checkQuizItem(state, 1);
      state.userAnswers[1] = 'no';
      checkQuizItem(state, 1);
      expect(state.itemResults[1].correct).toBe(true);
    });
  });

  describe('getQuizFooterInner', () => {
    it('未提交时显示进度', () => {
      const state = prepareQuizState();
      state.itemResults[1] = { correct: true };
      const html = getQuizFooterInner(state);
      expect(html).toContain('已判题 1 / 2');
    });

    it('通过后显示分数', () => {
      const state = prepareQuizState();
      Object.assign(state, { submitted: true, score: 2, total: 2, scorePercent: 100, passed: true });
      const html = getQuizFooterInner(state);
      expect(html).toContain('score-panel--pass');
    });
  });
});
