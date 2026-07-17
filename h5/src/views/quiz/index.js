import { mount, escapeHtml } from '../../core/dom.js';
import { getQuizState, setQuizState } from '../../core/store.js';
import { prepareQuizState, isQuizStateStale } from './state.js';
import { getQuizFooterInner } from './grading.js';
import { shell, dayBadge, stickyFooter } from '../../components/layout.js';
import {
  renderChoiceQuestion,
  renderCompletionQuestion,
  renderDoubleDutyQuestion,
  renderFillQuestion,
  renderHeadlineQuestion,
  renderIdiomQuestion,
  renderMatchQuestion,
  renderReviewQuestion,
  renderWordsearchQuestion,
} from './questions.js';
import { renderReviewMatchQuiz } from './review-match.js';
import { bindQuizEvents } from './events.js';

export function renderQuiz() {
  let s = getQuizState();
  if (isQuizStateStale(s)) {
    s = prepareQuizState();
    setQuizState(s);
  }

  if (!s?.lesson) {
    mount(
      shell({
        title: '练习',
        back: true,
        activeTab: 'quiz',
        body: '<p class="empty-state">找不到课程</p>',
      })
    );
    return;
  }

  const { lesson } = s;
  let questions = '';

  if (lesson.type === 'lesson') {
    const fillItems = s.exercises.filter((e) => e.type === 'fillBlank');
    const matchItems = s.exercises.filter((e) => e.type === 'matching');

    if (fillItems.length) {
      questions += `<div class="quiz-section animate-in"><h3 class="quiz-section__title">填空题</h3>`;
      questions += fillItems.map((ex) => renderFillQuestion(ex, s, lesson)).join('');
      questions += `</div>`;
    }
    if (matchItems.length) {
      questions += `<div class="quiz-section animate-in"><h3 class="quiz-section__title">词义匹配</h3>`;
      questions += matchItems.map((ex) => renderMatchQuestion(ex, s)).join('');
      questions += `</div>`;
    }
  } else if (lesson.type === 'review') {
    questions = renderReviewMatchQuiz(s);
  } else if (lesson.type === 'wordMatch' || lesson.type === 'partsOfSpeech') {
    const title = lesson.type === 'partsOfSpeech' ? '词性辨析' : '词义配对';
    questions = `<div class="quiz-section animate-in"><h3 class="quiz-section__title">${title}</h3>`;
    questions += s.reviewItems.map((item) => renderReviewQuestion(item, s)).join('');
    questions += `</div>`;
  } else if (lesson.type === 'sensible') {
    questions = `<div class="quiz-section animate-in"><h3 class="quiz-section__title">辨析选词</h3>`;
    questions += s.choiceItems.map((item) => renderChoiceQuestion(item, s)).join('');
    questions += `</div>`;
    if (s.idiomItems.length) {
      questions += `<div class="quiz-section animate-in"><h3 class="quiz-section__title">习语判断</h3>`;
      questions += s.idiomItems.map((item) => renderIdiomQuestion(item, s)).join('');
      questions += `</div>`;
    }
  } else if (lesson.type === 'wordsearch') {
    questions = `<div class="quiz-section animate-in"><h3 class="quiz-section__title">选词填空</h3>`;
    questions += `<article class="passage-card story-text"><div class="passage-card__en">${escapeHtml(lesson.story || '')}</div></article>`;
    questions += s.wordsearchItems.map((item) => renderWordsearchQuestion(item, s)).join('');
    questions += `</div>`;
  } else if (lesson.type === 'headlines') {
    questions = `<div class="quiz-section animate-in"><h3 class="quiz-section__title">头条填空</h3>`;
    if ((lesson.wordBank || []).length) {
      questions += `<div class="review-grid animate-in">${(lesson.wordBank || [])
        .map(
          (w) =>
            `<div class="review-grid__item"><span class="review-grid__num">${w.key}</span><span class="review-grid__word">${escapeHtml(w.word)}</span></div>`
        )
        .join('')}</div>`;
    }
    questions += s.headlineItems.map((item) => renderHeadlineQuestion(item, s)).join('');
    questions += `</div>`;
  } else if (lesson.type === 'sentenceCompletion') {
    questions = `<div class="quiz-section animate-in"><h3 class="quiz-section__title">句子填空</h3>`;
    questions += s.completionItems.map((item) => renderCompletionQuestion(item, s)).join('');
    questions += `</div>`;
  } else if (lesson.type === 'doubleDuty') {
    questions = `<div class="quiz-section animate-in"><h3 class="quiz-section__title">一词多词性</h3>`;
    if (lesson.instruction) {
      questions += `<p class="tip-card">${escapeHtml(lesson.instruction)}</p>`;
    }
    questions += s.doubleDutyItems.map((item) => renderDoubleDutyQuestion(item, s)).join('');
    questions += `</div>`;
  } else {
    questions = '<p class="empty-state">本课暂无互动练习</p>';
  }

  const footerInner = getQuizFooterInner(s);
  const footer = footerInner ? stickyFooter(footerInner) : '';

  mount(
    shell({
      title: '练习',
      back: true,
      activeTab: 'quiz',
      body: `
        <div class="quiz-page">
          ${dayBadge(s.week, s.day, lesson)}
          ${questions}
        </div>
      `,
      footer,
    })
  );

  bindQuizEvents(renderQuiz);
}

export { prepareQuizState } from './state.js';
