// خادم وهمي في الذاكرة لمعاينة الواجهة محليًا (npm run dev) فقط.
// لا يُستخدم داخل Apps Script: هناك تُنفَّذ الدوال الحقيقية في Code.gs.
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
const wait = (v, ms = 250) => new Promise((r) => setTimeout(() => r(JSON.parse(JSON.stringify(v))), ms));

const db = {
  settings: {
    websiteName: 'شقق للإيجار (وضع المعاينة)', ownerWhatsApp: '201000000000', currency: 'جنيه',
    contactPhone: '+20 100 000 0000', contactEmail: 'info@example.com', contactAddress: 'القاهرة، مصر'
  },
  apartments: [
    { apartmentId: 'APT-001', title: 'شقة عصرية بإطلالة على النيل', address: 'الزمالك، القاهرة',
      description: 'شقة مفروشة بالكامل في موقع مميز.\nمناسبة للعائلات والزوار.', bedrooms: 2, bathrooms: 1,
      facilities: 'واي فاي, تكييف, مطبخ مجهز, مصعد', dailyPrice: 900, monthlyPrice: 18000,
      imageUrls: 'https://picsum.photos/seed/apt1a/1200/800\nhttps://picsum.photos/seed/apt1b/1200/800',
      status: 'AVAILABLE', activeBookingId: '' },
    { apartmentId: 'APT-002', title: 'استوديو أنيق وسط البلد', address: 'وسط البلد، القاهرة',
      description: 'استوديو مريح للإقامة القصيرة.', bedrooms: 1, bathrooms: 1,
      facilities: 'واي فاي, تكييف, غسالة', dailyPrice: 500, monthlyPrice: 10000,
      imageUrls: 'https://picsum.photos/seed/apt2a/1200/800', status: 'AVAILABLE', activeBookingId: '' },
    { apartmentId: 'APT-003', title: 'شقة عائلية قريبة من البحر', address: 'سيدي بشر، الإسكندرية',
      description: 'ثلاث غرف نوم وشرفة.', bedrooms: 3, bathrooms: 2,
      facilities: 'واي فاي, تكييف, شرفة', dailyPrice: 1200, monthlyPrice: 24000,
      imageUrls: 'https://picsum.photos/seed/apt3a/1200/800', status: 'AVAILABLE', activeBookingId: '' }
  ],
  bookings: []
};

const split = (t, re) => String(t || '').split(re).map((s) => s.trim()).filter(Boolean);
const pub = (a) => ({
  apartmentId: a.apartmentId, title: a.title, address: a.address, description: a.description,
  bedrooms: a.bedrooms, bathrooms: a.bathrooms, facilities: split(a.facilities, /[,\n]+/),
  dailyPrice: a.dailyPrice, monthlyPrice: a.monthlyPrice, images: split(a.imageUrls, /\n+/), status: a.status
});
const find = (id) => db.apartments.find((a) => a.apartmentId === id);

function price(a, s, e) {
  const n = Math.round((Date.parse(e) - Date.parse(s)) / 864e5);
  let months = 0, extra = n;
  if (a.monthlyPrice > 0 && n >= 30) { months = Math.floor(n / 30); extra = n - months * 30; }
  let ec = extra * (a.dailyPrice || a.monthlyPrice / 30);
  if (months > 0 && a.monthlyPrice > 0) ec = Math.min(ec, a.monthlyPrice);
  return { nights: n, months, extraNights: extra, total: months * a.monthlyPrice + ec,
    dailyPrice: a.dailyPrice, monthlyPrice: a.monthlyPrice, currency: db.settings.currency };
}

const bk = (b) => ({ ...b, apartmentTitle: (find(b.apartmentId) || {}).title || '',
  customerWhatsApp: String(b.customerPhone).replace(/\D/g, '').replace(/^0/, '20') });

function release(aptId) {
  const a = find(aptId);
  if (!a) return false;
  const active = db.bookings.some((b) => b.apartmentId === aptId && b.bookingStatus === 'CONFIRMED');
  if (!active && a.activeBookingId) { a.activeBookingId = ''; a.status = 'AVAILABLE'; return true; }
  return false;
}

const handlers = {
  getOwnerSettings: () => ({ success: true, settings: db.settings }),
  getPublicApartments: (f = {}) => {
    const loc = String(f.location || '').toLowerCase();
    let list = db.apartments.map(pub).filter((a) => {
      if (loc && !(a.title + ' ' + a.address).toLowerCase().includes(loc)) return false;
      if (f.minPrice !== '' && f.minPrice != null && a.dailyPrice < Number(f.minPrice)) return false;
      if (Number(f.maxPrice) > 0 && a.dailyPrice > Number(f.maxPrice)) return false;
      if (f.rooms > 0 && (f.rooms >= 4 ? a.bedrooms < 4 : a.bedrooms !== f.rooms)) return false;
      if (f.onlyAvailable && a.status !== 'AVAILABLE') return false;
      return true;
    });
    list = [...list.filter((a) => a.status === 'AVAILABLE'), ...list.filter((a) => a.status !== 'AVAILABLE')];
    return { success: true, apartments: list, total: list.length, settings: db.settings };
  },
  getApartmentById: (id) => {
    const a = find(id);
    return a ? { success: true, apartment: pub(a), settings: db.settings } : { success: false, message: 'الشقة غير موجودة' };
  },
  getPriceQuote: (id, s, e) => {
    const a = find(id);
    if (!a) return { success: false, message: 'الشقة غير موجودة' };
    if (!s || !e || e <= s) return { success: false, message: 'يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول' };
    return { success: true, quote: price(a, s, e) };
  },
  createBooking: (f) => {
    const a = find(f.apartmentId);
    if (!a) return { success: false, code: 'NOT_FOUND', message: 'الشقة غير موجودة' };
    if (db.bookings.some((b) => b.requestId === f.requestId)) {
      return { success: false, code: 'DUP', message: 'تم تسجيل هذا الطلب سابقًا' };
    }
    if (a.status !== 'AVAILABLE') return { success: false, code: 'UNAVAILABLE', message: 'الشقة غير متاحة للحجز حاليًا' };
    if (f.startDate < today()) return { success: false, code: 'VALIDATION', message: 'يرجى تصحيح الحقول المطلوبة', errors: { startDate: 'لا يمكن اختيار تاريخ وصول في الماضي' } };
    const p = price(a, f.startDate, f.endDate);
    const id = 'BK-' + (1001 + db.bookings.length);
    db.bookings.push({ bookingId: id, apartmentId: a.apartmentId, customerName: f.customerName, customerPhone: f.customerPhone,
      startDate: f.startDate, endDate: f.endDate, rentalDuration: p.nights, totalPrice: p.total, customerNotes: f.customerNotes || '',
      bookingStatus: 'CONFIRMED', createdAt: new Date().toISOString(), notificationStatus: 'NOT_SENT', requestId: f.requestId });
    a.status = 'UNAVAILABLE'; a.activeBookingId = id;
    return { success: true, message: 'تم تسجيل طلب الحجز بنجاح', settings: db.settings,
      booking: { bookingId: id, apartmentId: a.apartmentId, apartmentTitle: a.title, customerName: f.customerName,
        customerPhone: f.customerPhone, startDate: f.startDate, endDate: f.endDate, rentalDuration: p.nights,
        totalPrice: p.total, currency: db.settings.currency, status: 'CONFIRMED' } };
  },
  adminGetDashboard: () => {
    const avail = db.apartments.filter((a) => a.status === 'AVAILABLE').length;
    return { success: true, apartments: db.apartments, today: today(), settings: { currency: db.settings.currency },
      stats: { totalApartments: db.apartments.length, availableApartments: avail, unavailableApartments: db.apartments.length - avail,
        currentBookings: db.bookings.filter((b) => b.bookingStatus === 'CONFIRMED').length, totalBookings: db.bookings.length } };
  },
  adminListBookings: (f = {}) => {
    const q = String(f.search || '').toLowerCase();
    const list = db.bookings.map(bk).filter((b) =>
      (!f.status || b.bookingStatus === f.status) && (!f.dateFrom || b.startDate >= f.dateFrom) && (!f.dateTo || b.startDate <= f.dateTo) &&
      (!q || [b.bookingId, b.customerName, b.customerPhone].some((x) => String(x).toLowerCase().includes(q)))).reverse();
    return { success: true, bookings: list, total: list.length, currency: db.settings.currency };
  },
  adminSaveApartment: (p) => {
    const errors = {};
    if (!p.title || p.title.trim().length < 3) errors.title = 'اسم الشقة مطلوب (3 أحرف على الأقل)';
    if (!p.address || p.address.trim().length < 3) errors.address = 'العنوان مطلوب';
    if (!(Number(p.dailyPrice) > 0 || Number(p.monthlyPrice) > 0)) errors.dailyPrice = 'حدّد سعرًا يوميًا أو شهريًا';
    if (Object.keys(errors).length) return { success: false, code: 'VALIDATION', message: 'يرجى تصحيح الحقول المطلوبة', errors };
    const data = { title: p.title.trim(), address: p.address.trim(), description: p.description, bedrooms: Number(p.bedrooms) || 0,
      bathrooms: Number(p.bathrooms) || 0, facilities: p.facilities, dailyPrice: Number(p.dailyPrice) || 0,
      monthlyPrice: Number(p.monthlyPrice) || 0, imageUrls: p.imageUrls, status: p.status };
    if (p.apartmentId) {
      const a = find(p.apartmentId);
      if (!a) return { success: false, message: 'الشقة غير موجودة' };
      if (a.activeBookingId && data.status === 'AVAILABLE') return { success: false, code: 'ACTIVE_BOOKING', message: 'لا يمكن جعل الشقة متاحة وبها حجز مؤكد نشط. ألغِ الحجز أو أكمله أولًا' };
      Object.assign(a, data);
      return { success: true, message: 'تم تحديث بيانات الشقة' };
    }
    const id = 'APT-' + String(db.apartments.length + 1).padStart(3, '0');
    db.apartments.push({ apartmentId: id, activeBookingId: '', ...data });
    return { success: true, message: 'تمت إضافة الشقة ' + id };
  },
  adminUpdateBookingStatus: (id, status) => {
    const b = db.bookings.find((x) => x.bookingId === id);
    if (!b || b.bookingStatus !== 'CONFIRMED') return { success: false, message: 'يمكن تغيير حالة الحجوزات المؤكدة فقط' };
    b.bookingStatus = status;
    return { success: true, message: status === 'CANCELLED' ? 'تم إلغاء الحجز' : 'تم وضع علامة مكتمل على الحجز', apartmentRestored: release(b.apartmentId) };
  },
  adminSetNotificationStatus: (id, st) => {
    const b = db.bookings.find((x) => x.bookingId === id);
    if (!b) return { success: false, message: 'الحجز غير موجود' };
    b.notificationStatus = st;
    return { success: true, message: 'تم تحديث حالة الإشعار' };
  }
};

export function mockCall(name, ...args) {
  const fn = handlers[name];
  if (!fn) return Promise.reject(new Error('unknown function ' + name));
  return wait(fn(...args));
}
