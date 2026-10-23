import { useCallback, useEffect, useState } from 'react';
import { call } from '../api.js';
import { NETWORK_MSG, money } from '../utils.js';
import { Toasts, useToasts } from '../components/Toasts.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ApartmentModal from './ApartmentModal.jsx';
import BookingsPanel from './BookingsPanel.jsx';

const STATS = [
  ['totalApartments', 'إجمالي الشقق', 'bi-buildings'],
  ['availableApartments', 'الشقق المتاحة', 'bi-check-circle'],
  ['unavailableApartments', 'الشقق غير المتاحة', 'bi-x-circle'],
  ['currentBookings', 'الحجوزات الحالية', 'bi-calendar-check']
];

export default function AdminApp() {
  const toasts = useToasts();
  const { push: toast } = toasts;
  const [data, setData] = useState(null); // {apartments, stats, currency}
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState('apartments');
  const [modal, setModal] = useState(undefined); // undefined=مغلق، null=إضافة، object=تعديل
  const [reloadKey, setReloadKey] = useState(0);

  const markDenied = useCallback(() => setDenied(true), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await call('adminGetDashboard');
      if (res && res.success) {
        setDenied(false);
        setData({ apartments: res.apartments, stats: res.stats, currency: (res.settings && res.settings.currency) || '' });
      } else if (res && res.code === 'FORBIDDEN') {
        setDenied(true);
      } else {
        toast((res && res.message) || 'تعذّر تحميل البيانات', 'danger');
      }
    } catch (e) {
      toast(NETWORK_MSG, 'danger');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const refreshAll = () => { setReloadKey((k) => k + 1); load(); };

  return (
    <>
      <nav className="admin-nav py-2">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="brand"><i className="bi bi-speedometer2 ms-2" />لوحة تحكم المالك</div>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={refreshAll} disabled={loading}>
            <i className="bi bi-arrow-clockwise ms-1" />تحديث
          </button>
        </div>
      </nav>

      <main className="container py-4">
        {denied && (
          <div className="panel state-box">
            <i className="bi bi-shield-lock text-danger" />
            <div className="fw-bold">غير مصرح</div>
            <div className="small">هذه الصفحة مخصصة للمالك فقط. افتحها بحساب Google الخاص بالمالك عبر رابط لوحة التحكم.</div>
          </div>
        )}

        {!denied && loading && !data && (
          <div className="state-box">
            <div className="spinner-border text-primary" role="status" aria-hidden="true" />
            <div className="mt-3">جارٍ تحميل البيانات...</div>
          </div>
        )}

        {!denied && data && (
          <>
            <div className="row g-3 mb-4">
              {STATS.map(([key, label, icon]) => (
                <div className="col-6 col-lg-3" key={key}>
                  <div className="stat-card">
                    <div className="stat-icon"><i className={`bi ${icon}`} /></div>
                    <div>
                      <div className="stat-value">{Number(data.stats[key]).toLocaleString('ar-EG')}</div>
                      <div className="stat-label">{label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-bottom mb-3">
              <button type="button" className={`tab-btn ${tab === 'apartments' ? 'active' : ''}`} onClick={() => setTab('apartments')}>الشقق</button>
              <button type="button" className={`tab-btn ${tab === 'bookings' ? 'active' : ''}`} onClick={() => setTab('bookings')}>الحجوزات</button>
            </div>

            {tab === 'apartments' && (
              <section>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h2 className="h5 mb-0">إدارة الشقق</h2>
                  <button type="button" className="btn btn-primary" onClick={() => setModal(null)}>
                    <i className="bi bi-plus-lg ms-1" />إضافة شقة
                  </button>
                </div>
                <div className="panel p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead>
                        <tr><th>الرقم</th><th>الشقة</th><th>غرف/حمامات</th><th>يومي</th><th>شهري</th><th>الحالة</th><th>حجز نشط</th><th /></tr>
                      </thead>
                      <tbody>
                        {data.apartments.map((a) => (
                          <tr key={a.apartmentId}>
                            <td>{a.apartmentId}</td>
                            <td className="cell-wrap"><div className="fw-bold">{a.title}</div><div className="small text-muted">{a.address}</div></td>
                            <td>{a.bedrooms} / {a.bathrooms}</td>
                            <td>{a.dailyPrice > 0 ? money(a.dailyPrice) : '—'}</td>
                            <td>{a.monthlyPrice > 0 ? money(a.monthlyPrice) : '—'}</td>
                            <td><StatusBadge status={a.status} /></td>
                            <td>{a.activeBookingId || '—'}</td>
                            <td>
                              <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setModal(a)}>
                                <i className="bi bi-pencil ms-1" />تعديل
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {data.apartments.length === 0 && (
                    <div className="state-box"><i className="bi bi-house" />لا توجد شقق بعد. أضف أول شقة.</div>
                  )}
                </div>
              </section>
            )}

            {tab === 'bookings' && (
              <BookingsPanel currency={data.currency} reloadKey={reloadKey} onDenied={markDenied} onChanged={refreshAll} toast={toast} />
            )}
          </>
        )}
      </main>

      {modal !== undefined && (
        <ApartmentModal
          apartment={modal}
          toast={toast}
          onClose={() => setModal(undefined)}
          onSaved={() => { setModal(undefined); load(); }}
        />
      )}
      <Toasts items={toasts.items} dismiss={toasts.dismiss} />
    </>
  );
}
