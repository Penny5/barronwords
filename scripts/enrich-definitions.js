const fs = require('fs');
const path = require('path');
const { loadCache, saveCache, translateBatch } = require('./lib/translate.js');

const weeksFile = path.join(__dirname, '..', 'data', 'weeks.json');
const data = JSON.parse(fs.readFileSync(weeksFile, 'utf8'));
const cache = loadCache();

const defs = new Set();
for (const info of Object.values(data.wordIndex || {})) {
  if (info.definition) defs.add(info.definition.trim());
}
for (const week of data.weeks || []) {
  for (const day of week.days || []) {
    for (const opt of day.reviewOptions || []) {
      if (opt.text) defs.add(opt.text.trim());
    }
    if (day.idiom?.meaning) defs.add(day.idiom.meaning.trim());
  }
}

const list = [...defs].filter(Boolean);
const missing = list.filter((d) => !cache[d]);
console.log(`Definitions total: ${list.length}, missing zh: ${missing.length}`);

if (!missing.length) {
  console.log('All definitions already translated.');
  process.exit(0);
}

(async () => {
  await translateBatch(missing, cache, 20);
  saveCache(cache);
  console.log(`Saved ${missing.length} definition translations.`);
})();
