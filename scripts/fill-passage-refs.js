/**
 * Fill passage footnotes (click here cross-refs) from cached EPUB XHTML.
 *
 * Usage:
 *   node scripts/fill-passage-refs.js
 *   node scripts/fill-passage-refs.js --dry-run
 */

const fs = require('fs');
const path = require('path');
const { parseLessonFootnotesFromHtml, stripPassageFootnotes } = require('./parse-epub');

const DATA_FILE = path.join(__dirname, '..', 'data', 'weeks.json');
const EPUB_DIR = path.join(__dirname, '..', '.epub-tmp', 'OEBPS');
const dryRun = process.argv.includes('--dry-run');

function main() {
  if (!fs.existsSync(EPUB_DIR)) {
    console.error(`EPUB cache not found: ${EPUB_DIR}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  let updated = 0;

  for (const week of data.weeks || []) {
    for (const day of week.days || []) {
      if (day.type !== 'lesson') continue;

      const xhtmlPath = path.join(EPUB_DIR, `${day.id}.xhtml`);
      if (!fs.existsSync(xhtmlPath)) continue;

      const parsed = parseLessonFootnotesFromHtml(fs.readFileSync(xhtmlPath, 'utf8'), day.id);
      if (!parsed?.footnotes?.length) continue;

      day.footnotes = parsed.footnotes;
      if (day.passage) {
        day.passage = stripPassageFootnotes(day.passage);
      }
      updated++;
      console.log(`  + ${day.id}: ${parsed.footnotes.length} footnote(s)`);
    }
  }

  data.meta = data.meta || {};
  data.meta.footnotesFilledAt = new Date().toISOString();

  console.log(`\n已更新 ${updated} 节课`);

  if (dryRun) {
    console.log('(dry-run，未写入文件)');
    return;
  }

  if (updated) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`已写入 ${DATA_FILE}`);
  }
}

main();
