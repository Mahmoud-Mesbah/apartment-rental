import { mockCall } from './mock.js';

const hasGas = () =>
  typeof window !== 'undefined' && window.google && window.google.script && window.google.script.run;

/**
 * استدعاء دالة في Code.gs عبر google.script.run (withSuccessHandler + withFailureHandler).
 * خارج Apps Script (npm run dev) يستخدم خادمًا وهميًا في الذاكرة للمعاينة فقط.
 */
export function call(name, ...args) {
  if (!hasGas()) return mockCall(name, ...args);
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; reject(new Error('timeout')); }
    }, 60000);
    const runner = window.google.script.run
      .withSuccessHandler((res) => {
        if (done) return;
        done = true; clearTimeout(timer); resolve(res);
      })
      .withFailureHandler((err) => {
        if (done) return;
        done = true; clearTimeout(timer); reject(err || new Error('failure'));
      });
    runner[name](...args);
  });
}

/** قراءة ?page=admin من رابط تطبيق الويب (داخل iframe الخاص بـ Apps Script) */
export function getPageParam() {
  return new Promise((resolve) => {
    const fallback = () => new URLSearchParams(window.location.search).get('page') || 'home';
    const g = window.google;
    if (g && g.script && g.script.url && g.script.url.getLocation) {
      let finished = false;
      const t = setTimeout(() => { if (!finished) { finished = true; resolve('home'); } }, 2000);
      g.script.url.getLocation((loc) => {
        if (finished) return;
        finished = true; clearTimeout(t);
        const p = loc && loc.parameter && loc.parameter.page;
        resolve(String((Array.isArray(p) ? p[0] : p) || 'home').toLowerCase());
      });
    } else {
      resolve(String(fallback()).toLowerCase());
    }
  });
}
