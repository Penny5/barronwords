const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const cheerio = require('cheerio');

const DEFAULT_EPUB = path.join(__dirname, '..', 'book.epub');

const epubPath = process.argv[2] || process.env.BARRON_EPUB || DEFAULT_EPUB;
const outDir = path.join(__dirname, '..', 'data');

function extractEpub(epubFile) {
  const zip = new AdmZip(epubFile);
  const tmpDir = path.join(__dirname, '..', '.epub-tmp');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  zip.extractAllTo(tmpDir, true);
  return path.join(tmpDir, 'OEBPS');
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2013;/g, '–')
    .replace(/&#x2019;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function getText($el) {
  if (!$el || !$el.length) return '';
  return stripHtml($el.html() || '');
}

function getTextWithoutMedia($el) {
  if (!$el || !$el.length) return '';
  const clone = $el.clone();
  clone.find('img, a').remove();
  return stripHtml(clone.html() || '');
}

function htmlToStoryText(html) {
  return stripHtml(
    (html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<img[^>]*>/gi, ' ______ ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function isPassageParagraph(cls) {
  return cls === 'Normal' || cls === 'paraNoIndent' || cls === 'para' || cls === 'No-Paragraph-Style';
}

function isTitleOnlyParagraph($, $p) {
  if ($p.find('span.ITALIC').length) return false;
  return $p.find('span.BOLD, span.BOLD-ITALIC').length > 0;
}

function walkParagraphContent($, $p, highlightWords) {
  let text = '';
  $p.contents().each((__, node) => {
    if (node.type === 'text') {
      text += node.data;
    } else if (node.type === 'tag') {
      const $n = $(node);
      const nodeText = $n.text();
      if ($n.hasClass('ITALIC') && nodeText) {
        text += nodeText;
        highlightWords.push(nodeText.replace(/[,.\s]+$/, ''));
      } else {
        text += nodeText;
      }
    }
  });
  return text;
}

function isFootnoteParagraph($, $p) {
  const text = getText($p);
  if (!/click here/i.test(text)) return false;
  return $p.find('a[href*="w"][href*="-d"]').length > 0 || /\(\*/.test(text);
}

function parseFootnoteLinks($, $p, text) {
  const links = [];
  let searchFrom = 0;

  $p.find('a[href]').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href') || '';
    const match = href.match(/^(w\d+-d\d+)\.xhtml$/i);
    if (!match) return;

    const anchor = getText($a) || 'click here';
    const pos = text.toLowerCase().indexOf(anchor.toLowerCase(), searchFrom);
    if (pos < 0) return;

    const segment = text.slice(searchFrom, pos);
    const wordMatch = segment.match(/\*([a-z]+)—/i);
    links.push({
      word: wordMatch ? wordMatch[1].toLowerCase() : '',
      targetId: match[1].toLowerCase(),
    });
    searchFrom = pos + anchor.length;
  });

  return links;
}

function parseFootnotes($, scope, prefix) {
  const footnotes = [];

  scope.find('p, .non-hang-top').each((_, el) => {
    const $p = $(el);
    const text = getText($p).replace(/\s+/g, ' ').trim();
    if (!/click here/i.test(text)) return;

    const links = parseFootnoteLinks($, $p, text);
    if (!links.length) return;

    const id = ($p.attr('id') || '').match(new RegExp(`^${prefix}-q(\\d+)$`, 'i'));
    const prevHang = $p.prevAll(`p[id^="${prefix}-q"], p.hang[id^="${prefix}-q"]`).first();
    const prevId = (prevHang.attr('id') || '').match(/-q(\d+)$/);

    footnotes.push({
      placement: id || prevId ? 'exercise' : 'passage',
      exerciseId: id ? parseInt(id[1], 10) : prevId ? parseInt(prevId[1], 10) : null,
      text,
      links,
    });
  });

  return footnotes;
}

function stripPassageFootnotes(passage) {
  if (!passage) return passage;
  return passage.replace(/\s*\(\*[^)]*click here[^)]*\)\s*$/i, '').trim();
}

function parsePassage($, $chapter) {
  const $dayHead = $chapter.find('p.DAY-HEAD').first();
  let title = getText($dayHead);
  let $startAfter = $dayHead;

  if (!$dayHead.length) {
    const $mainHead = $chapter.find('p.main-head').first();
    $startAfter = $mainHead;
    $mainHead.nextAll('p').each((_, el) => {
      const $p = $(el);
      const cls = $p.attr('class') || '';
      if (cls.includes('separator') || cls.includes('hang')) return false;
      if (cls === 'Normal' && isTitleOnlyParagraph($, $p)) {
        title = getText($p);
        $startAfter = $p;
        return false;
      }
    });
  }

  let passage = '';
  const highlightWords = [];

  $startAfter.nextAll('p').each((_, el) => {
    const $p = $(el);
    const cls = $p.attr('class') || '';
    if (cls.includes('separator') || cls.includes('hang') || cls.includes('black-box')) {
      return false;
    }
    if (isFootnoteParagraph($, $p)) {
      return false;
    }
    if (isPassageParagraph(cls)) {
      const chunk = walkParagraphContent($, $p, highlightWords);
      if (chunk.trim()) {
        if (passage) passage += ' ';
        passage += chunk;
      }
    }
  });

  return { title, passage: passage.replace(/\s+/g, ' ').trim(), highlightWords };
}

function normWordKey(word) {
  return (word || '').toLowerCase().replace(/[^a-z]/g, '');
}

const EPUB_WORD_TYPOS = {
  emanting: 'emanating',
};

function alignWordsWithHighlights(words, highlightWords) {
  const highlights = highlightWords || [];
  return words.map((w) => {
    const typoFix = EPUB_WORD_TYPOS[w.word.toLowerCase()];
    if (typoFix) return { ...w, word: typoFix };

    const key = normWordKey(w.word);
    if (highlights.some((h) => normWordKey(h) === key)) return w;
    for (const h of highlights) {
      const hk = normWordKey(h);
      if (!hk || hk === key) continue;
      if (key.includes(hk) || hk.includes(key)) {
        if (Math.abs(key.length - hk.length) <= 2) return { ...w, word: h };
      }
    }
    return w;
  });
}

function parseNewWords($, $chapter) {
  const words = [];
  $chapter.find('.gray-box .gray-text').each((_, el) => {
    const html = $(el).html() || '';
    let match = html.match(/<span class="BOLD">([^<]+)<\/span><br\/?>([\s\S]+)/i);
    if (!match) {
      match = html.match(/<span class="BOLD">([^<]*)<br\/?><\/span>([\s\S]+)/i);
    }
    if (match) {
      words.push({
        word: stripHtml(match[1]),
        phonetic: stripHtml(match[2]),
      });
    }
  });
  return words;
}

function getLessonScope($, $chapter) {
  const $story = $chapter.next('div.story');
  return $story.length ? $chapter.add($story) : $chapter;
}

function parseIdiom($, scope) {
  const $box = scope.find('.black-box').first();
  if (!$box.length) return null;

  const texts = [];
  $box.find('.black-text').each((_, el) => texts.push(getText($(el))));

  if (texts.length < 2) return null;

  const phraseMatch = texts[0].match(/^(.+?)—(.+)$/);
  return {
    phrase: phraseMatch ? phraseMatch[1].trim() : texts[0],
    meaning: phraseMatch ? phraseMatch[2].trim() : '',
    example: texts[1] || '',
  };
}

function parseFillBlank($, scope, prefix) {
  const questions = [];
  scope.find(`p[id^="${prefix}-q"]`).each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    const num = parseInt(id.split('-q')[1], 10);
    if (num >= 1 && num <= 5) {
      let text = getText($el);
      text = text.replace(/^\d+\.\s*/, '');
      questions.push({ id: num, text, type: 'fillBlank' });
    }
  });
  return questions;
}

function parseMatching($, scope, prefix) {
  const wordQuestions = [];
  const allOptions = [];

  scope.find('table tr').each((_, row) => {
    const $row = $(row);
    const $wordCell = $row.find(`p[id^="${prefix}-q"]`).first();
    if (!$wordCell.length) return;

    const id = $wordCell.attr('id') || '';
    const num = parseInt(id.split('-q')[1], 10);
    if (num < 6) return;

    const word = getText($wordCell).replace(/^\d+\.\s*/, '');
    const optionText = getText($row.find('p.hang').last());
    const optMatch = optionText.match(/^([a-z])\.\s*(.+)$/i);

    if (optMatch) {
      const key = optMatch[1].toLowerCase();
      const text = optMatch[2];
      if (!allOptions.find((o) => o.key === key)) {
        allOptions.push({ key, text });
      }
      wordQuestions.push({ id: num, word, type: 'matching', options: [] });
    }
  });

  for (const q of wordQuestions) {
    q.options = [...allOptions];
  }
  return wordQuestions;
}

function parseReviewDay($, $chapter, prefix) {
  const words = [];
  const optionsMap = new Map();

  // 只解析第一张复习表，忽略末尾 "WORDS FOR FURTHER STUDY" 表
  $chapter.find('table').first().find('tr').each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    if (cells.length < 2) return;

    const left = getText($(cells[0]));
    if (left.includes('REVIEW WORDS') || left.trim() === 'IDIOMS') return;

    const wordMatch = left.match(/^(\d+)\.\s*(.+)$/);
    if (wordMatch) {
      words.push({ id: parseInt(wordMatch[1], 10), word: wordMatch[2].trim() });
    }

    if (cells.length >= 3) {
      const mid = getText($(cells[1]));
      const defText = getText($(cells[cells.length - 1]));
      const keyMatch = mid.match(/^([a-z])\.?$/i);
      if (keyMatch && defText) {
        const key = keyMatch[1].toLowerCase();
        if (!optionsMap.has(key)) {
          optionsMap.set(key, { key, text: defText });
        }
      }
    } else {
      const right = getText($(cells[cells.length - 1]));
      const optMatch = right.match(/^([a-z])\.\s*(.+)$/i);
      if (optMatch) {
        const key = optMatch[1].toLowerCase();
        if (!optionsMap.has(key)) {
          optionsMap.set(key, { key, text: optMatch[2].trim() });
        }
      }
    }
  });

  const reviewOptions = [...optionsMap.values()].sort((a, b) => a.key.localeCompare(b.key));

  return {
    type: 'review',
    reviewWords: words,
    reviewOptions,
  };
}

function parseSensibleDay($, $chapter, prefix) {
  const choiceQuestions = [];
  const idiomQuestions = [];

  $chapter.find(`p.hang[id^="${prefix}-q"], p.hang1[id^="${prefix}-q"]`).each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    const num = parseInt(id.split('-q')[1], 10);
    let text = getText($el).replace(/^\d+\.\s*/, '');

    const choiceMatch = text.match(/^(.+?)\(([^,)]+),\s*([^)]+)\)\s*(.*)$/);
    if (choiceMatch) {
      choiceQuestions.push({
        id: num,
        type: 'choice',
        before: choiceMatch[1].trim(),
        choices: [choiceMatch[2].trim(), choiceMatch[3].trim()],
        after: choiceMatch[4].trim(),
        text,
      });
    } else {
      idiomQuestions.push({ id: num, type: 'idiomSense', text });
    }
  });

  return { type: 'sensible', choiceQuestions, idiomQuestions };
}

function parseWordsearchDay($, $chapter, prefix) {
  const clues = [];
  $chapter.find(`p.paraNoIndent[id^="${prefix}-q"]`).each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    const num = parseInt(id.split('-q')[1], 10);
    clues.push({ id: num, hint: getTextWithoutMedia($el) });
  });

  const $storyHead = $chapter.find('p.h3i').first();
  const storyTitle = getText($storyHead);
  const storyParts = [];

  $storyHead.nextAll('p.Normal, p.paraNoIndent, p.paraNoIndent1').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    if (/-q\d+$/.test(id)) return;

    const text = htmlToStoryText($el.html() || '');
    if (text) storyParts.push(text);
  });

  return { type: 'wordsearch', storyTitle, story: storyParts.join('\n\n'), clues };
}

function parseWordBankFromTable($, $chapter) {
  const wordBank = [];

  $chapter.find('table').first().find('td p.hang').each((_, el) => {
    const text = getText($(el));
    const match = text.match(/^([a-z])\.\s*(.+)$/i);
    if (match) {
      wordBank.push({ key: match[1].toLowerCase(), word: match[2].trim() });
    }
  });

  if (!wordBank.length) {
    $chapter.find('table').first().find('tr').each((_, row) => {
      const cells = $(row).find('td');
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const key = getText($(cells[i])).replace(/\.$/, '').trim().toLowerCase();
        const word = getText($(cells[i + 1]));
        if (/^[a-z]$/.test(key) && word) {
          wordBank.push({ key, word });
        }
      }
    });
  }

  return wordBank;
}

function parseWordMatchDay($, $chapter, prefix) {
  const wordBank = parseWordBankFromTable($, $chapter);
  const reviewOptions = wordBank.map((item) => ({ key: item.key, text: item.word }));
  const reviewWords = [];

  $chapter.find(`p.hang[id^="${prefix}-q"], p.hang1[id^="${prefix}-q"]`).each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    const num = parseInt(id.split('-q')[1], 10);
    reviewWords.push({
      id: num,
      word: getText($el).replace(/^\d+\.\s*/, ''),
    });
  });

  return { type: 'wordMatch', reviewWords, reviewOptions };
}

function parseHeadlinesDay($, $chapter, prefix) {
  const wordBank = parseWordBankFromTable($, $chapter);
  const questions = [];

  $chapter.find(`p.hang[id^="${prefix}-q"], p.hang1[id^="${prefix}-q"]`).each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    const num = parseInt(id.split('-q')[1], 10);
    const text = getText($el).replace(/^\d+\.\s*/, '').replace(/_+/g, '______');
    questions.push({ id: num, type: 'headlineFill', text });
  });

  return { type: 'headlines', wordBank, questions };
}

function parseDoubleDutyDay($, $chapter, prefix) {
  const words = [];

  $chapter.find(`p.hang[id^="${prefix}-q"], p.hang1[id^="${prefix}-q"]`).each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    const num = parseInt(id.split('-q')[1], 10);
    words.push({
      id: num,
      word: getText($el).replace(/^\d+\.\s*/, ''),
    });
  });

  $chapter.find('table').first().find('p.hang').each((_, el) => {
    const text = getText($(el));
    const match = text.match(/^(\d+)\.\s*(.+)$/);
    if (match) {
      const id = parseInt(match[1], 10);
      if (!words.find((w) => w.id === id)) {
        words.push({ id, word: match[2].trim() });
      }
    }
  });

  words.sort((a, b) => a.id - b.id);

  return {
    type: 'doubleDuty',
    instruction: getText($chapter.find('p.hang1').first()),
    words,
  };
}

function detectSpecialLessonType($, $chapter) {
  const head = getText($chapter.find('p.main-head').first()).toUpperCase();
  if (head.includes('REVIEW')) return 'review';
  if (head.includes('SENSIBLE SENTENCE')) return 'sensible';
  if (head.includes('WORDSEARCH')) return 'wordsearch';
  if (head.includes('PARTS OF SPEECH')) return 'partsOfSpeech';
  if (head.includes('SENTENCE COMPLETION')) return 'sentenceCompletion';
  if (head.includes('HAPLESS HEADLINE')) return 'headlines';
  if (head.includes('ADJECTIVE LEADERS')) return 'wordMatch';
  if (head.includes('WHICH WORD COMES TO MIND')) return 'wordMatch';
  if (head.includes('SELECTING ANTONYM')) return 'sensible';
  if (head.includes('DOING DOUBLE DUTY')) return 'doubleDuty';
  return 'sensible';
}

function parseSpecialLesson($, $chapter, prefix, lessonType) {
  switch (lessonType) {
    case 'review':
      return parseReviewDay($, $chapter, prefix);
    case 'sensible':
      return parseSensibleDay($, $chapter, prefix);
    case 'wordsearch':
      return parseWordsearchDay($, $chapter, prefix);
    case 'partsOfSpeech':
      return parsePartsOfSpeechDay($, $chapter, prefix);
    case 'sentenceCompletion':
      return parseSentenceCompletionDay($, $chapter, prefix);
    case 'headlines':
      return parseHeadlinesDay($, $chapter, prefix);
    case 'wordMatch':
      return parseWordMatchDay($, $chapter, prefix);
    case 'doubleDuty':
      return parseDoubleDutyDay($, $chapter, prefix);
    default:
      return parseSensibleDay($, $chapter, prefix);
  }
}

function parsePartsOfSpeechDay($, $chapter, prefix) {
  const wordBank = [];

  $chapter.find('table tr').each((_, row) => {
    $(row)
      .find('td p.hang')
      .each((__, el) => {
        const text = getText($(el));
        const match = text.match(/^([a-z])\.\s*(.+)$/i);
        if (match) {
          wordBank.push({ key: match[1].toLowerCase(), word: match[2].trim() });
        }
      });
  });

  const questions = [];
  $chapter.find(`p.hang[id^="${prefix}-q"], p.hang1[id^="${prefix}-q"]`).each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    const num = parseInt(id.split('-q')[1], 10);
    questions.push({
      id: num,
      type: 'partsOfSpeech',
      text: getText($el).replace(/^\d+\.\s*/, ''),
    });
  });

  return {
    type: 'partsOfSpeech',
    title: getText($chapter.find('p.main-head').first()),
    wordBank,
    questions,
  };
}

function parseSentenceCompletionDay($, $chapter, prefix) {
  const questions = [];

  $chapter.find(`p.hang-top[id^="${prefix}-q"]`).each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    const num = parseInt(id.split('-q')[1], 10);
    const text = getText($el)
      .replace(/^\d+\.\s*/, '')
      .replace(/_{2,}/g, '______');

    const choices = [];
    let $next = $el.next();
    while ($next.length && ($next.hasClass('hang-left') || $next.is('p.hang-left'))) {
      const optText = getText($next);
      const match = optText.match(/^([a-e])\.\s*(.+)$/i);
      if (match) {
        choices.push({ key: match[1].toLowerCase(), text: match[2].trim() });
      }
      $next = $next.next();
    }

    questions.push({ id: num, type: 'sentenceCompletion', text, choices });
  });

  return {
    type: 'sentenceCompletion',
    title: getText($chapter.find('p.main-head').first()),
    questions,
  };
}

function parseLessonDay($, filepath) {
  const basename = path.basename(filepath, '.xhtml');
  const match = basename.match(/^w(\d+|[AB])-d(\d+)$/i);
  if (!match) return null;

  const week = match[1] === 'A' ? 'A' : match[1] === 'B' ? 'B' : parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const prefix = basename;

  const $chapter = $(`div.chapter#${prefix}`);
  if (!$chapter.length) return null;

  const answers = {};

  if (day >= 1 && day <= 4) {
    const $scope = getLessonScope($, $chapter);
    const { title, passage, highlightWords } = parsePassage($, $chapter);
    const words = alignWordsWithHighlights(parseNewWords($, $chapter), highlightWords);
    const fillBlank = parseFillBlank($, $scope, prefix);
    const matching = parseMatching($, $scope, prefix);
    const idiom = parseIdiom($, $scope);
    const footnotes = parseFootnotes($, $chapter.add($scope), prefix);

    return {
      id: prefix,
      week,
      day,
      type: 'lesson',
      title,
      words,
      passage,
      highlightWords,
      footnotes: footnotes.length ? footnotes : undefined,
      exercises: [...fillBlank, ...matching],
      idiom,
      answers,
    };
  }

  if (day >= 5) {
    const lessonType = detectSpecialLessonType($, $chapter);
    const special = parseSpecialLesson($, $chapter, prefix, lessonType);
    return { id: prefix, week, day, ...special, answers };
  }

  return null;
}

function parseAnswers(html) {
  const $ = cheerio.load(html, { xmlMode: false });
  const answers = {};

  $('p.paraNoIndent-link[id]').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id');
    if (!id) return;

    const dayMatch = id.match(/^(w(?:\d+|[AB]))-d(\d+)-a(\d+)$/i);
    if (!dayMatch) return;

    const lessonId = `${dayMatch[1]}-d${dayMatch[2]}`;
    const qNum = parseInt(dayMatch[3], 10);

    let answer = getText($el).replace(/^\d+\.\s*/, '');
    answer = answer.replace(/\s+or\s+/gi, '|');

    if (!answers[lessonId]) answers[lessonId] = {};
    answers[lessonId][qNum] = answer;
  });

  return answers;
}

function mergeAnswers(lessons, answerMap) {
  for (const lesson of lessons) {
    const ans = answerMap[lesson.id];
    if (!ans) continue;
    lesson.answers = ans;

    for (const ex of lesson.exercises || []) {
      if (ans[ex.id]) ex.answer = ans[ex.id];
    }
    for (const q of lesson.choiceQuestions || []) {
      if (ans[q.id]) q.answer = ans[q.id];
    }
    for (const q of lesson.idiomQuestions || []) {
      if (ans[q.id]) q.answer = ans[q.id];
    }
    for (const q of lesson.questions || []) {
      if (ans[q.id]) q.answer = ans[q.id];
    }
    if (lesson.reviewWords) {
      for (const w of lesson.reviewWords) {
        if (ans[w.id]) w.answer = ans[w.id];
      }
    }
    if (lesson.clues) {
      for (const c of lesson.clues) {
        if (ans[c.id]) c.answer = ans[c.id];
      }
    }
    // correctDefinition 由 main() 统一赋值；此处原代码 opt/defLesson 未使用、属冗余，已移除。
  }
}

function mergeWordIndex(index, oldIndex) {
  if (!oldIndex) return index;
  for (const [key, oldEntry] of Object.entries(oldIndex)) {
    const entry = index[key];
    if (!entry || !oldEntry) continue;
    if (oldEntry.examples?.length) entry.examples = oldEntry.examples;
    if (oldEntry.definition) entry.definition = oldEntry.definition;
  }
  return index;
}

function mergeMeta(meta, oldMeta) {
  if (!oldMeta) return meta;
  if (oldMeta.examplesEnrichedAt) meta.examplesEnrichedAt = oldMeta.examplesEnrichedAt;
  if (oldMeta.passagesEnrichedAt) meta.passagesEnrichedAt = oldMeta.passagesEnrichedAt;
  return meta;
}

function mergeLocalizedFields(lessons, oldData) {
  if (!oldData?.weeks) return;

  const oldLessonMap = {};
  for (const week of oldData.weeks) {
    for (const day of week.days || []) {
      oldLessonMap[day.id] = day;
    }
  }

  for (const lesson of lessons) {
    const old = oldLessonMap[lesson.id];
    if (!old) continue;

    if (lesson.type === 'lesson' && old.passage === lesson.passage && old.passageZh) {
      lesson.passageZh = old.passageZh;
    }

    if (lesson.type === 'wordsearch' && old.story === lesson.story && old.storyZh) {
      lesson.storyZh = old.storyZh;
    }

    if (lesson.type === 'lesson' && old.words && lesson.words) {
      const oldWordMap = Object.fromEntries(old.words.map((w) => [w.word.toLowerCase(), w]));
      for (const word of lesson.words) {
        const prev = oldWordMap[word.word.toLowerCase()];
        if (!prev?.examples) continue;
        if (!word.examples) word.examples = prev.examples;
        else {
          const prevExampleMap = Object.fromEntries((prev.examples || []).map((ex) => [ex.en, ex]));
          for (const ex of word.examples) {
            const prevEx = prevExampleMap[ex.en];
            if (prevEx?.zh) ex.zh = prevEx.zh;
            if (prevEx?.source) ex.source = prevEx.source;
          }
        }
      }
    }
  }
}

function buildWordIndex(lessons) {
  const index = {};
  for (const lesson of lessons) {
    if (lesson.type !== 'lesson' || !lesson.words) continue;
    for (const w of lesson.words) {
      const key = w.word.toLowerCase();
      if (!index[key]) {
        index[key] = {
          word: w.word,
          phonetic: w.phonetic,
          week: lesson.week,
          day: lesson.day,
          definition: null,
        };
      }
      for (const ex of lesson.exercises || []) {
        if (ex.type === 'matching' && ex.word === w.word && ex.correctDefinition) {
          index[key].definition = ex.correctDefinition;
        }
      }
    }
  }
  return index;
}

function main() {
  if (!fs.existsSync(epubPath)) {
    console.error(`EPUB not found: ${epubPath}`);
    process.exit(1);
  }

  console.log(`Extracting: ${epubPath}`);
  const oebpsDir = extractEpub(epubPath);

  const lessonFiles = fs
    .readdirSync(oebpsDir)
    .filter((f) => /^w(\d+|[AB])-d\d+\.xhtml$/i.test(f))
    .sort((a, b) => {
      const pa = a.match(/^w(\d+|[AB])-d(\d+)/i);
      const pb = b.match(/^w(\d+|[AB])-d(\d+)/i);
      const wa = pa[1] === 'A' ? 100 : pa[1] === 'B' ? 101 : parseInt(pa[1], 10);
      const wb = pb[1] === 'A' ? 100 : pb[1] === 'B' ? 101 : parseInt(pb[1], 10);
      if (wa !== wb) return wa - wb;
      return parseInt(pa[2], 10) - parseInt(pb[2], 10);
    });

  const lessons = [];
  for (const file of lessonFiles) {
    const html = fs.readFileSync(path.join(oebpsDir, file), 'utf8');
    const $ = cheerio.load(html, { xmlMode: false });
    const lesson = parseLessonDay($, file);
    if (lesson) lessons.push(lesson);
  }

  const answerFiles = ['ans01.xhtml', 'ans01a.xhtml', 'weekab_ans01.xhtml'];
  const answerMap = {};
  for (const file of answerFiles) {
    const filePath = path.join(oebpsDir, file);
    if (!fs.existsSync(filePath)) continue;
    Object.assign(answerMap, parseAnswers(fs.readFileSync(filePath, 'utf8')));
  }
  mergeAnswers(lessons, answerMap);

  for (const lesson of lessons) {
    if (lesson.type !== 'lesson') continue;
    for (const ex of lesson.exercises || []) {
      if (ex.type === 'matching' && lesson.answers && lesson.answers[ex.id]) {
        const letter = lesson.answers[ex.id];
        const matched = ex.options.find((o) => o.key === letter);
        if (matched) ex.correctDefinition = matched.text;
      }
    }
    for (const w of lesson.words || []) {
      const ex = (lesson.exercises || []).find(
        (e) => e.type === 'matching' && e.word.toLowerCase() === w.word.toLowerCase()
      );
      if (ex && ex.correctDefinition) w.definition = ex.correctDefinition;
    }
  }

  const weeks = {};
  for (const lesson of lessons) {
    const wk = String(lesson.week);
    if (!weeks[wk]) weeks[wk] = { week: lesson.week, days: [] };
    weeks[wk].days.push(lesson);
  }

  const output = {
    meta: {
      title: "Barron's 1100 Words You Need to Know",
      totalWeeks: Object.keys(weeks).length,
      totalLessons: lessons.length,
      parsedAt: new Date().toISOString(),
    },
    weeks: Object.values(weeks).sort((a, b) => {
      const na = typeof a.week === 'number' ? a.week : (a.week === 'A' ? 100 : 101);
      const nb = typeof b.week === 'number' ? b.week : (b.week === 'A' ? 100 : 101);
      return na - nb;
    }),
    wordIndex: buildWordIndex(lessons),
  };

  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, 'weeks.json');
  if (fs.existsSync(outFile)) {
    try {
      const oldData = JSON.parse(fs.readFileSync(outFile, 'utf8'));
      mergeLocalizedFields(lessons, oldData);
      output.wordIndex = mergeWordIndex(output.wordIndex, oldData.wordIndex);
      output.meta = mergeMeta(output.meta, oldData.meta);
    } catch (err) {
      console.warn('Could not merge localized fields:', err.message);
    }
  }

  const json = JSON.stringify(output, null, 2);

  fs.writeFileSync(outFile, json, 'utf8');

  const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
  console.log(`Parsed ${lessons.length} lessons across ${output.meta.totalWeeks} weeks`);
  console.log(`Output: ${outFile} (${sizeMB} MB)`);
}

function applyExerciseAnswers(exercises, answers) {
  if (!answers) return exercises;
  for (const ex of exercises) {
    if (answers[ex.id]) ex.answer = answers[ex.id];
    if (ex.type === 'matching' && ex.answer && ex.options?.length) {
      const matched = ex.options.find((o) => o.key === ex.answer);
      if (matched) ex.correctDefinition = matched.text;
    }
  }
  return exercises;
}

function parseLessonExercisesFromHtml(html, lessonId) {
  const $ = cheerio.load(html, { xmlMode: false });
  const $chapter = $(`div.chapter#${lessonId}`);
  if (!$chapter.length) return null;

  const $scope = getLessonScope($, $chapter);
  const fillBlank = parseFillBlank($, $scope, lessonId);
  const matching = parseMatching($, $scope, lessonId);
  const idiom = parseIdiom($, $scope);

  return {
    exercises: [...fillBlank, ...matching],
    idiom,
  };
}

function parseLessonFootnotesFromHtml(html, lessonId) {
  const $ = cheerio.load(html, { xmlMode: false });
  const $chapter = $(`div.chapter#${lessonId}`);
  if (!$chapter.length) return null;

  const $scope = getLessonScope($, $chapter);
  const footnotes = parseFootnotes($, $chapter.add($scope), lessonId);
  if (!footnotes.length) return null;

  return { footnotes };
}

module.exports = {
  getLessonScope,
  parseFillBlank,
  parseMatching,
  parseIdiom,
  applyExerciseAnswers,
  parseLessonExercisesFromHtml,
  parseLessonFootnotesFromHtml,
  stripPassageFootnotes,
};

if (require.main === module) {
  main();
}
