/**
 * ============================================================
 *  نظام إدارة وحجز الشقق - Google Apps Script + Google Sheets
 *  Code.gs  (الواجهة الخلفية الكاملة)
 * ============================================================
 *  ملاحظة أمنية مهمة:
 *  أي دالة عامة (لا ينتهي اسمها بـ _) يمكن استدعاؤها من المتصفح عبر
 *  google.script.run. لذلك:
 *   - الدوال العامة للزوار لا تُرجع إلا بيانات عامة.
 *   - كل دوال الإدارة (admin*) تبدأ بـ requireOwner_() وتفشل إن لم يكن
 *     المستخدم هو المالك.
 *   - الدوال المساعدة الداخلية تنتهي بـ _ فلا يمكن استدعاؤها من المتصفح.
 * ============================================================
 */

/* ===================== الثوابت ===================== */
var APP = {
  TZ: 'Africa/Cairo',
  SHEET_APARTMENTS: 'Apartments',
  SHEET_BOOKINGS: 'Bookings',
  SHEET_SETTINGS: 'Settings',
  APT_HEADERS: ['apartmentId', 'title', 'address', 'description', 'bedrooms', 'bathrooms',
    'facilities', 'dailyPrice', 'monthlyPrice', 'imageUrls', 'status', 'activeBookingId',
    'createdAt', 'updatedAt'],
  BOOKING_HEADERS: ['bookingId', 'apartmentId', 'customerName', 'customerPhone', 'startDate',
    'endDate', 'rentalDuration', 'totalPrice', 'customerNotes', 'bookingStatus', 'createdAt',
    'notificationStatus'],
  SETTINGS_HEADERS: ['key', 'value', 'description'],
  APT_STATUS: ['AVAILABLE', 'UNAVAILABLE'],
  BOOKING_STATUS: ['CONFIRMED', 'COMPLETED', 'CANCELLED'],
  NOTIFY_STATUS: ['NOT_SENT', 'SENT_MANUALLY'],
  LOCK_WAIT_MS: 20000,
  MAX_NIGHTS: 365,
  IDEMPOTENCY_TTL_SEC: 21600,
  EXPIRY_HANDLER: 'expireBookings',
  INCLUDE_WHITELIST: [],
  // أعمدة تُخزَّن كنص صريح لتجنب التحويل التلقائي للتواريخ/الأرقام ولمنع تنفيذ الصيغ
  TEXT_COLS: {
    Apartments: ['apartmentId', 'title', 'address', 'description', 'facilities', 'imageUrls',
      'status', 'activeBookingId', 'createdAt', 'updatedAt'],
    Bookings: ['bookingId', 'apartmentId', 'customerName', 'customerPhone', 'startDate',
      'endDate', 'customerNotes', 'bookingStatus', 'createdAt', 'notificationStatus']
  }
};

var DEFAULT_SETTINGS_ = [
  ['websiteName', 'شقق للإيجار', 'اسم الموقع'],
  ['ownerWhatsApp', '', 'رقم واتساب المالك بالصيغة الدولية بدون + أو أصفار (مثال: 201000000000)'],
  ['currency', 'جنيه', 'العملة المعروضة'],
  ['contactPhone', '', 'هاتف التواصل (يظهر في أسفل الموقع)'],
  ['contactEmail', '', 'البريد الإلكتروني للتواصل (يظهر في أسفل الموقع)'],
  ['contactAddress', '', 'عنوان التواصل (يظهر في أسفل الموقع)'],
  ['defaultCountryCode', '20', 'رمز الدولة الافتراضي لتحويل الأرقام المحلية (مصر = 20)'],
  ['monthlyThresholdNights', '30', 'أقل عدد ليالٍ لتطبيق السعر الشهري'],
  ['daysPerMonth', '30', 'عدد الأيام المحتسبة في الشهر الواحد']
];

var PUBLIC_SETTING_KEYS_ = ['websiteName', 'ownerWhatsApp', 'currency', 'contactPhone',
  'contactEmail', 'contactAddress'];

/* ===================== أخطاء التطبيق ===================== */
class AppError_ extends Error {
  constructor(code, userMessage, fields) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
    this.fields = fields || null;
  }
}

function errorResponse_(err) {
  if (err instanceof AppError_) {
    var r = { success: false, code: err.code, message: err.userMessage };
    if (err.fields) r.errors = err.fields;
    return r;
  }
  // لا نُرجع تفاصيل الخطأ للمستخدم أبدًا، نسجلها فقط في السجل
  console.error('Unexpected error: ' + (err && err.stack ? err.stack : err));
  return { success: false, code: 'INTERNAL', message: 'حدث خطأ غير متوقع، يرجى المحاولة لاحقًا' };
}

/* ===================== نقطة الدخول ===================== */
function doGet(e) {
  try {
    var page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page).toLowerCase() : 'home';
    var siteName = getSettings_().websiteName;
    // واجهة React مبنية في ملف واحد (Index.html). تُقدَّم كما هي بدون قوالب لأن الكود المبني قد يحتوي على "<?".
    // اختيار الصفحة (عامة/مالك) يتم في المتصفح من ?page=admin، أما الحماية الفعلية فعلى الخادم (requireOwner_).
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle(page === 'admin' ? siteName + ' - لوحة التحكم' : siteName)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    console.error('doGet failed: ' + (err && err.stack ? err.stack : err));
    return renderMessage_('تعذّر تحميل الصفحة', 'حدث خطأ أثناء تحميل الصفحة، يرجى المحاولة لاحقًا.');
  }
}

function renderMessage_(title, message) {
  var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>body{font-family:Tahoma,Arial,sans-serif;background:#f6f7f9;color:#1f2937;display:flex;' +
    'min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}' +
    '.box{background:#fff;border-radius:14px;padding:32px;max-width:460px;text-align:center;' +
    'box-shadow:0 4px 18px rgba(0,0,0,.08)}h1{font-size:1.3rem;margin:0 0 12px}p{margin:0;line-height:1.9;color:#4b5563}' +
    '</style></head><body><div class="box"><h1>' + title + '</h1><p>' + message + '</p></div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  if (APP.INCLUDE_WHITELIST.indexOf(filename) === -1) {
    throw new Error('Include not allowed');
  }
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ===================== المصادقة والصلاحيات ===================== */
/**
 * المالك = البريد الموجود في Script Property باسم OWNER_EMAIL (يمكن وضع أكثر من بريد مفصولين بفاصلة).
 * Session.getActiveUser().getEmail() لا يُرجع بريدًا إلا في نشر "Execute as: User accessing the web app".
 * في أي حالة أخرى يكون فارغًا فتفشل الصلاحية (نظام مغلق افتراضيًا).
 */
function isOwner_() {
  try {
    var owners = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL');
    var email = Session.getActiveUser().getEmail();
    if (!owners || !email) return false;
    var list = owners.split(',').map(function (s) { return s.trim().toLowerCase(); });
    return list.indexOf(email.toLowerCase()) !== -1;
  } catch (e) {
    return false;
  }
}

function requireOwner_() {
  if (!isOwner_()) {
    throw new AppError_('FORBIDDEN', 'غير مصرح لك بتنفيذ هذا الإجراء');
  }
}

/* ===================== أدوات القفل ===================== */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    locked = lock.tryLock(APP.LOCK_WAIT_MS);
    if (!locked) {
      throw new AppError_('LOCK_TIMEOUT', 'النظام مشغول حاليًا، يرجى إعادة المحاولة بعد لحظات');
    }
    return fn();
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (e) { console.error('releaseLock failed: ' + e); }
    }
  }
}

/* ===================== أدوات الجداول ===================== */
var SS_CACHE_ = null;

function getSpreadsheet_() {
  if (SS_CACHE_) return SS_CACHE_;
  try {
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (id) {
      SS_CACHE_ = SpreadsheetApp.openById(id);
    } else {
      SS_CACHE_ = SpreadsheetApp.getActiveSpreadsheet();
    }
  } catch (e) {
    console.error('Spreadsheet access failed: ' + e);
    SS_CACHE_ = null;
  }
  if (!SS_CACHE_) {
    throw new AppError_('NO_SPREADSHEET', 'تعذّر الوصول إلى قاعدة البيانات، يرجى التواصل مع إدارة الموقع');
  }
  return SS_CACHE_;
}

function getTable_(sheetName, requiredHeaders) {
  var sh = getSpreadsheet_().getSheetByName(sheetName);
  if (!sh) {
    throw new AppError_('MISSING_SHEET', 'قاعدة البيانات غير مهيّأة بعد، يرجى التواصل مع إدارة الموقع');
  }
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var index = {};
  headers.forEach(function (h, i) { if (h) index[h] = i; });
  requiredHeaders.forEach(function (h) {
    if (!Object.prototype.hasOwnProperty.call(index, h)) {
      console.error('Missing header "' + h + '" in sheet ' + sheetName);
      throw new AppError_('BAD_HEADERS', 'بنية قاعدة البيانات غير صحيحة، يرجى التواصل مع إدارة الموقع');
    }
  });
  var rows = [];
  var lastRow = sh.getLastRow();
  if (lastRow > 1) {
    var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var i = 0; i < values.length; i++) {
      var o = { _row: i + 2 };
      for (var h in index) { o[h] = values[i][index[h]]; }
      if (String(o[requiredHeaders[0]]).trim() === '') continue; // تجاهل الصفوف الفارغة
      rows.push(o);
    }
  }
  return { sheet: sh, name: sheetName, headers: headers, index: index, rows: rows,
    textCols: APP.TEXT_COLS[sheetName] || [] };
}

function appendRow_(t, obj) {
  var row = t.sheet.getLastRow() + 1;
  t.headers.forEach(function (h, i) {
    if (t.textCols.indexOf(h) !== -1) t.sheet.getRange(row, i + 1).setNumberFormat('@');
  });
  var arr = t.headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : '';
  });
  t.sheet.getRange(row, 1, 1, arr.length).setValues([arr]);
  var rec = { _row: row };
  t.headers.forEach(function (h, i) { rec[h] = arr[i]; });
  t.rows.push(rec);
  return row;
}

function updateRow_(t, rowObj, changes) {
  Object.keys(changes).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(t.index, key)) return;
    var cell = t.sheet.getRange(rowObj._row, t.index[key] + 1);
    if (t.textCols.indexOf(key) !== -1) cell.setNumberFormat('@');
    cell.setValue(changes[key]);
    rowObj[key] = changes[key];
  });
}

function findApartment_(aptTable, apartmentId) {
  for (var i = 0; i < aptTable.rows.length; i++) {
    if (String(aptTable.rows[i].apartmentId).trim() === apartmentId) return aptTable.rows[i];
  }
  return null;
}

/* ===================== أدوات عامة ===================== */
function nowStr_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function todayStr_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd'); }

/** تحويل أي قيمة تاريخ (نص أو Date) إلى yyyy-MM-dd أو نص فارغ */
function normalizeDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, APP.TZ, 'yyyy-MM-dd');
  }
  var s = String(v === null || v === undefined ? '' : v).trim();
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : '';
}

/** تحليل yyyy-MM-dd بدون أي تحويل للمنطقة الزمنية (يعتمد على UTC فقط) */
function parseDateStr_(s) {
  if (typeof s !== 'string') return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  var t = Date.UTC(y, mo - 1, d);
  var dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { key: m[1] + '-' + m[2] + '-' + m[3], utc: t };
}

function nightsBetween_(a, b) { return Math.round((b.utc - a.utc) / 86400000); }

function arabicDigitsToLatin_(s) {
  return String(s).replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
    .replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); });
}

function toNumber_(v) {
  if (typeof v === 'number') return v;
  var s = arabicDigitsToLatin_(String(v === null || v === undefined ? '' : v)).replace(/[,\s]/g, '').replace('٫', '.');
  if (s === '') return NaN;
  return Number(s);
}

/** إزالة محارف التحكم وبادئات الصيغ لمنع حقن الصيغ في الجداول */
function safeText_(s, maxLen) {
  var t = String(s === null || s === undefined ? '' : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/^[\s=+\-@]+/, '').trim();
  return maxLen ? t.substring(0, maxLen) : t;
}

function normalizePhone_(raw) {
  var s = arabicDigitsToLatin_(String(raw === null || raw === undefined ? '' : raw)).trim();
  s = s.replace(/[\s\-().]/g, '');
  if (s.indexOf('00') === 0) s = '+' + s.substring(2);
  return s;
}

function isValidPhone_(p) { return /^\+?\d{8,15}$/.test(p); }

/** تحويل رقم العميل إلى صيغة دولية (أرقام فقط) لاستخدامه في wa.me */
function toInternationalDigits_(phone, countryCode) {
  var p = normalizePhone_(phone);
  var digits = p.replace(/\D/g, '');
  if (p.indexOf('+') === 0) return digits;
  if (digits.indexOf('0') === 0) return String(countryCode || '20') + digits.substring(1);
  return digits;
}

function normalizeWaNumber_(v) {
  var d = arabicDigitsToLatin_(String(v === null || v === undefined ? '' : v)).replace(/\D/g, '');
  if (d.indexOf('00') === 0) d = d.substring(2);
  return d;
}

function normalizeImageUrl_(u) {
  u = String(u || '').trim();
  if (!u) return '';
  var m = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(u) ||
    /drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/.exec(u);
  if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1600';
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(u)) return '';
  return u;
}

function parseImageUrls_(text) {
  var parts = String(text || '').split(/[\r\n|]+|,\s*(?=https?:\/\/)/);
  var out = [];
  parts.forEach(function (p) {
    var n = normalizeImageUrl_(p);
    if (n) out.push(n);
  });
  return out;
}

function parseFacilities_(text) {
  return String(text || '').split(/[,\u060C\n\r|]+/).map(function (s) { return s.trim(); })
    .filter(function (s) { return s; });
}

function isActiveBooking_(b, today) {
  if (String(b.bookingStatus).trim().toUpperCase() !== 'CONFIRMED') return false;
  var end = normalizeDate_(b.endDate);
  return end === '' || end > today;
}

function nextId_(rows, field, regex, prefix, pad) {
  var max = 0;
  rows.forEach(function (r) {
    var m = regex.exec(String(r[field]).trim());
    if (m) max = Math.max(max, Number(m[1]));
  });
  var n = String(max + 1);
  while (n.length < pad) n = '0' + n;
  return prefix + n;
}

/* ===================== الإعدادات ===================== */
function getSettings_() {
  var s = {};
  DEFAULT_SETTINGS_.forEach(function (r) { s[r[0]] = String(r[1]); });
  try {
    var sh = getSpreadsheet_().getSheetByName(APP.SHEET_SETTINGS);
    if (sh && sh.getLastRow() > 1) {
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
      vals.forEach(function (r) {
        var k = String(r[0]).trim();
        if (k && Object.prototype.hasOwnProperty.call(s, k) && r[1] !== '' && r[1] !== null) {
          s[k] = String(r[1]).trim();
        }
      });
    }
  } catch (e) {
    console.error('getSettings_ fallback to defaults: ' + e);
  }
  return s;
}

function getPublicSettings_() {
  var all = getSettings_();
  var out = {};
  PUBLIC_SETTING_KEYS_.forEach(function (k) { out[k] = all[k]; });
  out.ownerWhatsApp = normalizeWaNumber_(out.ownerWhatsApp);
  return out;
}

function getOwnerSettings() {
  try {
    return { success: true, settings: getPublicSettings_() };
  } catch (e) {
    return errorResponse_(e);
  }
}

/* ===================== الشقق (عام) ===================== */
function publicApartment_(r) {
  return {
    apartmentId: String(r.apartmentId).trim(),
    title: String(r.title || ''),
    address: String(r.address || ''),
    description: String(r.description || ''),
    bedrooms: Number(r.bedrooms) || 0,
    bathrooms: Number(r.bathrooms) || 0,
    facilities: parseFacilities_(r.facilities),
    dailyPrice: Number(r.dailyPrice) || 0,
    monthlyPrice: Number(r.monthlyPrice) || 0,
    images: parseImageUrls_(r.imageUrls),
    status: String(r.status).trim().toUpperCase() === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE'
  };
}

function getPublicApartments(filters) {
  try {
    filters = (filters && typeof filters === 'object') ? filters : {};
    var t = getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS);
    var loc = String(filters.location || '').trim().toLowerCase().substring(0, 80);
    var minPrice = toNumber_(filters.minPrice);
    var maxPrice = toNumber_(filters.maxPrice);
    var rooms = Number(filters.rooms) || 0;
    var onlyAvailable = filters.onlyAvailable === true;

    var list = t.rows.map(publicApartment_).filter(function (a) {
      if (loc && (a.title + ' ' + a.address).toLowerCase().indexOf(loc) === -1) return false;
      if (!isNaN(minPrice) && a.dailyPrice < minPrice) return false;
      if (!isNaN(maxPrice) && maxPrice > 0 && a.dailyPrice > maxPrice) return false;
      if (rooms > 0) {
        if (rooms >= 4 ? a.bedrooms < 4 : a.bedrooms !== rooms) return false;
      }
      if (onlyAvailable && a.status !== 'AVAILABLE') return false;
      return true;
    });
    list.sort(function (a, b) {
      if (a.status === b.status) return 0;
      return a.status === 'AVAILABLE' ? -1 : 1;
    });
    return { success: true, apartments: list, total: list.length, settings: getPublicSettings_() };
  } catch (e) {
    return errorResponse_(e);
  }
}

function getApartmentById(apartmentId) {
  try {
    var id = String(apartmentId || '').trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
      throw new AppError_('NOT_FOUND', 'الشقة غير موجودة');
    }
    var t = getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS);
    var row = findApartment_(t, id);
    if (!row) throw new AppError_('NOT_FOUND', 'الشقة غير موجودة');
    return { success: true, apartment: publicApartment_(row), settings: getPublicSettings_() };
  } catch (e) {
    return errorResponse_(e);
  }
}

/* ===================== حساب السعر ===================== */
/**
 * دالة نقية: تحسب السعر من سجل الشقة الفعلي.
 * - أقل من حد الشهر: ليالٍ × السعر اليومي.
 * - من حد الشهر فأكثر: شهور كاملة × السعر الشهري + باقي الليالي × اليومي
 *   (ولا يتجاوز باقي الليالي سعر شهر كامل).
 */
function calculateRentalPrice(apartment, startDate, endDate, settings) {
  var s = parseDateStr_(startDate), e = parseDateStr_(endDate);
  if (!s || !e) throw new AppError_('BAD_DATES', 'تواريخ غير صالحة');
  var nights = nightsBetween_(s, e);
  if (nights < 1) throw new AppError_('BAD_DATES', 'يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول');
  settings = settings || getSettings_();
  var daily = Number(apartment.dailyPrice) || 0;
  var monthly = Number(apartment.monthlyPrice) || 0;
  var threshold = Number(settings.monthlyThresholdNights) || 30;
  var dpm = Number(settings.daysPerMonth) || 30;
  if (daily <= 0 && monthly <= 0) {
    throw new AppError_('NO_PRICE', 'لم يتم تحديد سعر لهذه الشقة، يرجى التواصل مع المالك');
  }
  var effDaily = daily > 0 ? daily : monthly / dpm;
  var months = 0, extra = nights, total;
  if (monthly > 0 && nights >= threshold) {
    months = Math.floor(nights / dpm);
    extra = nights - months * dpm;
  }
  var extraCost = extra * effDaily;
  if (months > 0 && monthly > 0) extraCost = Math.min(extraCost, monthly);
  total = months * monthly + extraCost;
  total = Math.round(total * 100) / 100;
  return { nights: nights, months: months, extraNights: extra, total: total,
    dailyPrice: daily, monthlyPrice: monthly };
}

function getPriceQuote(apartmentId, startDate, endDate) {
  try {
    var id = String(apartmentId || '').trim();
    var s = parseDateStr_(String(startDate || '')), e = parseDateStr_(String(endDate || ''));
    if (!s || !e) throw new AppError_('BAD_DATES', 'يرجى اختيار تاريخين صحيحين');
    if (e.utc <= s.utc) throw new AppError_('BAD_DATES', 'يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول');
    var t = getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS);
    var apt = findApartment_(t, id);
    if (!apt) throw new AppError_('NOT_FOUND', 'الشقة غير موجودة');
    var settings = getSettings_();
    var q = calculateRentalPrice(apt, s.key, e.key, settings);
    if (q.nights > APP.MAX_NIGHTS) {
      throw new AppError_('TOO_LONG', 'أقصى مدة إيجار هي ' + APP.MAX_NIGHTS + ' ليلة');
    }
    q.currency = settings.currency;
    return { success: true, quote: q };
  } catch (err) {
    return errorResponse_(err);
  }
}

/* ===================== التحقق من بيانات الحجز ===================== */
function validateBookingInput(formData) {
  var errors = {};
  var data = {};
  if (!formData || typeof formData !== 'object') {
    return { valid: false, message: 'بيانات الطلب غير صالحة', errors: {} };
  }

  var apartmentId = String(formData.apartmentId || '').trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(apartmentId)) errors.apartmentId = 'الشقة غير صالحة';
  data.apartmentId = apartmentId;

  var name = String(formData.customerName || '').replace(/\s+/g, ' ').trim();
  if (!name) errors.customerName = 'الاسم الكامل مطلوب';
  else if (!/^[\p{L}\p{M}\s.'\u2019\-]{2,80}$/u.test(name)) errors.customerName = 'يرجى إدخال اسم صحيح (حروف فقط، من 2 إلى 80 حرفًا)';
  data.customerName = name;

  var phone = normalizePhone_(formData.customerPhone);
  if (!phone) errors.customerPhone = 'رقم الهاتف مطلوب';
  else if (!isValidPhone_(phone)) errors.customerPhone = 'رقم الهاتف غير صحيح (من 8 إلى 15 رقمًا، ويمكن أن يبدأ بـ +)';
  data.customerPhone = phone;

  var today = todayStr_();
  var s = parseDateStr_(String(formData.startDate || ''));
  var e = parseDateStr_(String(formData.endDate || ''));
  if (!formData.startDate) errors.startDate = 'تاريخ الوصول مطلوب';
  else if (!s) errors.startDate = 'تاريخ الوصول غير صالح';
  else if (s.key < today) errors.startDate = 'لا يمكن اختيار تاريخ وصول في الماضي';
  if (!formData.endDate) errors.endDate = 'تاريخ المغادرة مطلوب';
  else if (!e) errors.endDate = 'تاريخ المغادرة غير صالح';
  if (s && e) {
    var nights = nightsBetween_(s, e);
    if (nights < 1) errors.endDate = 'يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول';
    else if (nights > APP.MAX_NIGHTS) errors.endDate = 'أقصى مدة إيجار هي ' + APP.MAX_NIGHTS + ' ليلة';
  }
  data.startDate = s ? s.key : '';
  data.endDate = e ? e.key : '';

  var notes = safeText_(formData.customerNotes, 500);
  data.customerNotes = notes;
  if (String(formData.customerNotes || '').length > 1000) errors.customerNotes = 'الملاحظات طويلة جدًا';

  var rid = String(formData.requestId || '').trim();
  data.requestId = /^[A-Za-z0-9_-]{8,64}$/.test(rid) ? rid : '';

  if (Object.keys(errors).length) {
    return { valid: false, message: 'يرجى تصحيح الحقول المطلوبة', errors: errors };
  }
  return { valid: true, data: data };
}

/* ===================== الحجز ===================== */
function generateUniqueBookingId_(bookingRows) {
  var rows = bookingRows || getTable_(APP.SHEET_BOOKINGS, APP.BOOKING_HEADERS).rows;
  var max = 1000;
  var seen = {};
  rows.forEach(function (r) {
    var id = String(r.bookingId).trim();
    seen[id] = true;
    var m = /^BK-(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  });
  var n = max + 1;
  while (seen['BK-' + n]) n++;
  return 'BK-' + n;
}

function rollbackBooking_(bookTable, row, bookingId) {
  try {
    var cell = bookTable.sheet.getRange(row, bookTable.index.bookingId + 1);
    if (String(cell.getValue()).trim() === bookingId) {
      bookTable.sheet.deleteRow(row);
      return true;
    }
  } catch (e) {
    console.error('ROLLBACK_FAILED for ' + bookingId + ': ' + e);
  }
  return false;
}

function createBooking(formData) {
  try {
    // 1) التحقق من المدخلات (خارج القفل لأنه لا يقرأ بيانات مشتركة)
    var v = validateBookingInput(formData);
    if (!v.valid) return { success: false, code: 'VALIDATION', message: v.message, errors: v.errors };
    var input = v.data;

    // منع تكرار الإرسال: نفس requestId يُرجع نفس النتيجة الناجحة
    var cache = CacheService.getScriptCache();
    var cacheKey = input.requestId ? 'req_' + input.requestId : '';
    if (cacheKey) {
      var hit = cache.get(cacheKey);
      if (hit) return JSON.parse(hit);
    }

    // 2) التحقق السريع من وجود الشقة (للرفض المبكر فقط - ليس هو التحقق النهائي)
    var preApt = findApartment_(getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS), input.apartmentId);
    if (!preApt) throw new AppError_('NOT_FOUND', 'الشقة غير موجودة');

    // 6-12) القسم الحرج بالكامل داخل القفل (يُحرَّر القفل في finally داخل withLock_)
    return withLock_(function () {
      if (cacheKey) {
        var hit2 = cache.get(cacheKey);
        if (hit2) return JSON.parse(hit2);
      }

      // 7) إعادة قراءة الشقة والحجوزات أثناء الإمساك بالقفل
      var aptT = getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS);
      var bookT = getTable_(APP.SHEET_BOOKINGS, APP.BOOKING_HEADERS);
      var apt = findApartment_(aptT, input.apartmentId);
      if (!apt) throw new AppError_('NOT_FOUND', 'الشقة غير موجودة');

      var today = todayStr_();
      if (input.startDate < today) {
        throw new AppError_('VALIDATION', 'لا يمكن اختيار تاريخ وصول في الماضي', { startDate: 'تاريخ الوصول في الماضي' });
      }

      // 8-9) الحالة + تعارض الحجوزات
      if (String(apt.status).trim().toUpperCase() !== 'AVAILABLE') {
        throw new AppError_('UNAVAILABLE', 'الشقة غير متاحة للحجز حاليًا');
      }
      var conflict = bookT.rows.some(function (b) {
        return String(b.apartmentId).trim() === input.apartmentId && isActiveBooking_(b, today);
      });
      if (conflict) throw new AppError_('UNAVAILABLE', 'الشقة غير متاحة للحجز حاليًا');

      // السعر من سجل الشقة الفعلي (لا نثق بأي سعر من المتصفح)
      var settings = getSettings_();
      var pricing = calculateRentalPrice(apt, input.startDate, input.endDate, settings);

      // 10) إنشاء سجل الحجز
      var bookingId = generateUniqueBookingId_(bookT.rows);
      var now = nowStr_();
      var bookingRow = appendRow_(bookT, {
        bookingId: bookingId,
        apartmentId: input.apartmentId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        startDate: input.startDate,
        endDate: input.endDate,
        rentalDuration: pricing.nights,
        totalPrice: pricing.total,
        customerNotes: input.customerNotes,
        bookingStatus: 'CONFIRMED',
        createdAt: now,
        notificationStatus: 'NOT_SENT'
      });

      // 10-11) تحديث الشقة وحفظ activeBookingId، وإن فشلت نتراجع عن الحجز
      try {
        updateRow_(aptT, apt, { status: 'UNAVAILABLE', activeBookingId: bookingId, updatedAt: now });
        SpreadsheetApp.flush();
      } catch (writeErr) {
        console.error('Apartment update failed for ' + bookingId + ': ' + writeErr);
        rollbackBooking_(bookT, bookingRow, bookingId);
        throw new AppError_('WRITE_FAILED', 'تعذّر إتمام الحجز ولم يتم حفظ أي بيانات، يرجى المحاولة مرة أخرى');
      }

      var response = {
        success: true,
        message: 'تم تسجيل طلب الحجز بنجاح',
        booking: {
          bookingId: bookingId,
          apartmentId: input.apartmentId,
          apartmentTitle: String(apt.title || ''),
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          startDate: input.startDate,
          endDate: input.endDate,
          rentalDuration: pricing.nights,
          totalPrice: pricing.total,
          currency: settings.currency,
          status: 'CONFIRMED'
        },
        settings: getPublicSettings_()
      };
      if (cacheKey) {
        try { cache.put(cacheKey, JSON.stringify(response), APP.IDEMPOTENCY_TTL_SEC); } catch (ce) { /* غير حرج */ }
      }
      return response;
    });
  } catch (err) {
    return errorResponse_(err);
  }
}

/* ===================== إعادة مزامنة حالة الشقة ===================== */
/**
 * تضمن اتساق حالة الشقة مع الحجوزات (آمنة للتكرار):
 *  - يوجد حجز مؤكد نشط  => UNAVAILABLE + activeBookingId
 *  - لا يوجد وكان activeBookingId غير فارغ => AVAILABLE + مسح activeBookingId
 *  - غير ذلك (مثل إيقاف يدوي بدون حجز) => لا تغيير
 * تُرجع: 'blocked' | 'restored' | ''
 */
function reconcileApartment_(aptT, bookT, apt, today, now) {
  var id = String(apt.apartmentId).trim();
  var active = bookT.rows.filter(function (b) {
    return String(b.apartmentId).trim() === id && isActiveBooking_(b, today);
  });
  if (active.length) {
    var bid = String(active[0].bookingId).trim();
    if (String(apt.status).trim().toUpperCase() !== 'UNAVAILABLE' || String(apt.activeBookingId).trim() !== bid) {
      updateRow_(aptT, apt, { status: 'UNAVAILABLE', activeBookingId: bid, updatedAt: now });
      return 'blocked';
    }
    return '';
  }
  if (String(apt.activeBookingId).trim() !== '') {
    updateRow_(aptT, apt, { status: 'AVAILABLE', activeBookingId: '', updatedAt: now });
    return 'restored';
  }
  return '';
}

/* ===================== انتهاء الحجوزات (Trigger) ===================== */
function expireBookings() {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    locked = lock.tryLock(APP.LOCK_WAIT_MS);
    if (!locked) {
      console.warn('expireBookings skipped: could not acquire lock');
      return { success: false, message: 'busy' };
    }
    var today = todayStr_();
    var now = nowStr_();
    var aptT = getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS);
    var bookT = getTable_(APP.SHEET_BOOKINGS, APP.BOOKING_HEADERS);
    var completed = 0, restored = 0, repaired = 0;

    bookT.rows.forEach(function (b) {
      if (String(b.bookingStatus).trim().toUpperCase() !== 'CONFIRMED') return;
      var end = normalizeDate_(b.endDate);
      if (end && end <= today) {
        updateRow_(bookT, b, { bookingStatus: 'COMPLETED' });
        completed++;
      }
    });
    aptT.rows.forEach(function (a) {
      var r = reconcileApartment_(aptT, bookT, a, today, now);
      if (r === 'restored') restored++;
      else if (r === 'blocked') repaired++;
    });
    SpreadsheetApp.flush();
    var result = { success: true, completed: completed, restored: restored, repaired: repaired, ranAt: now };
    console.log('expireBookings: ' + JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('expireBookings failed: ' + (err && err.stack ? err.stack : err));
    return { success: false, message: 'error' };
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (e) { console.error(e); }
    }
  }
}

/* ===================== الإعداد الأولي ===================== */
function ensureSheet_(ss, name, headers, report) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    report.push('تم إنشاء الورقة: ' + name);
  }
  var existing = sh.getLastColumn() > 0
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); })
    : [];
  var isEmptyHeader = existing.join('') === '';
  if (isEmptyHeader) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e5e7eb');
    sh.setFrozenRows(1);
  } else {
    headers.forEach(function (h) {
      if (existing.indexOf(h) === -1) report.push('تحذير: العمود "' + h + '" غير موجود في ورقة ' + name + ' (أضِفه يدويًا)');
    });
  }
  return sh;
}

function setupProject() {
  var report = [];
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) { ss = null; }
  if (!ss) {
    var savedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (savedId) ss = SpreadsheetApp.openById(savedId);
  }
  if (!ss) {
    throw new Error('افتح السكربت من داخل ملف Google Sheets عبر Extensions > Apps Script ثم شغّل setupProject مرة أخرى.');
  }
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID')) props.setProperty('SPREADSHEET_ID', ss.getId());
  if (!props.getProperty('OWNER_EMAIL')) {
    var me = Session.getEffectiveUser().getEmail();
    if (me) {
      props.setProperty('OWNER_EMAIL', me);
      report.push('تم ضبط OWNER_EMAIL = ' + me + ' (يمكنك تغييره من Project Settings > Script Properties)');
    }
  }
  SS_CACHE_ = ss;

  var apt = ensureSheet_(ss, APP.SHEET_APARTMENTS, APP.APT_HEADERS, report);
  var bk = ensureSheet_(ss, APP.SHEET_BOOKINGS, APP.BOOKING_HEADERS, report);
  var st = ensureSheet_(ss, APP.SHEET_SETTINGS, APP.SETTINGS_HEADERS, report);

  // تنسيق نصي للأعمدة الحساسة للتحويل التلقائي
  [[apt, APP.APT_HEADERS, APP.TEXT_COLS.Apartments], [bk, APP.BOOKING_HEADERS, APP.TEXT_COLS.Bookings]]
    .forEach(function (x) {
      x[2].forEach(function (col) {
        var idx = x[1].indexOf(col) + 1;
        if (idx > 0) x[0].getRange(2, idx, 1000, 1).setNumberFormat('@');
      });
    });
  st.getRange(2, 2, 200, 1).setNumberFormat('@');

  // قوائم منسدلة للحالات
  var aptStatusCol = APP.APT_HEADERS.indexOf('status') + 1;
  apt.getRange(2, aptStatusCol, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(APP.APT_STATUS, true).setAllowInvalid(false).build());
  var bkStatusCol = APP.BOOKING_HEADERS.indexOf('bookingStatus') + 1;
  bk.getRange(2, bkStatusCol, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(APP.BOOKING_STATUS, true).setAllowInvalid(false).build());

  // قيم الإعدادات الافتراضية (لا تستبدل ما هو موجود)
  var existingKeys = {};
  if (st.getLastRow() > 1) {
    st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().forEach(function (r) { existingKeys[String(r[0]).trim()] = true; });
  }
  DEFAULT_SETTINGS_.forEach(function (r) {
    if (!existingKeys[r[0]]) {
      var row = st.getLastRow() + 1;
      st.getRange(row, 1, 1, 3).setNumberFormat('@').setValues([[r[0], r[1], r[2]]]);
    }
  });

  report.push(setupExpiryTrigger());
  report.push('اكتمل الإعداد. لا تنسَ ضبط ownerWhatsApp في ورقة Settings.');
  console.log(report.join('\n'));
  return report;
}

function setupExpiryTrigger() {
  var triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === APP.EXPIRY_HANDLER;
  });
  var keep = null;
  triggers.forEach(function (t) {
    if (!keep && t.getEventType() === ScriptApp.EventType.CLOCK) {
      keep = t;
    } else {
      ScriptApp.deleteTrigger(t);
    }
  });
  if (keep) return 'يوجد Trigger لـ expireBookings بالفعل (لم يتم إنشاء نسخة مكررة)';
  ScriptApp.newTrigger(APP.EXPIRY_HANDLER).timeBased().everyHours(1).create();
  return 'تم إنشاء Trigger يعمل كل ساعة لتشغيل expireBookings';
}

/** اختياري: يضيف 3 شقق تجريبية إذا كانت ورقة Apartments فارغة. شغّله من المحرر فقط. */
function addSampleData() {
  setupProject();
  var t = getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS);
  if (t.rows.length > 0) return 'ورقة Apartments ليست فارغة، لم تتم إضافة شيء';
  var now = nowStr_();
  var samples = [
    { apartmentId: 'APT-001', title: 'شقة عصرية بإطلالة على النيل', address: 'الزمالك، القاهرة',
      description: 'شقة مفروشة بالكامل في موقع مميز، قريبة من المطاعم والمواصلات.\nمناسبة للعائلات والزوار.',
      bedrooms: 2, bathrooms: 1, facilities: 'واي فاي, تكييف, مطبخ مجهز, مصعد, موقف سيارة',
      dailyPrice: 900, monthlyPrice: 18000,
      imageUrls: 'https://picsum.photos/seed/apt1a/1200/800\nhttps://picsum.photos/seed/apt1b/1200/800' },
    { apartmentId: 'APT-002', title: 'استوديو أنيق وسط البلد', address: 'وسط البلد، القاهرة',
      description: 'استوديو صغير ومريح للإقامة القصيرة، تشطيب حديث.',
      bedrooms: 1, bathrooms: 1, facilities: 'واي فاي, تكييف, غسالة',
      dailyPrice: 500, monthlyPrice: 10000,
      imageUrls: 'https://picsum.photos/seed/apt2a/1200/800' },
    { apartmentId: 'APT-003', title: 'شقة عائلية واسعة قريبة من البحر', address: 'سيدي بشر، الإسكندرية',
      description: 'ثلاث غرف نوم وصالة كبيرة وشرفة، قريبة من الشاطئ.',
      bedrooms: 3, bathrooms: 2, facilities: 'واي فاي, تكييف, مطبخ مجهز, شرفة, أمن 24 ساعة',
      dailyPrice: 1200, monthlyPrice: 24000,
      imageUrls: 'https://picsum.photos/seed/apt3a/1200/800\nhttps://picsum.photos/seed/apt3b/1200/800' }
  ];
  samples.forEach(function (s) {
    s.status = 'AVAILABLE'; s.activeBookingId = ''; s.createdAt = now; s.updatedAt = now;
    appendRow_(t, s);
  });
  return 'تمت إضافة 3 شقق تجريبية (الصور من picsum.photos للتجربة فقط، استبدلها بصورك)';
}

/* ============================================================
 *                   دوال المالك (Admin)
 * ============================================================ */
function adminCall_(fn) {
  try {
    requireOwner_();
    return fn();
  } catch (e) {
    return errorResponse_(e);
  }
}

function adminApartment_(r) {
  return {
    apartmentId: String(r.apartmentId).trim(),
    title: String(r.title || ''),
    address: String(r.address || ''),
    description: String(r.description || ''),
    bedrooms: Number(r.bedrooms) || 0,
    bathrooms: Number(r.bathrooms) || 0,
    facilities: String(r.facilities || ''),
    dailyPrice: Number(r.dailyPrice) || 0,
    monthlyPrice: Number(r.monthlyPrice) || 0,
    imageUrls: String(r.imageUrls || ''),
    status: String(r.status).trim().toUpperCase() === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE',
    activeBookingId: String(r.activeBookingId || '').trim(),
    createdAt: String(r.createdAt || ''),
    updatedAt: String(r.updatedAt || '')
  };
}

function adminBooking_(b, aptTitles, countryCode) {
  var id = String(b.apartmentId).trim();
  return {
    bookingId: String(b.bookingId).trim(),
    apartmentId: id,
    apartmentTitle: aptTitles[id] || '',
    customerName: String(b.customerName || ''),
    customerPhone: String(b.customerPhone || ''),
    customerWhatsApp: toInternationalDigits_(b.customerPhone, countryCode),
    startDate: normalizeDate_(b.startDate),
    endDate: normalizeDate_(b.endDate),
    rentalDuration: Number(b.rentalDuration) || 0,
    totalPrice: Number(b.totalPrice) || 0,
    customerNotes: String(b.customerNotes || ''),
    bookingStatus: String(b.bookingStatus).trim().toUpperCase(),
    createdAt: String(b.createdAt || ''),
    notificationStatus: String(b.notificationStatus || 'NOT_SENT').trim().toUpperCase()
  };
}

function adminGetDashboard() {
  return adminCall_(function () {
    var aptT = getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS);
    var bookT = getTable_(APP.SHEET_BOOKINGS, APP.BOOKING_HEADERS);
    var today = todayStr_();
    var apartments = aptT.rows.map(adminApartment_);
    var available = apartments.filter(function (a) { return a.status === 'AVAILABLE'; }).length;
    var current = bookT.rows.filter(function (b) { return isActiveBooking_(b, today); }).length;
    var settings = getSettings_();
    return {
      success: true,
      apartments: apartments,
      stats: {
        totalApartments: apartments.length,
        availableApartments: available,
        unavailableApartments: apartments.length - available,
        currentBookings: current,
        totalBookings: bookT.rows.length
      },
      settings: { currency: settings.currency, websiteName: settings.websiteName },
      today: today
    };
  });
}

function adminListBookings(filters) {
  return adminCall_(function () {
    filters = (filters && typeof filters === 'object') ? filters : {};
    var aptT = getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS);
    var bookT = getTable_(APP.SHEET_BOOKINGS, APP.BOOKING_HEADERS);
    var settings = getSettings_();
    var titles = {};
    aptT.rows.forEach(function (a) { titles[String(a.apartmentId).trim()] = String(a.title || ''); });

    var q = String(filters.search || '').trim().toLowerCase().substring(0, 80);
    var qDigits = arabicDigitsToLatin_(q).replace(/\D/g, '');
    var status = String(filters.status || '').trim().toUpperCase();
    var from = parseDateStr_(String(filters.dateFrom || ''));
    var to = parseDateStr_(String(filters.dateTo || ''));

    var list = bookT.rows.map(function (b) { return adminBooking_(b, titles, settings.defaultCountryCode); })
      .filter(function (b) {
        if (status && APP.BOOKING_STATUS.indexOf(status) !== -1 && b.bookingStatus !== status) return false;
        if (from && (!b.startDate || b.startDate < from.key)) return false;
        if (to && (!b.startDate || b.startDate > to.key)) return false;
        if (q) {
          var inText = b.bookingId.toLowerCase().indexOf(q) !== -1 ||
            b.customerName.toLowerCase().indexOf(q) !== -1 ||
            b.customerPhone.toLowerCase().indexOf(q) !== -1;
          var inPhone = qDigits.length >= 3 && b.customerPhone.replace(/\D/g, '').indexOf(qDigits) !== -1;
          if (!inText && !inPhone) return false;
        }
        return true;
      });
    list.reverse(); // الأحدث أولًا
    return { success: true, bookings: list, total: list.length, currency: settings.currency };
  });
}

function validateApartmentInput_(p) {
  var errors = {};
  var d = {};
  if (!p || typeof p !== 'object') throw new AppError_('VALIDATION', 'بيانات غير صالحة');

  var id = String(p.apartmentId || '').trim();
  if (id && !/^[A-Za-z0-9_-]{1,40}$/.test(id)) errors.apartmentId = 'معرّف الشقة غير صالح';
  d.apartmentId = id;

  d.title = safeText_(p.title, 120);
  if (d.title.length < 3) errors.title = 'اسم الشقة مطلوب (3 أحرف على الأقل)';
  d.address = safeText_(p.address, 200);
  if (d.address.length < 3) errors.address = 'العنوان مطلوب';
  d.description = safeText_(p.description, 3000);

  var bed = toNumber_(p.bedrooms), bath = toNumber_(p.bathrooms);
  if (isNaN(bed) || bed < 0 || bed > 30 || Math.floor(bed) !== bed) errors.bedrooms = 'عدد غرف النوم غير صالح';
  if (isNaN(bath) || bath < 0 || bath > 30 || Math.floor(bath) !== bath) errors.bathrooms = 'عدد الحمامات غير صالح';
  d.bedrooms = bed; d.bathrooms = bath;

  var dp = toNumber_(p.dailyPrice), mp = toNumber_(p.monthlyPrice);
  if (isNaN(dp) || dp < 0 || dp > 100000000) errors.dailyPrice = 'السعر اليومي غير صالح';
  if (isNaN(mp) || mp < 0 || mp > 1000000000) errors.monthlyPrice = 'السعر الشهري غير صالح';
  if (!errors.dailyPrice && !errors.monthlyPrice && dp <= 0 && mp <= 0) {
    errors.dailyPrice = 'حدّد سعرًا يوميًا أو شهريًا';
  }
  d.dailyPrice = dp; d.monthlyPrice = mp;

  var fac = parseFacilities_(p.facilities).map(function (f) { return safeText_(f, 60); }).filter(Boolean);
  if (fac.length > 40) errors.facilities = 'عدد المرافق كبير جدًا';
  d.facilities = fac.join(', ');

  var rawImgs = String(p.imageUrls || '').split(/[\r\n|]+|,\s*(?=https?:\/\/)/)
    .map(function (s) { return s.trim(); }).filter(Boolean);
  var imgs = [];
  var badImg = false;
  rawImgs.forEach(function (u) {
    var n = normalizeImageUrl_(u);
    if (n) imgs.push(n); else badImg = true;
  });
  if (badImg) errors.imageUrls = 'يوجد رابط صورة غير صالح (يجب أن يبدأ بـ http:// أو https://)';
  if (imgs.length > 10) errors.imageUrls = 'الحد الأقصى 10 صور';
  d.imageUrls = imgs.join('\n');

  var st = String(p.status || '').trim().toUpperCase();
  if (APP.APT_STATUS.indexOf(st) === -1) errors.status = 'حالة غير صالحة';
  d.status = st;

  if (Object.keys(errors).length) throw new AppError_('VALIDATION', 'يرجى تصحيح الحقول المطلوبة', errors);
  return d;
}

function adminSaveApartment(payload) {
  return adminCall_(function () {
    var d = validateApartmentInput_(payload);
    return withLock_(function () {
      var aptT = getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS);
      var bookT = getTable_(APP.SHEET_BOOKINGS, APP.BOOKING_HEADERS);
      var now = nowStr_();
      var today = todayStr_();
      if (d.apartmentId) {
        var apt = findApartment_(aptT, d.apartmentId);
        if (!apt) throw new AppError_('NOT_FOUND', 'الشقة غير موجودة');
        var hasActive = bookT.rows.some(function (b) {
          return String(b.apartmentId).trim() === d.apartmentId && isActiveBooking_(b, today);
        });
        if (hasActive && d.status === 'AVAILABLE') {
          throw new AppError_('ACTIVE_BOOKING',
            'لا يمكن جعل الشقة متاحة وبها حجز مؤكد نشط. ألغِ الحجز أو أكمله أولًا');
        }
        updateRow_(aptT, apt, {
          title: d.title, address: d.address, description: d.description, bedrooms: d.bedrooms,
          bathrooms: d.bathrooms, facilities: d.facilities, dailyPrice: d.dailyPrice,
          monthlyPrice: d.monthlyPrice, imageUrls: d.imageUrls, status: d.status, updatedAt: now
        });
        SpreadsheetApp.flush();
        return { success: true, message: 'تم تحديث بيانات الشقة', apartment: adminApartment_(apt) };
      }
      var newId = nextId_(aptT.rows, 'apartmentId', /^APT-(\d+)$/, 'APT-', 3);
      appendRow_(aptT, {
        apartmentId: newId, title: d.title, address: d.address, description: d.description,
        bedrooms: d.bedrooms, bathrooms: d.bathrooms, facilities: d.facilities,
        dailyPrice: d.dailyPrice, monthlyPrice: d.monthlyPrice, imageUrls: d.imageUrls,
        status: d.status, activeBookingId: '', createdAt: now, updatedAt: now
      });
      SpreadsheetApp.flush();
      var created = findApartment_(aptT, newId);
      return { success: true, message: 'تمت إضافة الشقة ' + newId, apartment: adminApartment_(created) };
    });
  });
}

function adminUpdateBookingStatus(bookingId, newStatus) {
  return adminCall_(function () {
    var id = String(bookingId || '').trim();
    var target = String(newStatus || '').trim().toUpperCase();
    if (!/^BK-\d+$/.test(id)) throw new AppError_('NOT_FOUND', 'الحجز غير موجود');
    if (target !== 'CANCELLED' && target !== 'COMPLETED') {
      throw new AppError_('VALIDATION', 'الحالة المطلوبة غير مسموحة');
    }
    return withLock_(function () {
      var aptT = getTable_(APP.SHEET_APARTMENTS, APP.APT_HEADERS);
      var bookT = getTable_(APP.SHEET_BOOKINGS, APP.BOOKING_HEADERS);
      var booking = null;
      bookT.rows.forEach(function (b) { if (String(b.bookingId).trim() === id) booking = b; });
      if (!booking) throw new AppError_('NOT_FOUND', 'الحجز غير موجود');
      if (String(booking.bookingStatus).trim().toUpperCase() !== 'CONFIRMED') {
        throw new AppError_('BAD_STATE', 'يمكن تغيير حالة الحجوزات المؤكدة فقط');
      }
      var today = todayStr_();
      if (target === 'COMPLETED') {
        var start = normalizeDate_(booking.startDate);
        if (start && start > today) {
          throw new AppError_('BAD_STATE', 'لا يمكن إكمال حجز لم يبدأ بعد. يمكنك إلغاؤه بدلًا من ذلك');
        }
      }
      var now = nowStr_();
      updateRow_(bookT, booking, { bookingStatus: target });
      var apt = findApartment_(aptT, String(booking.apartmentId).trim());
      var restored = false;
      if (apt) restored = reconcileApartment_(aptT, bookT, apt, today, now) === 'restored';
      SpreadsheetApp.flush();
      return {
        success: true,
        message: target === 'CANCELLED' ? 'تم إلغاء الحجز' : 'تم وضع علامة مكتمل على الحجز',
        apartmentRestored: restored
      };
    });
  });
}

function adminSetNotificationStatus(bookingId, status) {
  return adminCall_(function () {
    var id = String(bookingId || '').trim();
    var st = String(status || '').trim().toUpperCase();
    if (!/^BK-\d+$/.test(id) || APP.NOTIFY_STATUS.indexOf(st) === -1) {
      throw new AppError_('VALIDATION', 'بيانات غير صالحة');
    }
    return withLock_(function () {
      var bookT = getTable_(APP.SHEET_BOOKINGS, APP.BOOKING_HEADERS);
      var booking = null;
      bookT.rows.forEach(function (b) { if (String(b.bookingId).trim() === id) booking = b; });
      if (!booking) throw new AppError_('NOT_FOUND', 'الحجز غير موجود');
      updateRow_(bookT, booking, { notificationStatus: st });
      return { success: true, message: 'تم تحديث حالة الإشعار' };
    });
  });
}
