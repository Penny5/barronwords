import { describe, expect, it, beforeEach } from 'vitest';
import {
  compareWeek,
  weekOrderKey,
  getTasksForLesson,
  markTask,
  tryCompleteDay,
  getTaskProgress,
  importProgressJson,
  exportProgressJson,
  jumpToDay,
  getProgress,
  advanceToNextDay,
  getLesson,
  getTotalDays,
} from '../progress.js';

const mockCourse = {
  weeks: [
    {
      week: 1,
      days: [
        { id: 'w1-d1', week: 1, day: 1, type: 'lesson', words: [], exercises: [] },
        { id: 'w1-d7', week: 1, day: 7, type: 'review', reviewWords: [], reviewOptions: [] },
      ],
    },
    {
      week: 2,
      days: [{ id: 'w2-d1', week: 2, day: 1, type: 'lesson', words: [], exercises: [] }],
    },
  ],
};

describe('weekOrderKey', () => {
  it('orders review weeks after numeric weeks', () => {
    expect(weekOrderKey('A')).toBe(100);
    expect(weekOrderKey('B')).toBe(101);
    expect(weekOrderKey(48)).toBe(48);
  });
});

describe('compareWeek', () => {
  it('sorts numeric weeks before A/B', () => {
    expect(compareWeek(48, 'A')).toBeLessThan(0);
    expect(compareWeek('A', 'B')).toBeLessThan(0);
  });
});

describe('getTasksForLesson', () => {
  it('lesson 含 passage + quiz', () => {
    const tasks = getTasksForLesson({ type: 'lesson' });
    expect(tasks.map((t) => t.id)).toEqual(['passage', 'quiz']);
  });

  it('doubleDuty 含 words + quiz', () => {
    const tasks = getTasksForLesson({ type: 'doubleDuty' });
    expect(tasks.map((t) => t.id)).toEqual(['words', 'quiz']);
  });

  it('wordsearch 含 passage + quiz', () => {
    const tasks = getTasksForLesson({ type: 'wordsearch' });
    expect(tasks.map((t) => t.id)).toEqual(['passage', 'quiz']);
  });
});

describe('任务与进度', () => {
  beforeEach(() => {
    jumpToDay(1, 1);
  });

  it('markTask 持久化到 localStorage', () => {
    markTask(1, 1, 'passage');
    const p = getProgress();
    expect(p.tasks['w1-d1'].passage).toBe(true);
  });

  it('tryCompleteDay 在所有任务完成后标记完成', () => {
    const lesson = getLesson(mockCourse, 1, 1);
    markTask(1, 1, 'passage');
    markTask(1, 1, 'quiz');
    const done = tryCompleteDay(mockCourse, 1, 1);
    expect(done).toBe(true);
    expect(getProgress().completedDays).toContain('w1-d1');
  });

  it('getTaskProgress 统计正确', () => {
    markTask(1, 1, 'passage');
    const lesson = getLesson(mockCourse, 1, 1);
    const prog = getTaskProgress(1, 1, lesson);
    expect(prog).toEqual({ completed: 1, total: 2, tasks: prog.tasks, done: prog.done });
  });
});

describe('进度导入导出', () => {
  it('round-trip 保留 srs 与 weak', () => {
    jumpToDay(2, 1);
    markTask(2, 1, 'quiz');
    const exported = exportProgressJson();
    localStorage.clear();
    importProgressJson(exported);
    const p = getProgress();
    expect(p.week).toBe(2);
    expect(p.tasks['w2-d1'].quiz).toBe(true);
  });

  it('无效 JSON 抛出错误', () => {
    expect(() => importProgressJson('not json')).toThrow();
  });
});

describe('advanceToNextDay', () => {
  it('同周内递增 day', () => {
    jumpToDay(1, 1);
    advanceToNextDay(mockCourse);
    expect(getProgress().day).toBe(7);
  });

  it('周末进入下一周', () => {
    jumpToDay(1, 7);
    advanceToNextDay(mockCourse);
    expect(getProgress().week).toBe(2);
    expect(getProgress().day).toBe(1);
  });
});

describe('getTotalDays', () => {
  it('统计全部天数', () => {
    expect(getTotalDays(mockCourse)).toBe(3);
  });
});
