import { useEffect, useState } from 'react';
import { call } from '../api.js';
import { NETWORK_MSG, money, nightsText, waUrl } from '../utils.js';
import ConfirmModal from './ConfirmModal.jsx';

const BK_LABEL = { CONFIRMED: 'مؤكد', COMPLETED: 'مكتمل', CANCELLED: 'ملغي' };
const BK_CLASS = { CONFIRMED: 'badge-confirmed', COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled' };
const EMPTY = { search: '', status: '', dateFrom: '', dateTo: '' };

function customerMessage(b, currency) {
  return [
    `مرحبًا ${b.customerName}،`,
    'بخصوص حجزك:',
    `رقم الحجز: ${b.bookingId}`,
    `الشقة: ${b.apartmentId} - ${b.apartmentTitle}`,
    `تاريخ الوصول: ${b.startDate}`,
    `تاريخ المغادرة: ${b.endDate}`,
    `مدة الإيجار: ${b.rentalDuration} ليلة`,
    `السعر الإجمالي: ${b.totalPrice} ${currency}`,
    `حالة الحجز: ${BK_LABEL[b.bookingStatus] || b.bookingStatus} (${b.bookingStatus})`
  ].join('\n');
}

export default function BookingsPanel({ currency, reloadKey, onDenied, onChanged, toast }) {
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [state, setState] = useState({ status: 'loading', list: [] });
  const [confirm, setConfirm] = useState(null); // {booking, target}
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    setState((s) => ({ ...s, status: 'loading' }));
    call('adminListBookings', applied)
      .then((res) => {
        if (off) return;
        if (!res || !res.success) {
          if (res && res.code === 'FORBIDDEN') { onDenied(); return; }
          toast((res && res.message) || 'تعذّر تحميل الحجوزات', 'danger');
          setState({ status: 'ok', list: [] });
          return;
        }
        setState({ status: 'ok', list: res.bookings });
      })
      .catch(() => { if (!off) { toast(NETWORK_MSG, 'danger'); setState({ status: 'ok', list: [] }); } });
    return () => { off = true; };
  }, [applied, reloadKey, onDenied, toast]);

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  async function runStatus() {
    setBusy(true);
    try {
      const res = await call('adminUpdateBookingStatus', confirm.booking.bookingId, confirm.target);
      if (res && res.success) {
        toast(res.message + (res.apartmentRestored ? ' — أُعيدت الشقة إلى متاحة' : ''), 'success');
        setConfirm(null);
        onChanged();
      } else {
        toast((res && res.message) || 'تعذّر تنفيذ الإجراء', 'danger');
        setConfirm(null);
      }
    } catch (e) {
      toast(NETWORK_MSG, 'danger');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotify(b) {
    const next = b.notificationStatus === 'SENT_MANUALLY' ? 'NOT_SENT' : 'SENT_MANUALLY';
    try {
      const res = await call('adminSetNotificationStatus', b.bookingId, next);
      if (res && res.success) {
        toast(res.message, 'success');
        setState((s) => ({ ...s, list: s.list.map((x) => (x.bookingId === b.bookingId ? { ...x, notificationStatus: next } : x)) }));
      } else toast((res && res.message) || 'تعذّر التحديث', 'danger');
    } catch (e) { toast(NETWORK_MSG, 'danger'); }
  }

  const isCancel = confirm && confirm.target === 'CANCELLED';

  return (
    <section>
      <h2 className="h5 mb-3">إدارة الحجوزات</h2>
      <form className="panel mb-3" onSubmit={(e) => { e.preventDefault(); setApplied({ ...draft }); }} noValidate>
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-4">
            <label className="form-label small" htmlFor="bfSearch">بحث (رقم الحجز / الاسم / الهاتف)</label>
            <input id="bfSearch" className="form-control" maxLength={80} value={draft.search} onChange={set('search')} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="bfStatus">الحالة</label>
            <select id="bfStatus" className="form-select" value={draft.status} onChange={set('status')}>
              <option value="">الكل</option>
              <option value="CONFIRMED">مؤكد</option>
              <option value="COMPLETED">مكتمل</option>
              <option value="CANCELLED">ملغي</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="bfFrom">وصول من</label>
            <input id="bfFrom" type="date" className="form-control" value={draft.dateFrom} onChange={set('dateFrom')} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="bfTo">وصول إلى</label>
            <input id="bfTo" type="date" className="form-control" value={draft.dateTo} onChange={set('dateTo')} />
          </div>
          <div className="col-6 col-md-2 d-flex gap-2">
            <button type="submit" className="btn btn-primary flex-fill">بحث</button>
            <button type="button" className="btn btn-outline-secondary" aria-label="مسح الفلاتر" title="مسح الفلاتر"
              onClick={() => { setDraft(EMPTY); setApplied(EMPTY); }}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
      </form>

      <div className="panel p-0">
        {state.status === 'loading' && (
          <div className="state-box"><div className="spinner-border text-primary" role="status" aria-hidden="true" /></div>
        )}
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>رقم الحجز</th><th>الشقة</th><th>العميل</th><th>الفترة</th><th>المدة</th>
                <th>الإجمالي</th><th>الحالة</th><th>الإشعار</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {state.list.map((b) => {
                const wa = waUrl(b.customerWhatsApp, customerMessage(b, currency));
                const sent = b.notificationStatus === 'SENT_MANUALLY';
                return (
                  <tr key={b.bookingId}>
                    <td>{b.bookingId}</td>
                    <td className="cell-wrap"><div>{b.apartmentId}</div><div className="small text-muted">{b.apartmentTitle}</div></td>
                    <td className="cell-wrap">
                      <div className="fw-bold">{b.customerName}</div>
                      <div className="small text-muted" dir="ltr">{b.customerPhone}</div>
                      {b.customerNotes && <div className="small text-muted">ملاحظة: {b.customerNotes}</div>}
                    </td>
                    <td className="text-nowrap"><div>{b.startDate}</div><div>{b.endDate}</div></td>
                    <td>{nightsText(b.rentalDuration)}</td>
                    <td className="text-nowrap">{money(b.totalPrice, currency)}</td>
                    <td><span className={`badge rounded-pill ${BK_CLASS[b.bookingStatus] || ''}`}>{BK_LABEL[b.bookingStatus] || b.bookingStatus}</span></td>
                    <td>
                      <span className={`badge rounded-pill ${sent ? 'badge-sent' : 'badge-notsent'}`}>{sent ? 'أُرسل يدويًا' : 'لم يُرسل'}</span>
                      <button type="button" className="btn btn-link btn-sm p-0 d-block" onClick={() => toggleNotify(b)}>
                        {sent ? 'تعليم كغير مُرسل' : 'تعليم كمُرسل'}
                      </button>
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {wa && (
                          <a className="btn btn-success btn-sm" href={wa} target="_blank" rel="noopener noreferrer"
                            title="فتح واتساب (لا يرسل تلقائيًا)" aria-label="فتح واتساب"><i className="bi bi-whatsapp" /></a>
                        )}
                        {b.bookingStatus === 'CONFIRMED' && (
                          <>
                            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setConfirm({ booking: b, target: 'COMPLETED' })}>إكمال</button>
                            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setConfirm({ booking: b, target: 'CANCELLED' })}>إلغاء</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {state.status === 'ok' && state.list.length === 0 && (
          <div className="state-box"><i className="bi bi-calendar-x" />لا توجد حجوزات مطابقة.</div>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          title={isCancel ? 'إلغاء الحجز' : 'إكمال الحجز'}
          danger={isCancel}
          busy={busy}
          body={isCancel
            ? `سيتم إلغاء الحجز ${confirm.booking.bookingId} وإعادة الشقة إلى متاحة. هل أنت متأكد؟`
            : `سيتم وضع علامة مكتمل على الحجز ${confirm.booking.bookingId} وإعادة الشقة إلى متاحة. هل أنت متأكد؟`}
          onConfirm={runStatus}
          onCancel={() => setConfirm(null)}
        />
      )}
    </section>
  );
}
