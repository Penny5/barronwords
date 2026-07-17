import { shuffleArray } from './course.js';
import { normWord } from './srs.js';
import { getWordInfo } from './word.js';

export function buildWordChoices(targetWord, pool, size = 4) {
  const correct = targetWord;
  const distractors = shuffleArray(
    pool.map((w) => w.word || w).filter((w) => normWord(w) !== normWord(correct))
  ).slice(0, size - 1);

  while (distractors.length < size - 1) {
    distractors.push(`— ${distractors.length + 1}`);
  }

  return shuffleArray([correct, ...distractors]);
}

export function buildDefPickItems(courseData, words) {
  const pool = words.map((w) => {
    const word = w.word || w;
    return { ...getWordInfo(courseData, word), ...w, word };
  });

  return pool.map((item, i) => ({
    ...item,
    cardType: 'defPick',
    choices: buildWordChoices(item.word, pool),
    _ref: item._ref || words[i],
  }));
}

export function buildMixedReviewItems(courseData, words) {
  const pool = words.map((w) => {
    const word = w.word || w;
    return { ...getWordInfo(courseData, word), _ref: w, word };
  });

  return pool.map((item, i) => ({
    ...item,
    cardType: i % 2 === 0 ? 'flip' : 'defPick',
    choices: buildWordChoices(item.word, pool),
  }));
}
