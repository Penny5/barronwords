import { normWord } from './srs.js';

export function getWordInfo(courseData, word) {
  if (!courseData?.wordIndex || !word) return null;
  const key = normWord(word);
  const index = courseData.wordIndex;

  if (index[key]) return { ...index[key], examples: index[key].examples || [] };
  if (index[word.toLowerCase()]) return { ...index[word.toLowerCase()], examples: index[word.toLowerCase()].examples || [] };

  for (const [k, v] of Object.entries(index)) {
    if (normWord(k) === key) return { ...v, examples: v.examples || [] };
  }
  return { word, phonetic: '', definition: '', examples: [] };
}
