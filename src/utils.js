export const NETWORK_MSG = 'تعذّر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.';

export const PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">' +
      '<rect width="800" height="600" fill="#e5e7eb"/>' +
      '<path d="M400 190 270 300h40v110h70v-70h40v70h70V300h40z" fill="#9ca3af"/></svg>'
  );

export const todayCairo = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

export function genRequestId() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return 'r' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const num = (n) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
export const money = (n, currency = '') => `${num(n)} ${currency || ''}`.trim();

export function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return s || '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString('ar-EG', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
}

export function nightsText(n) {
  n = Number(n);
  if (n === 1) return 'ليلة واحدة';
  if (n === 2) return 'ليلتان';
  if (n >= 3 && n <= 10) return `${n.toLocaleString('ar-EG')} ليالٍ`;
  return `${n.toLocaleString('ar-EG')} ليلة`;
}

export function nextDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function normalizePhone(v) {
  let s = String(v || '')
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
  s = s.replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  return s;
}

/** رسالة واتساب إلى المالك (تُبنى من بيانات الحجز الفعلية المؤكدة من الخادم) */
export function buildOwnerMessage(b) {
  return [
    'طلب حجز جديد',
    '------------------',
    `رقم الحجز: ${b.bookingId}`,
    `الشقة: ${b.apartmentId} - ${b.apartmentTitle}`,
    `اسم العميل: ${b.customerName}`,
    `رقم الهاتف: ${b.customerPhone}`,
    `تاريخ الوصول: ${b.startDate}`,
    `تاريخ المغادرة: ${b.endDate}`,
    `مدة الإيجار: ${b.rentalDuration} ليلة`,
    `السعر الإجمالي: ${b.totalPrice} ${b.currency || ''}`,
    `حالة الحجز: مؤكد (${b.status})`
  ].join('\n');
}

export function waUrl(digits, message) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return '';
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
}

export function scrollToId(id) {
  if (id === 'top') { window.scrollTo(0, 0); return; }
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
