import { setCourseData, getReviewState, getMemorizeState } from './core/store.js';
import { registerRoute, startRouter } from './core/router.js';
import { renderHome } from './views/home.js';
import { renderLearn } from './views/learn.js';
import { renderQuiz } from './views/quiz.js';
import { renderReview, renderReviewHome } from './views/review.js';
import { renderWeak } from './views/weak.js';
import { renderMemorize, renderMemorizeHome } from './views/memorize.js';

registerRoute('home', renderHome);
registerRoute('learn', renderLearn);
registerRoute('quiz', renderQuiz);
registerRoute('review', () => {
  if (getReviewState()?.queue?.length) renderReview();
  else renderReviewHome();
});
registerRoute('weak', renderWeak);
registerRoute('memorize', () => {
  const s = getMemorizeState();
  if (s?.queue?.length && (s.mode === 'flip' || s.mode === 'defPick')) renderMemorize();
  else renderMemorizeHome();
});

export function initApp(courseData) {
  setCourseData(courseData);
  startRouter();
}
