import { useEffect, useState } from 'react';
import { call } from '../api.js';
import { NETWORK_MSG, money } from '../utils.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Gallery from './Gallery.jsx';
import BookingForm from './BookingForm.jsx';

export default function DetailView({ id, currency, onBack, onSuccess, onSettings }) {
  const [state, setState] = useState({ status: 'loading', apartment: null, msg: '' });

  useEffect(() => {
    let off = false;
    setState({ status: 'loading', apartment: null, msg: '' });
    call('getApartmentById', id)
      .then((res) => {
        if (off) return;
        if (!res || !res.success) {
          setState({ status: 'error', apartment: null, msg: (res && res.message) || 'تعذّر تحميل الشقة' });
          return;
        }
        onSettings(res.settings);
        setState({ status: 'ok', apartment: res.apartment, msg: '' });
      })
      .catch(() => { if (!off) setState({ status: 'error', apartment: null, msg: NETWORK_MSG }); });
    return () => { off = true; };
  }, [id, onSettings]);

  const a = state.apartment;
  const markUnavailable = () => setState((s) => ({ ...s, apartment: { ...s.apartment, status: 'UNAVAILABLE' } }));

  return (
    <section className="container py-4">
      <button type="button" className="btn btn-outline-secondary mb-3" onClick={onBack}>
        <i className="bi bi-arrow-right ms-1" />العودة إلى الشقق
      </button>

      {state.status === 'loading' && (
        <div className="state-box">
          <div className="spinner-border text-primary" role="status" aria-hidden="true" />
          <div className="mt-3">جارٍ تحميل تفاصيل الشقة...</div>
        </div>
      )}
      {state.status === 'error' && (
        <div className="state-box">
          <i className="bi bi-exclamation-triangle text-danger" />
          <div className="fw-bold">{state.msg}</div>
        </div>
      )}

      {a && (
        <div className="row g-4">
          <div className="col-lg-7">
            <Gallery key={a.apartmentId} images={a.images} title={a.title} />
            <div className="panel mt-4">
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                <div>
                  <h1 className="h3 mb-1">{a.title}</h1>
                  <div className="text-muted"><i className="bi bi-geo-alt ms-1" />{a.address}</div>
                  <div className="text-muted small mt-1">رقم الشقة: {a.apartmentId}</div>
                </div>
                <StatusBadge status={a.status} className="fs-6" />
              </div>
              <hr />
              <div className="row text-center g-3">
                <div className="col-6 col-md-3"><div className="text-muted small">غرف النوم</div><div className="fw-bold">{a.bedrooms}</div></div>
                <div className="col-6 col-md-3"><div className="text-muted small">الحمامات</div><div className="fw-bold">{a.bathrooms}</div></div>
                <div className="col-6 col-md-3"><div className="text-muted small">السعر اليومي</div>
                  <div className="fw-bold text-primary">{a.dailyPrice > 0 ? money(a.dailyPrice, currency) : '—'}</div></div>
                <div className="col-6 col-md-3"><div className="text-muted small">السعر الشهري</div>
                  <div className="fw-bold text-primary">{a.monthlyPrice > 0 ? money(a.monthlyPrice, currency) : '—'}</div></div>
              </div>
              <hr />
              <h2 className="h6">الوصف</h2>
              <p className="pre-line mb-3">{a.description || 'لا يوجد وصف.'}</p>
              <h2 className="h6">المرافق</h2>
              <div>
                {a.facilities.length ? a.facilities.map((f, i) => (
                  <span className="facility-chip" key={f + i}><i className="bi bi-check2" />{f}</span>
                )) : <span className="text-muted small">لم يتم تحديد مرافق.</span>}
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="panel sticky-panel">
              <h2 className="h5 mb-3"><i className="bi bi-calendar-check ms-1 text-primary" />احجز هذه الشقة</h2>
              {a.status === 'AVAILABLE' ? (
                <BookingForm
                  key={a.apartmentId}
                  apartment={a}
                  currency={currency}
                  onSuccess={onSuccess}
                  onUnavailable={markUnavailable}
                />
              ) : (
                <div className="alert alert-warning" role="alert">هذه الشقة غير متاحة للحجز حاليًا.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
