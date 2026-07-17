/**
 * Fill missing word definitions in data/weeks.json
 *
 * 1. Same-lesson matching (base forms: voraciously -> voracious)
 * 2. Global word/matching index + lemma variants
 * 3. Free Dictionary API for remaining words
 *
 * Usage:
 *   node scripts/fill-definitions.js
 *   node scripts/fill-definitions.js --dry-run
 *   node scripts/fill-definitions.js --local-only
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'weeks.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const localOnly = args.includes('--local-only');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeWord(word) {
  return (word || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

const norm = normalizeWord;

function candidateForms(word) {
  const w = (word || '').toLowerCase();
  const set = new Set([w, norm(w)].filter(Boolean));

  if (w.endsWith('ily')) set.add(w.slice(0, -3) + 'y');
  if (w.endsWith('ally')) set.add(w.slice(0, -4) + 'al');
  if (w.endsWith('ly')) set.add(w.slice(0, -2));

  if (w.endsWith('ied')) set.add(w.slice(0, -3) + 'y');
  if (w.endsWith('ated')) {
    set.add(w.slice(0, -1));
    set.add(w.slice(0, -2));
  }
  if (w.endsWith('ed')) {
    set.add(w.slice(0, -2));
    set.add(w.slice(0, -1));
  }

  if (w.endsWith('ies')) set.add(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) set.add(w.slice(0, -2));
  if (w.endsWith('s') && w.length > 3) set.add(w.slice(0, -1));

  if (w.endsWith('ing')) {
    set.add(w.slice(0, -3));
    set.add(w.slice(0, -3) + 'e');
  }

  return [...set].filter(Boolean);
}

function buildReviewIndex(data) {
  const byWord = new Map();

  for (const week of data.weeks || []) {
    for (const day of week.days || []) {
      if (!day.reviewOptions?.length || !day.reviewWords?.length) continue;

      const opts = Object.fromEntries(day.reviewOptions.map((o) => [o.key, o.text]));

      for (const rw of day.reviewWords) {
        const key = normalizeWord(rw.word);
        if (!key || byWord.has(key)) continue;

        const answers = String(rw.answer || '')
          .split(/[,|]/)
          .map((a) => a.trim())
          .filter(Boolean);

        for (const ans of answers) {
          const def = opts[ans];
          if (def) {
            byWord.set(key, { definition: def, source: 'review' });
            break;
          }
        }
      }
    }
  }

  return byWord;
}

function buildDefinitionIndex(data) {
  const byWord = new Map();

  function add(word, definition, source) {
    if (!word || !definition) return;
    const key = normalizeWord(word);
    if (!key || byWord.has(key)) return;
    byWord.set(key, { definition, source });
  }

  for (const week of data.weeks || []) {
    for (const day of week.days || []) {
      if (day.type !== 'lesson') continue;

      for (const wd of day.words || []) {
        if (wd.definition) add(wd.word, wd.definition, 'word');
      }

      for (const ex of day.exercises || []) {
        if (ex.type === 'matching' && ex.word && ex.correctDefinition) {
          add(ex.word, ex.correctDefinition, 'matching');
        }
      }
    }
  }

  return byWord;
}

function resolveFromIndex(word, byWord, sourcePrefix = 'index') {
  for (const form of candidateForms(word)) {
    const key = normalizeWord(form);
    if (byWord.has(key)) {
      const hit = byWord.get(key);
      return { definition: hit.definition, source: `${sourcePrefix}:${hit.source}` };
    }
  }
  return null;
}

function resolveFromLesson(word, lesson, byWord, reviewIndex) {
  const forms = candidateForms(word).map(normalizeWord);

  for (const ex of lesson.exercises || []) {
    if (ex.type !== 'matching' || !ex.word || !ex.correctDefinition) continue;
    if (forms.includes(normalizeWord(ex.word))) {
      return { definition: ex.correctDefinition, source: 'lesson-matching' };
    }
  }

  const fromReview = resolveFromIndex(word, reviewIndex, 'review');
  if (fromReview) return fromReview;

  const fromIndex = resolveFromIndex(word, byWord);
  if (fromIndex) return fromIndex;

  for (const ex of lesson.exercises || []) {
    if (ex.type !== 'fillBlank' || !ex.answer) continue;
    for (const ans of ex.answer.split('|')) {
      const base = normalizeWord(ans.trim());
      if (!forms.includes(base)) continue;
      const match = (lesson.exercises || []).find(
        (e) =>
          e.type === 'matching' &&
          e.word &&
          normalizeWord(e.word) === base &&
          e.correctDefinition
      );
      if (match) return { definition: match.correctDefinition, source: 'fillBlank-bridge' };
      if (byWord.has(base)) return { ...byWord.get(base), source: 'fillBlank-index' };
    }
  }

  return null;
}

async function fetchDictionary(word) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!res.ok) return '';
    const data = await res.json();
    for (const entry of data) {
      for (const m of entry.meanings || []) {
        for (const d of m.definitions || []) {
          if (d.definition) return d.definition.trim();
        }
      }
    }
    return '';
  } catch {
    return '';
  }
}

async function fetchDefinitionForWord(word) {
  for (const form of candidateForms(word)) {
    const def = await fetchDictionary(form);
    await sleep(150);
    if (def) return { definition: def, source: `dictionary:${form}` };
  }
  return null;
}

function syncWordIndex(data) {
  if (!data.wordIndex) data.wordIndex = {};

  for (const week of data.weeks || []) {
    for (const day of week.days || []) {
      if (day.type !== 'lesson' || !day.words) continue;
      for (const w of day.words) {
        const key = w.word.toLowerCase();
        if (!data.wordIndex[key]) {
          data.wordIndex[key] = {
            word: w.word,
            phonetic: w.phonetic || '',
            week: day.week,
            day: day.day,
            definition: w.definition || null,
          };
        } else if (w.definition && !data.wordIndex[key].definition) {
          data.wordIndex[key].definition = w.definition;
        }
      }
    }
  }
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const byWord = buildDefinitionIndex(data);
  const reviewIndex = buildReviewIndex(data);

  const stats = { local: 0, review: 0, dictionary: 0, stillMissing: 0, samples: [] };
  const missing = [];

  for (const week of data.weeks || []) {
    for (const day of week.days || []) {
      if (day.type !== 'lesson') continue;
      for (const wd of day.words || []) {
        if (wd.definition) continue;
        missing.push({ wd, lesson: day });
      }
    }
  }

  console.log(`Missing definitions: ${missing.length}`);

  for (const { wd, lesson } of missing) {
    const local = resolveFromLesson(wd.word, lesson, byWord, reviewIndex);
    if (local) {
      wd.definition = local.definition;
      byWord.set(normalizeWord(wd.word), { definition: local.definition, source: local.source });
      if (local.source.startsWith('review')) stats.review++;
      else stats.local++;
      continue;
    }

    if (localOnly) {
      stats.stillMissing++;
      if (stats.samples.length < 15) stats.samples.push(wd.word);
      continue;
    }

    const remote = await fetchDefinitionForWord(wd.word);
    if (remote) {
      wd.definition = remote.definition;
      byWord.set(normalizeWord(wd.word), { definition: remote.definition, source: remote.source });
      stats.dictionary++;
      process.stdout.write(`  + ${wd.word}\n`);
    } else {
      stats.stillMissing++;
      if (stats.samples.length < 15) stats.samples.push(wd.word);
    }
  }

  syncWordIndex(data);
  data.meta = data.meta || {};
  data.meta.definitionsFilledAt = new Date().toISOString();

  console.log('\n=== 补全结果 ===');
  console.log(`本地推断: ${stats.local}`);
  console.log(`周复习索引: ${stats.review}`);
  console.log(`词典 API: ${stats.dictionary}`);
  console.log(`仍缺失: ${stats.stillMissing}`);
  if (stats.samples.length) console.log('仍缺失示例:', stats.samples.join(', '));

  if (dryRun) {
    console.log('\n(dry-run，未写入文件)');
    return;
  }

  if (!stats.stillMissing && (stats.local || stats.dictionary)) {
    const backup = DATA_FILE + '.bak';
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(DATA_FILE, backup);
      console.log(`\n已备份 -> ${backup}`);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n已写入 ${DATA_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
