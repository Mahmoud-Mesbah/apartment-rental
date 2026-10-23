import { useEffect, useState } from 'react';
import { call } from '../api.js';
import { NETWORK_MSG } from '../utils.js';
import ApartmentCard from './ApartmentCard.jsx';

export default function ListView({ settings, applied, onApply, onOpen, onSettings }) {
  const [draft, setDraft] = useState(applied);
  const [state, setState] = useState({ status: 'loading', list: [], msg: '' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let off = false;
    setState((s) => ({ ...s, status: 'loading' }));
    call('getPublicApartments', {
      location: applied.location.trim(),
      minPrice: applied.minPrice,
      maxPrice: applied.maxPrice,
      rooms: Number(applied.rooms) || 0,
      onlyAvailable: applied.onlyAvailable
    })
      .then((res) => {
        if (off) return;
        if (!res || !res.success) {
          setState({ status: 'error', list: [], msg: (res && res.message) || '' });
          return;
        }
        onSettings(res.settings);
        setState({ status: 'ok', list: res.apartments, msg: '' });
      })
      .catch(() => { if (!off) setState({ status: 'error', list: [], msg: NETWORK_MSG }); });
    return () => { off = true; };
  }, [applied, reloadKey, onSettings]);

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = (e) => { e.preventDefault(); onApply({ ...draft }); };
  const reset = () => {
    const empty = { location: '', minPrice: '', maxPrice: '', rooms: '0', onlyAvailable: false };
    setDraft(empty);
    onApply(empty);
  };

  return (
    <div>
      <section className="hero text-center" id="top">
        <div className="container">
          <h1>ابحث عن شقتك المثالية بسهولة</h1>
          <p className="lead">
            شقق مفروشة ومجهزة بأسعار واضحة وحجز مباشر. اختر الموقع والميزانية وعدد الغرف ثم احجز في دقائق.
          </p>
          <form className="search-card text-start" onSubmit={submit} noValidate>
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-4">
                <label className="form-label" htmlFor="fLocation">الموقع</label>
                <input id="fLocation" className="form-control" maxLength={80} placeholder="مثال: الزمالك"
                  value={draft.location} onChange={set('location')} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label" htmlFor="fMinPrice">أقل سعر يومي</label>
                <input id="fMinPrice" type="number" min="0" inputMode="numeric" className="form-control" placeholder="0"
                  value={draft.minPrice} onChange={set('minPrice')} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label" htmlFor="fMaxPrice">أعلى سعر يومي</label>
                <input id="fMaxPrice" type="number" min="0" inputMode="numeric" className="form-control" placeholder="بدون حد"
                  value={draft.maxPrice} onChange={set('maxPrice')} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label" htmlFor="fRooms">غرف النوم</label>
                <select id="fRooms" className="form-select" value={draft.rooms} onChange={set('rooms')}>
                  <option value="0">الكل</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4 أو أكثر</option>
                </select>
              </div>
              <div className="col-6 col-md-2 d-grid">
                <button type="submit" className="btn btn-primary"><i className="bi bi-search ms-1" />بحث</button>
              </div>
            </div>
            <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
              <div className="form-check">
                <input id="fOnlyAvailable" type="checkbox" className="form-check-input"
                  checked={draft.onlyAvailable} onChange={set('onlyAvailable')} />
                <label className="form-check-label" htmlFor="fOnlyAvailable">إظهار الشقق المتاحة فقط</label>
              </div>
              <button type="button" className="btn btn-link text-decoration-none p-0" onClick={reset}>إعادة ضبط البحث</button>
            </div>
          </form>
        </div>
      </section>

      <section className="container pt-4" id="apartments" aria-live="polite">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h4 mb-0">الشقق</h2>
          {state.status === 'ok' && state.list.length > 0 && (
            <span className="text-muted small">{state.list.length.toLocaleString('ar-EG')} شقة</span>
          )}
        </div>

        {state.status === 'loading' && (
          <div className="state-box">
            <div className="spinner-border text-primary" role="status" aria-hidden="true" />
            <div className="mt-3">جارٍ تحميل الشقق...</div>
          </div>
        )}
        {state.status === 'error' && (
          <div className="state-box">
            <i className="bi bi-exclamation-triangle text-danger" />
            <div className="fw-bold">{state.msg || 'تعذّر تحميل الشقق'}</div>
            <button type="button" className="btn btn-outline-primary mt-3" onClick={() => setReloadKey((k) => k + 1)}>
              إعادة المحاولة
            </button>
          </div>
        )}
        {state.status === 'ok' && state.list.length === 0 && (
          <div className="state-box">
            <i className="bi bi-house-x" />
            <div className="fw-bold">لا توجد شقق مطابقة لبحثك</div>
            <div className="small">جرّب تغيير الفلاتر أو إعادة ضبط البحث.</div>
          </div>
        )}
        {state.status === 'ok' && state.list.length > 0 && (
          <div className="row g-4">
            {state.list.map((a) => (
              <ApartmentCard key={a.apartmentId} apartment={a} currency={settings.currency} onOpen={onOpen} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
