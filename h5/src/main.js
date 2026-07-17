import { showLoading } from './core/dom.js';
import { initApp } from './app.js';
import dataUrl from '../../data/weeks.json?url';

const cacheModules = import.meta.glob('../../data/translate-cache.json', {
  eager: true,
  import: 'default',
});
const bundledTranslateCache = Object.values(cacheModules)[0] || {};

if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

async function bootstrap() {
  showLoading();
  try {
    const weeksRes = await fetch(dataUrl);
    if (!weeksRes.ok) throw new Error(`课程数据 HTTP ${weeksRes.status}`);
    const courseData = await weeksRes.json();
    courseData.translateCache = bundledTranslateCache;
    initApp(courseData);
  } catch (err) {
    document.getElementById('app').innerHTML = `
      <div class="loading-screen">
        <p class="empty-state">课程数据加载失败，请先运行 npm run parse</p>
      </div>`;
    console.error(err);
  }
}

bootstrap();
