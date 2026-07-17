/**
 * Fill missing lesson exercises in data/weeks.json from cached EPUB XHTML.
 *
 * Some lessons store passage/words inside div.chapter but exercises in a sibling
 * div.story (or use hang-1 class names). parse-epub.js now handles both; this
 * script patches existing weeks.json without a full re-parse.
 *
 * Usage:
 *   node scripts/fill-exercises.js
 *   node scripts/fill-exercises.js --dry-run
 */

const fs = require('fs');
const path = require('path');
const { applyExerciseAnswers, parseLessonExercisesFromHtml } = require('./parse-epub');

const DATA_FILE = path.join(__dirname, '..', 'data', 'weeks.json');
const EPUB_DIR = path.join(__dirname, '..', '.epub-tmp', 'OEBPS');
const dryRun = process.argv.includes('--dry-run');

function findEmptyExerciseLessons(data) {
  const lessons = [];
  for (const week of data.weeks || []) {
    for (const day of week.days || []) {
      if (day.type === 'lesson' && (!day.exercises || !day.exercises.length)) {
        lessons.push(day);
      }
    }
  }
  return lessons;
}

function addFillBlankExamples(words, exercises) {
  for (const ex of exercises) {
    if (ex.type !== 'fillBlank' || !ex.text || !ex.answer) continue;
    const answer = ex.answer.split('|')[0].trim().toLowerCase();
    const wordEntry = (words || []).find((w) => w.word.toLowerCase() === answer);
    if (!wordEntry) continue;
    if (!wordEntry.examples) wordEntry.examples = [];
    const hasFill = wordEntry.examples.some((e) => e.source === 'fillBlank');
    if (hasFill) continue;
    wordEntry.examples.unshift({
      en: ex.text.replace(/_{2,}/g, answer),
      zh: '',
      source: 'fillBlank',
    });
  }
}

function main() {
  if (!fs.existsSync(EPUB_DIR)) {
    console.error(`EPUB cache not found: ${EPUB_DIR}`);
    console.error('Run npm run parse first (requires book.epub) or extract EPUB to .epub-tmp/OEBPS');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const emptyLessons = findEmptyExerciseLessons(data);

  console.log(`Lessons missing exercises: ${emptyLessons.length}`);

  const stats = { filled: 0, skipped: 0, missingFile: 0, stillEmpty: [] };

  for (const lesson of emptyLessons) {
    const xhtmlPath = path.join(EPUB_DIR, `${lesson.id}.xhtml`);
    if (!fs.existsSync(xhtmlPath)) {
      stats.missingFile++;
      stats.stillEmpty.push(lesson.id);
      console.warn(`  ! ${lesson.id}: xhtml not found`);
      continue;
    }

    const parsed = parseLessonExercisesFromHtml(fs.readFileSync(xhtmlPath, 'utf8'), lesson.id);
    if (!parsed?.exercises?.length) {
      stats.skipped++;
      stats.stillEmpty.push(lesson.id);
      console.warn(`  ! ${lesson.id}: no exercises parsed`);
      continue;
    }

    applyExerciseAnswers(parsed.exercises, lesson.answers);
    lesson.exercises = parsed.exercises;
    if (!lesson.idiom && parsed.idiom) lesson.idiom = parsed.idiom;
    addFillBlankExamples(lesson.words, parsed.exercises);

    stats.filled++;
    console.log(`  + ${lesson.id}: ${parsed.exercises.length} exercises`);
  }

  data.meta = data.meta || {};
  data.meta.exercisesFilledAt = new Date().toISOString();

  console.log('\n=== 补全结果 ===');
  console.log(`已补全: ${stats.filled}`);
  console.log(`无 xhtml: ${stats.missingFile}`);
  console.log(`解析失败: ${stats.skipped}`);
  if (stats.stillEmpty.length) console.log('仍缺失:', stats.stillEmpty.join(', '));

  if (dryRun) {
    console.log('\n(dry-run，未写入文件)');
    return;
  }

  if (stats.filled) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`\n已写入 ${DATA_FILE}`);
  }
}

main();
