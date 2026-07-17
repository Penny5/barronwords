export function normalizeAnswer(str) {
  return (str || '').toLowerCase().replace(/[^a-z]/g, '').trim();
}

export function checkFillAnswer(input, answer) {
  const variants = (answer || '').split('|').map(normalizeAnswer);
  const normalized = normalizeAnswer(input);
  if (variants.includes(normalized)) return true;
  for (const v of variants) {
    if (!v) continue;
    if (normalized === v + 's' || normalized + 's' === v) return true;
  }
  return false;
}

export function gradeOneAnswer(item, userAnswer, mode = 'letter') {
  const user = userAnswer || '';
  if (mode === 'fill') {
    return {
      correct: checkFillAnswer(user, item.answer),
      user,
      answer: item.answer,
    };
  }
  return {
    correct: normalizeAnswer(user) === normalizeAnswer(item.answer),
    user,
    answer: item.answer,
  };
}
