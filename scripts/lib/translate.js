const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'translate-cache.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let edgeToken = null;
let tokenAt = 0;

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }
  return {};
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

async function getEdgeToken() {
  if (edgeToken && Date.now() - tokenAt < 8 * 60 * 1000) return edgeToken;
  edgeToken = await fetch('https://edge.microsoft.com/translate/auth', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  }).then((r) => r.text());
  tokenAt = Date.now();
  return edgeToken;
}

async function translateBatch(texts, cache, batchSize = 20) {
  const need = texts.filter((t) => t && !cache[t]);
  if (!need.length) return;

  for (let i = 0; i < need.length; i += batchSize) {
    const chunk = need.slice(i, i + batchSize);
    const token = await getEdgeToken();
    const res = await fetch(
      'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=zh-Hans',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk.map((Text) => ({ Text }))),
      }
    );

    if (!res.ok) {
      throw new Error(`Edge translate ${res.status}`);
    }

    const data = await res.json();
    chunk.forEach((text, idx) => {
      cache[text] = data[idx]?.translations?.[0]?.text || '';
    });

    process.stdout.write(`  translated ${Math.min(i + batchSize, need.length)}/${need.length}\r`);
    await sleep(300);
  }
  console.log('');
}

module.exports = { loadCache, saveCache, translateBatch, CACHE_FILE };
