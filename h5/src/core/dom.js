export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mount(html) {
  // ponytail: #app 是常驻节点，replaceWith(cloneNode(false)) 丢弃每次 render 累积的 delegate 监听器
  const old = document.getElementById('app');
  const app = old.cloneNode(false);
  old.replaceWith(app);
  app.innerHTML = html;
  requestAnimationFrame(() => {
    app.querySelectorAll('.animate-in').forEach((el, i) => {
      el.style.animationDelay = `${i * 60}ms`;
    });
  });
  return app;
}

export function toast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--visible'));
  setTimeout(() => {
    el.classList.remove('toast--visible');
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

export function showLoading() {
  mount(`
    <div class="loading-screen">
      <div class="loading-emblem">B</div>
      <div class="loading-title">Barron 1100</div>
      <div class="loading-bar"><div class="loading-bar-fill"></div></div>
      <p class="loading-hint">正在加载课程数据…</p>
    </div>
  `);
}

export function delegate(root, selector, event, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}
