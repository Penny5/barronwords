let passageSpeechCallback = null;

function cleanSpeechText(text) {
  return (text || '')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function speak(text, lang = 'en-US', rate = 0.88) {
  if (!text || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  passageSpeechCallback?.(false);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function speakWord(word) {
  return speak(cleanSpeechText(word), 'en-US', 0.88);
}

export function speakPassage(text) {
  const clean = cleanSpeechText(text);
  if (!clean || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'en-US';
  utterance.rate = 0.82;
  utterance.onend = () => passageSpeechCallback?.(false);
  utterance.onerror = () => passageSpeechCallback?.(false);
  window.speechSynthesis.speak(utterance);
  passageSpeechCallback?.(true);
  return true;
}

export function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  passageSpeechCallback?.(false);
}

export function isSpeaking() {
  return !!window.speechSynthesis?.speaking;
}

export function onSpeakingChange(callback) {
  passageSpeechCallback = callback;
}

export function isSpeechSupported() {
  return 'speechSynthesis' in window;
}
