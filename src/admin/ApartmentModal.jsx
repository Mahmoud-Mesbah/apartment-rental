import { useEffect, useState } from 'react';
import { call } from '../api.js';
import { NETWORK_MSG } from '../utils.js';

const toForm = (a) => ({
  apartmentId: a ? a.apartmentId : '',
  title: a ? a.title : '',
  address: a ? a.address : '',
  description: a ? a.description : '',
  bedrooms: a ? a.bedrooms : 1,
  bathrooms: a ? a.bathrooms : 1,
  dailyPrice: a ? a.dailyPrice : 0,
  monthlyPrice: a ? a.monthlyPrice : 0,
  facilities: a ? a.facilities : '',
  imageUrls: a ? a.imageUrls : '',
  status: a ? a.status : 'AVAILABLE'
});

export default function ApartmentModal({ apartment, onClose, onSaved, toast }) {
  const isEdit = !!apartment;
  const [form, setForm] = useState(() => toForm(apartment));
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const cls = (k, base = 'form-control') => `${base} ${errors[k] ? 'is-invalid' : ''}`;

  async function submit(ev) {
    ev.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});
    setAlert('');
    try {
      const res = await call('adminSaveApartment', form);
      if (res && res.success) {
        toast(res.message, 'success');
        onSaved();
        return;
      }
      setErrors((res && res.errors) || {});
      setAlert((res && res.message) || 'تعذّر الحفظ');
    } catch (e) {
      setAlert(NETWORK_MSG);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop-custom">
      <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="aptModalTitle">
        <div className="modal-dialog modal-lg">
          <form className="modal-content" onSubmit={submit} noValidate>
            <div className="modal-header">
              <h2 className="modal-title h5" id="aptModalTitle">{isEdit ? 'تعديل الشقة' : 'إضافة شقة'}</h2>
              <button type="button" className="btn-close ms-0 me-auto" aria-label="إغلاق" onClick={onClose} disabled={saving} />
            </div>
            <div className="modal-body">
              {alert && <div className="alert alert-danger" role="alert">{alert}</div>}
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label" htmlFor="apId">رقم الشقة</label>
                  <input id="apId" className="form-control" readOnly value={form.apartmentId} placeholder="يُولَّد تلقائيًا" />
                </div>
                <div className="col-md-8">
                  <label className="form-label" htmlFor="apTitle">اسم الشقة <span className="text-danger">*</span></label>
                  <input id="apTitle" className={cls('title')} maxLength={120} value={form.title} onChange={set('title')} />
                  <div className="invalid-feedback">{errors.title}</div>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="apAddress">العنوان الكامل <span className="text-danger">*</span></label>
                  <input id="apAddress" className={cls('address')} maxLength={200} value={form.address} onChange={set('address')} />
                  <div className="invalid-feedback">{errors.address}</div>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="apDescription">الوصف</label>
                  <textarea id="apDescription" className={cls('description')} rows={3} maxLength={3000}
                    value={form.description} onChange={set('description')} />
                  <div className="invalid-feedback">{errors.description}</div>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="apBedrooms">غرف النوم</label>
                  <input id="apBedrooms" type="number" min="0" max="30" className={cls('bedrooms')} value={form.bedrooms} onChange={set('bedrooms')} />
                  <div className="invalid-feedback">{errors.bedrooms}</div>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="apBathrooms">الحمامات</label>
                  <input id="apBathrooms" type="number" min="0" max="30" className={cls('bathrooms')} value={form.bathrooms} onChange={set('bathrooms')} />
                  <div className="invalid-feedback">{errors.bathrooms}</div>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="apDaily">السعر اليومي</label>
                  <input id="apDaily" type="number" min="0" step="any" className={cls('dailyPrice')} value={form.dailyPrice} onChange={set('dailyPrice')} />
                  <div className="invalid-feedback">{errors.dailyPrice}</div>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="apMonthly">السعر الشهري</label>
                  <input id="apMonthly" type="number" min="0" step="any" className={cls('monthlyPrice')} value={form.monthlyPrice} onChange={set('monthlyPrice')} />
                  <div className="invalid-feedback">{errors.monthlyPrice}</div>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="apFacilities">المرافق (افصل بينها بفاصلة أو سطر جديد)</label>
                  <textarea id="apFacilities" className={cls('facilities')} rows={2} value={form.facilities} onChange={set('facilities')} />
                  <div className="invalid-feedback">{errors.facilities}</div>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="apImages">روابط الصور (رابط في كل سطر، حتى 10)</label>
                  <textarea id="apImages" className={cls('imageUrls')} rows={3} dir="ltr" placeholder="https://..."
                    value={form.imageUrls} onChange={set('imageUrls')} />
                  <div className="form-text">تُدعم الروابط المباشرة وروابط مشاركة Google Drive (الملف متاح لأي شخص لديه الرابط).</div>
                  <div className="invalid-feedback">{errors.imageUrls}</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="apStatus">الحالة</label>
                  <select id="apStatus" className={cls('status', 'form-select')} value={form.status} onChange={set('status')}>
                    <option value="AVAILABLE">متاحة (AVAILABLE)</option>
                    <option value="UNAVAILABLE">غير متاحة (UNAVAILABLE)</option>
                  </select>
                  <div className="invalid-feedback">{errors.status}</div>
                </div>
                {isEdit && (
                  <div className="col-md-6">
                    <label className="form-label">الحجز النشط</label>
                    <div className="form-control bg-light">{apartment.activeBookingId || '—'}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>إلغاء</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true" />}
                حفظ
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
