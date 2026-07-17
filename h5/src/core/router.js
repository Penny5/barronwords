import { mount } from './dom.js';

const routes = new Map();

export function registerRoute(name, handler) {
  routes.set(name, handler);
}

export function navigate(hash) {
  if (location.hash !== hash) location.hash = hash;
  else render();
}

export function getRoute() {
  return location.hash.slice(1) || 'home';
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#home';
  else render();
}

export function render() {
  const route = getRoute();
  const handler = routes.get(route);
  if (handler) handler();
  else mount('<div class="shell"><p class="empty-state">页面不存在</p></div>');
}
