import { useEffect, useRef, useState } from 'react';
import { call } from '../api.js';
import { NETWORK_MSG, genRequestId, money, nextDay, nightsText, normalizePhone, todayCairo } from '../utils.js';

const EMPTY = { customerName: '', customerPhone: '', startDate: '', endDate: '', customerNotes: '' };

export default function BookingForm({ apartment, currency, onSuccess, onUnavailable }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  // نفس المعرّف يُعاد إرساله عند إعادة المحاولة فلا يتكرر الحجز على الخادم
  const requestId = useRef(genRequestId());
  const today = todayCairo();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // السعر التقديري من الخادم (نفس دالة حساب السعر المستخدمة عند الحجز)
  useEffect(() => {
    setQuote(null);
    setQuoteError('');
    if (!form.startDate || !form.endDate) return undefined;
    if (form.endDate <= form.startDate) {
      setQuoteError('يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول');
      return undefined;
    }
    let off = false;
    call('getPriceQuote', apartment.apartmentId, form.startDate, form.endDate)
      .then((res) => {
        if (off) return;
        if (res && res.success) setQuote(res.quote);
        else setQuoteError((res && res.message) || 'تعذّر حساب السعر');
      })
      .catch(() => { if (!off) setQuoteError('تعذّر حساب السعر الآن. سيُحسب السعر النهائي عند الحجز.'); });
    return () => { off = true; };
  }, [form.startDate, form.endDate, apartment.apartmentId]);

  function validate() {
    const e = {};
    const name = form.customerName.replace(/\s+/g, ' ').trim();
    const phone = normalizePhone(form.customerPhone);
    if (!name) e.customerName = 'الاسم الكامل مطلوب';
    else if (name.length < 2) e.customerName = 'الاسم قصير جدًا';
    if (!phone) e.customerPhone = 'رقم الهاتف مطلوب';
    else if (!/^\+?\d{8,15}$/.test(phone)) e.customerPhone = 'رقم الهاتف غير صحيح (من 8 إلى 15 رقمًا)';
    if (!form.startDate) e.startDate = 'تاريخ الوصول مطلوب';
    else if (form.startDate < today) e.startDate = 'لا يمكن اختيار تاريخ في الماضي';
    if (!form.endDate) e.endDate = 'تاريخ المغادرة مطلوب';
    else if (form.startDate && form.endDate <= form.startDate) e.endDate = 'يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول';
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    if (submitting) return;
    const v = validate();
    setErrors(v);
    setAlert('');
    if (Object.keys(v).length) return;
    setSubmitting(true);
    try {
      const res = await call('createBooking', { ...form, apartmentId: apartment.apartmentId, requestId: requestId.current });
      if (res && res.success) {
        onSuccess(res);
        return;
      }
      setErrors((res && res.errors) || {});
      setAlert((res && res.message) || 'تعذّر تسجيل الحجز');
      if (res && (res.code === 'UNAVAILABLE' || res.code === 'NOT_FOUND')) onUnavailable();
    } catch (err) {
      setAlert(`${NETWORK_MSG} إن كنت غير متأكد من تسجيل الحجز فأعد الضغط على الزر ولن يتكرر الحجز.`);
    } finally {
      setSubmitting(false);
    }
  }

  const cls = (k) => `form-control ${errors[k] ? 'is-invalid' : ''}`;

  return (
    <form onSubmit={submit} noValidate>
      {alert && <div className="alert alert-danger" role="alert">{alert}</div>}

      <div className="mb-3">
        <label htmlFor="bkName" className="form-label">الاسم الكامل <span className="text-danger">*</span></label>
        <input id="bkName" className={cls('customerName')} maxLength={80} autoComplete="name"
          value={form.customerName} onChange={set('customerName')} />
        <div className="invalid-feedback">{errors.customerName}</div>
      </div>
      <div className="mb-3">
        <label htmlFor="bkPhone" className="form-label">رقم الهاتف <span className="text-danger">*</span></label>
        <input id="bkPhone" type="tel" className={cls('customerPhone')} maxLength={20} autoComplete="tel" inputMode="tel"
          dir="ltr" placeholder="01012345678 أو +201012345678" value={form.customerPhone} onChange={set('customerPhone')} />
        <div className="invalid-feedback">{errors.customerPhone}</div>
      </div>
      <div className="row g-3">
        <div className="col-6">
          <label htmlFor="bkStart" className="form-label">تاريخ الوصول <span className="text-danger">*</span></label>
          <input id="bkStart" type="date" className={cls('startDate')} min={today} value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate && f.endDate <= e.target.value ? '' : f.endDate }))} />
          <div className="invalid-feedback">{errors.startDate}</div>
        </div>
        <div className="col-6">
          <label htmlFor="bkEnd" className="form-label">تاريخ المغادرة <span className="text-danger">*</span></label>
          <input id="bkEnd" type="date" className={cls('endDate')} min={form.startDate ? nextDay(form.startDate) : today}
            value={form.endDate} onChange={set('endDate')} />
          <div className="invalid-feedback">{errors.endDate}</div>
        </div>
      </div>
      <div className="my-3">
        <label htmlFor="bkNotes" className="form-label">ملاحظات (اختياري)</label>
        <textarea id="bkNotes" className={cls('customerNotes')} rows={3} maxLength={500}
          value={form.customerNotes} onChange={set('customerNotes')} />
        <div className="invalid-feedback">{errors.customerNotes}</div>
      </div>

      {quote && (
        <div className="quote-box mb-3" aria-live="polite">
          <div className="d-flex justify-content-between"><span>مدة الإيجار</span><strong>{nightsText(quote.nights)}</strong></div>
          <div className="d-flex justify-content-between">
            <span>السعر الإجمالي التقديري</span>
            <span className="quote-total">{money(quote.total, quote.currency || currency)}</span>
          </div>
          <div className="small text-muted mt-1">
            {quote.months > 0
              ? `${quote.months.toLocaleString('ar-EG')} شهر × ${money(quote.monthlyPrice, currency)}${quote.extraNights > 0 ? ` + ${nightsText(quote.extraNights)}` : ''}`
              : `${nightsText(quote.nights)} × ${money(quote.dailyPrice > 0 ? quote.dailyPrice : quote.monthlyPrice / 30, currency)}`}
          </div>
        </div>
      )}
      {quoteError && <div className="small text-danger mb-3">{quoteError}</div>}

      <div className="d-grid">
        <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
          {submitting && <span className="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true" />}
          {submitting ? 'جارٍ تسجيل الحجز...' : 'تأكيد طلب الحجز'}
        </button>
      </div>
      <p className="small text-muted mt-3 mb-0">
        سيتم تسجيل الحجز مباشرة وتصبح الشقة غير متاحة لغيرك. السعر النهائي يُحسب على الخادم.
      </p>
    </form>
  );
}
