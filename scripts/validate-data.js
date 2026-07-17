/**
 * Course data integrity checks for weeks.json
 */

const KNOWN_LESSON_TYPES = new Set([
  'lesson',
  'review',
  'sensible',
  'wordsearch',
  'partsOfSpeech',
  'headlines',
  'wordMatch',
  'doubleDuty',
  'sentenceCompletion',
]);

export function validateCourseData(data) {
  const errors = [];
  const warnings = [];
  const types = {};
  const ids = new Set();
  let lessonCount = 0;
  let wordCount = 0;
  let wordsMissingDefinition = 0;

  if (!data?.weeks?.length) {
    errors.push('weeks 数组为空或缺失');
    return { ok: false, errors, warnings, stats: {} };
  }

  for (const week of data.weeks) {
    if (week.week == null) errors.push('存在缺少 week 字段的周');
    if (!week.days?.length) errors.push(`Week ${week.week} 没有 days`);

    for (const day of week.days) {
      lessonCount++;
      types[day.type] = (types[day.type] || 0) + 1;

      if (!day.id) errors.push(`Week ${week.week} Day ${day.day} 缺少 id`);
      else if (ids.has(day.id)) errors.push(`重复 lesson id: ${day.id}`);
      else ids.add(day.id);

      if (day.week !== week.week) {
        errors.push(`${day.id}: week 字段 (${day.week}) 与父级 (${week.week}) 不一致`);
      }
      if (day.day == null) errors.push(`${day.id}: 缺少 day 字段`);
      if (!KNOWN_LESSON_TYPES.has(day.type)) errors.push(`${day.id}: 未知课型 ${day.type}`);

      validateLessonByType(day, errors, warnings, (n) => {
        wordCount += n;
      }, () => {
        wordsMissingDefinition++;
      });
    }
  }

  if (data.meta?.totalWeeks != null && data.meta.totalWeeks !== data.weeks.length) {
    errors.push(`meta.totalWeeks (${data.meta.totalWeeks}) 与实际 (${data.weeks.length}) 不符`);
  }
  if (data.meta?.totalLessons != null && data.meta.totalLessons !== lessonCount) {
    errors.push(`meta.totalLessons (${data.meta.totalLessons}) 与实际 (${lessonCount}) 不符`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      weeks: data.weeks.length,
      lessons: lessonCount,
      types,
      uniqueLessonIds: ids.size,
      wordCount,
      wordsMissingDefinition,
    },
  };
}

function validateLessonByType(day, errors, warnings, addWords, markMissingDef) {
  switch (day.type) {
    case 'lesson':
      if (!day.words?.length) errors.push(`${day.id}: lesson 缺少 words`);
      else {
        addWords(day.words.length);
        for (const w of day.words) {
          if (!w.word) errors.push(`${day.id}: 存在空 word`);
          if (w.definition === null) markMissingDef();
        }
      }
      if (!day.exercises?.length) warnings.push(`${day.id}: lesson 无 exercises`);
      break;
    case 'review':
      if (!day.reviewWords?.length) errors.push(`${day.id}: review 缺少 reviewWords`);
      if (!day.reviewOptions?.length) errors.push(`${day.id}: review 缺少 reviewOptions`);
      break;
    case 'sensible':
      if (!day.choiceQuestions?.length && !day.idiomQuestions?.length) {
        errors.push(`${day.id}: sensible 缺少题目`);
      }
      break;
    case 'wordsearch':
      if (!day.story) warnings.push(`${day.id}: wordsearch 缺少 story`);
      if (!day.clues?.length) errors.push(`${day.id}: wordsearch 缺少 clues`);
      break;
    case 'doubleDuty':
      if (!day.words?.length) errors.push(`${day.id}: doubleDuty 缺少 words`);
      if (!day.answers || !Object.keys(day.answers).length) {
        errors.push(`${day.id}: doubleDuty 缺少 answers`);
      } else {
        const answerWords = new Set(Object.values(day.answers).map((w) => String(w).toLowerCase()));
        const wordSet = new Set((day.words || []).map((w) => w.word.toLowerCase()));
        for (const aw of answerWords) {
          if (!wordSet.has(aw)) errors.push(`${day.id}: answers 中的 "${aw}" 不在 words 列表`);
        }
      }
      break;
    case 'headlines':
      if (!day.questions?.length) errors.push(`${day.id}: headlines 缺少 questions`);
      break;
    case 'wordMatch':
      if (!day.reviewWords?.length) errors.push(`${day.id}: wordMatch 缺少 reviewWords`);
      if (!day.reviewOptions?.length) errors.push(`${day.id}: wordMatch 缺少 reviewOptions`);
      break;
    case 'partsOfSpeech':
      if (!day.wordBank?.length) errors.push(`${day.id}: partsOfSpeech 缺少 wordBank`);
      if (!day.questions?.length) errors.push(`${day.id}: partsOfSpeech 缺少 questions`);
      break;
    case 'sentenceCompletion':
      if (!day.questions?.length) errors.push(`${day.id}: sentenceCompletion 缺少 questions`);
      break;
    default:
      break;
  }
}

const isMain = process.argv[1]?.includes('validate-data');

if (isMain) {
  import('../data/weeks.json', { with: { type: 'json' } }).then((data) => {
    const result = validateCourseData(data.default ?? data);
    console.log('=== 数据校验 ===');
    console.log('统计:', JSON.stringify(result.stats, null, 2));
    if (result.warnings.length) {
      console.log('\n警告 (' + result.warnings.length + '):');
      result.warnings.slice(0, 20).forEach((w) => console.log('  ⚠', w));
      if (result.warnings.length > 20) console.log(`  ... 还有 ${result.warnings.length - 20} 条`);
    }
    if (result.errors.length) {
      console.log('\n错误 (' + result.errors.length + '):');
      result.errors.forEach((e) => console.log('  ✗', e));
      process.exit(1);
    }
    console.log('\n✓ 数据校验通过');
  });
}
