import { describe, expect, it } from 'vitest';
import { validateCourseData } from '../../../../scripts/validate-data.js';
import courseData from '../../../../data/weeks.json';

describe('weeks.json 数据完整性', () => {
  const result = validateCourseData(courseData);

  it('meta 与实际周数/课数一致', () => {
    expect(result.stats.weeks).toBe(48);
    expect(result.stats.lessons).toBe(303);
    expect(courseData.meta.totalWeeks).toBe(48);
    expect(courseData.meta.totalLessons).toBe(303);
  });

  it('无结构性错误', () => {
    if (!result.ok) {
      console.error(result.errors.slice(0, 10));
    }
    expect(result.errors).toEqual([]);
  });

  it('覆盖全部已知课型', () => {
    expect(result.stats.types.lesson).toBeGreaterThan(0);
    expect(result.stats.types.review).toBe(48);
    expect(result.stats.types.wordsearch).toBe(48);
    expect(result.stats.types.doubleDuty).toBe(1);
  });

  it('lesson id 全部唯一', () => {
    expect(result.stats.uniqueLessonIds).toBe(result.stats.lessons);
  });
});
