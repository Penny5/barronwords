const state = {
  courseData: null,
  quiz: null,
  picker: { open: false, view: 'weeks', focusWeek: null },
  review: null,
  memorize: null,
};

export function getReviewState() {
  return state.review;
}

export function setReviewState(review) {
  state.review = review;
}

export function resetReviewState() {
  state.review = null;
}

export function getCourseData() {
  return state.courseData;
}

export function setCourseData(data) {
  state.courseData = data;
}

export function getQuizState() {
  return state.quiz;
}

export function setQuizState(quiz) {
  state.quiz = quiz;
}

export function resetQuizState() {
  if (state.quiz?._advanceTimer != null) {
    clearTimeout(state.quiz._advanceTimer);
  }
  state.quiz = null;
}

export function getPickerState() {
  return state.picker;
}

export function openPicker({ view = 'weeks', focusWeek = null } = {}) {
  state.picker = { open: true, view, focusWeek };
}

export function setPickerView(view, focusWeek = null) {
  state.picker.view = view;
  state.picker.focusWeek = focusWeek;
}

export function closePicker() {
  state.picker = { open: false, view: 'weeks', focusWeek: null };
}

export function getMemorizeState() {
  return state.memorize;
}

export function setMemorizeState(memorize) {
  state.memorize = memorize;
}

export function resetMemorizeState() {
  state.memorize = null;
}
