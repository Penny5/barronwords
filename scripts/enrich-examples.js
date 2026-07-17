const fs = require('fs');
const path = require('path');
const { loadCache, saveCache, translateBatch } = require('./lib/translate.js');

const DATA_FILE = path.join(__dirname, '..', 'data', 'weeks.json');

const BATCH_SIZE = 20;
const args = process.argv.slice(2);
const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : 0;
const translateOnly = args.includes('--translate-only');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(word) {
  return word.toLowerCase().replace(/[^a-z]/g, '');
}

function answerVariants(answer) {
  return (answer || '')
    .split('|')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

function fillBlank(text, answer) {
  const word = answer.split('|')[0].trim();
  return text.replace(/_{2,}/g, word).replace(/\s+/g, ' ').trim();
}

function splitSentences(text) {
  return (text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function sentenceHasWord(sentence, word) {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'i');
  return re.test(sentence);
}

function sensibleToSentence(text, answer) {
  return text.replace(/\([^)]+\)/g, answer).replace(/\s+/g, ' ').trim();
}

function collectBookExamples(data) {
  const pool = new Map();

  function add(word, sentence, source) {
    if (!word || !sentence) return;
    const key = norm(word);
    if (!pool.has(key)) pool.set(key, []);
    const list = pool.get(key);
    const cleaned = sentence.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 15 || list.some((x) => x.en === cleaned)) return;
    list.push({ en: cleaned, source });
  }

  for (const week of data.weeks) {
    for (const lesson of week.days) {
      if (lesson.type === 'lesson') {
        if (lesson.passage) {
          for (const w of lesson.words || []) {
            for (const s of splitSentences(lesson.passage)) {
              if (sentenceHasWord(s, w.word)) add(w.word, s, 'passage');
            }
          }
        }
        for (const ex of lesson.exercises || []) {
          if (ex.type === 'fillBlank' && ex.answer && ex.text) {
            for (const ans of answerVariants(ex.answer)) {
              add(ans, fillBlank(ex.text, ans), 'fillBlank');
            }
          }
        }
        if (lesson.idiom?.example) {
          for (const w of lesson.words || []) {
            if (sentenceHasWord(lesson.idiom.example, w.word)) {
              add(w.word, lesson.idiom.example, 'idiom');
            }
          }
        }
      }
      if (lesson.type === 'sensible') {
        for (const q of lesson.choiceQuestions || []) {
          if (q.answer && q.text) {
            add(q.answer, sensibleToSentence(q.text, q.answer), 'sensible');
          }
        }
      }
      if (lesson.type === 'wordsearch' && lesson.story) {
        for (const s of splitSentences(lesson.story)) {
          for (const c of lesson.clues || []) {
            if (c.answer && sentenceHasWord(s, c.answer)) add(c.answer, s, 'wordsearch');
          }
        }
      }
    }
  }
  return pool;
}

// 一次词典调用同时取例句和首条释义
async function fetchDictionary(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) return { examples: [], definition: '' };
    const data = await res.json();
    const examples = [];
    let definition = '';
    for (const entry of data) {
      for (const m of entry.meanings || []) {
        for (const d of m.definitions || []) {
          if (!definition && d.definition) definition = d.definition;
          if (d.example) examples.push(d.example);
        }
      }
    }
    return { examples, definition };
  } catch {
    return { examples: [], definition: '' };
  }
}

function makeFallback(word, definition) {
  const w = word.toLowerCase();
  const templates = [
    `The context clearly shows what it means to be ${w}.`,
    `She used the word "${word}" correctly in her essay.`,
    definition ? `To be ${w} is to embody this idea: ${definition}` : `He described the situation as ${w}.`,
  ];
  return templates;
}

// 例句齐全则保留；否则补足。缺释义时一并从词典取。每个单词最多一次词典调用。
async function enrichWord(info, pool) {
  const { word } = info;
  const existingDef = info.definition;
  const existing = info.existing || [];
  const examplesDone = existing.length >= 3 && existing.every((e) => e.zh);

  if (examplesDone) {
    let dictDef = '';
    if (!existingDef) {
      // 例句已全但缺释义：只为释义调一次词典
      dictDef = (await fetchDictionary(word)).definition;
      await sleep(80);
    }
    return { examples: [...existing], definition: existingDef || dictDef };
  }

  const examples = [...(pool.get(norm(word)) || [])];
  const seen = new Set(examples.map((x) => x.en));
  let dictDef = '';

  const dict = await fetchDictionary(word);
  dictDef = dict.definition;
  for (const ex of dict.examples) {
    if (!seen.has(ex)) {
      examples.push({ en: ex, source: 'dictionary' });
      seen.add(ex);
    }
    if (examples.length >= 3) break;
  }
  await sleep(80);

  if (examples.length < 3) {
    for (const t of makeFallback(word, existingDef || dictDef)) {
      if (!seen.has(t)) {
        examples.push({ en: t, source: 'fallback' });
        seen.add(t);
      }
      if (examples.length >= 3) break;
    }
  }

  return { examples: examples.slice(0, 3), definition: existingDef || dictDef };
}

function collectAllWords(data) {
  const map = new Map();
  for (const week of data.weeks) {
    for (const lesson of week.days) {
      if (lesson.type !== 'lesson' || !lesson.words) continue;
      for (const w of lesson.words) {
        const key = norm(w.word);
        if (!map.has(key)) {
          map.set(key, {
            word: w.word,
            definition: w.definition || null,
            existing: w.examples || null,
          });
        } else if (w.definition && !map.get(key).definition) {
          map.get(key).definition = w.definition;
        }
      }
    }
  }
  return map;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const cache = loadCache();
  const pool = translateOnly ? null : collectBookExamples(data);

  let wordEntries = [...collectAllWords(data).entries()];

  if (translateOnly) {
    wordEntries = wordEntries.filter(([, info]) =>
      (info.existing || []).some((e) => e.en && !e.zh)
    );
  } else {
    // 需要处理：缺释义，或例句不足/未译全
    wordEntries = wordEntries.filter(([, info]) => {
      const ex = info.existing || [];
      const examplesDone = ex.length >= 3 && ex.every((e) => e.zh);
      return !info.definition || !examplesDone;
    });
  }

  if (limit > 0) wordEntries = wordEntries.slice(0, limit);

  console.log(`Processing ${wordEntries.length} words...`);

  const resultMap = new Map(); // key -> { examples, definition }

  if (!translateOnly) {
    let i = 0;
    for (const [key, info] of wordEntries) {
      i++;
      process.stdout.write(`[${i}/${wordEntries.length}] ${info.word}... `);
      const r = await enrichWord(info, pool);
      resultMap.set(key, r);
      console.log(`(ex:${r.examples.length}, def:${r.definition ? 'y' : 'n'})`);
    }
  } else {
    for (const [key, info] of wordEntries) {
      resultMap.set(key, { examples: info.existing || [], definition: info.definition || '' });
    }
  }

  const allSentences = new Set();
  for (const { examples } of resultMap.values()) {
    for (const ex of examples) {
      if (ex.en && !cache[ex.en]) allSentences.add(ex.en);
    }
  }

  console.log(`Translating ${allSentences.size} unique sentences...`);
  await translateBatch([...allSentences], cache);
  saveCache(cache);

  for (const result of resultMap.values()) {
    result.examples = result.examples.map((ex) => ({
      en: ex.en,
      zh: cache[ex.en] || ex.zh || '',
      source: ex.source,
    }));
  }

  for (const week of data.weeks) {
    for (const lesson of week.days) {
      if (lesson.type !== 'lesson' || !lesson.words) continue;
      for (const w of lesson.words) {
        const r = resultMap.get(norm(w.word));
        if (r) {
          if (r.examples) w.examples = r.examples;
          if (r.definition) w.definition = r.definition;
        }
      }
    }
  }

  for (const key of Object.keys(data.wordIndex || {})) {
    const r = resultMap.get(norm(key));
    if (r) {
      if (r.examples) data.wordIndex[key].examples = r.examples;
      if (r.definition) data.wordIndex[key].definition = r.definition;
    }
  }

  data.meta.examplesEnrichedAt = new Date().toISOString();

  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(DATA_FILE, json, 'utf8');

  console.log(`Saved to ${DATA_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
