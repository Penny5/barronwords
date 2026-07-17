export function dateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(from, to) {
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

export function addDays(dateStrVal, days) {
  const d = new Date(dateStrVal + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

export function formatReviewLabel(nextReview, today = dateStr()) {
  if (!nextReview) return '未安排';
  if (nextReview <= today) return '今天';
  const diff = daysBetween(today, nextReview);
  if (diff === 1) return '明天';
  if (diff <= 7) return `${diff} 天后`;
  return nextReview.slice(5).replace('-', '/');
}
