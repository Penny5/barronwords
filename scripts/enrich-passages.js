const fs = require('fs');
const path = require('path');
const { loadCache, saveCache, translateBatch } = require('./lib/translate.js');

const DATA_FILE = path.join(__dirname, '..', 'data', 'weeks.json');

function collectTexts(data) {
  const texts = [];
  for (const week of data.weeks) {
    for (const lesson of week.days) {
      if (lesson.passage) texts.push({ lesson, field: 'passage', zhField: 'passageZh', text: lesson.passage });
      if (lesson.story) texts.push({ lesson, field: 'story', zhField: 'storyZh', text: lesson.story });
    }
  }
  return texts;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const cache = loadCache();
  const items = collectTexts(data);

  const pending = items.filter((item) => !item.lesson[item.zhField]);
  console.log(`Found ${items.length} passages/stories, ${pending.length} need translation`);

  const unique = [...new Set(pending.map((item) => item.text))];
  console.log(`Translating ${unique.length} unique texts...`);
  await translateBatch(unique, cache, 10);
  saveCache(cache);

  let done = 0;
  for (const item of items) {
    const zh = cache[item.text] || item.lesson[item.zhField] || '';
    if (zh) {
      item.lesson[item.zhField] = zh;
      done++;
    }
  }

  data.meta.passagesEnrichedAt = new Date().toISOString();

  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(DATA_FILE, json, 'utf8');

  console.log(`Saved ${done} translations to ${DATA_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
