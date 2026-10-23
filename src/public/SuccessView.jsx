import { buildOwnerMessage, fmtDate, nightsText, num, waUrl } from '../utils.js';

export default function SuccessView({ booking: b, settings, onHome }) {
  // الرابط يُبنى فقط بعد أن أكد الخادم تسجيل الحجز (هذه الشاشة لا تظهر قبل ذلك)
  const href = waUrl(settings.ownerWhatsApp, buildOwnerMessage(b));
  const rows = [
    ['رقم الحجز', b.bookingId],
    ['الشقة', `${b.apartmentId} - ${b.apartmentTitle}`],
    ['الاسم', b.customerName],
    ['الهاتف', b.customerPhone],
    ['تاريخ الوصول', fmtDate(b.startDate)],
    ['تاريخ المغادرة', fmtDate(b.endDate)],
    ['مدة الإيجار', nightsText(b.rentalDuration)],
    ['السعر الإجمالي', `${num(b.totalPrice)} ${b.currency || ''}`],
    ['الحالة', 'مؤكد']
  ];
  return (
    <section className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-7">
          <div className="panel text-center">
            <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3.2rem' }} />
            <h1 className="h3 mt-2">تم تسجيل طلب الحجز بنجاح</h1>
            <p className="text-muted">احتفظ برقم الحجز للرجوع إليه.</p>

            <dl className="row summary-list text-start mt-4 mb-0">
              {rows.map(([k, v]) => (
                <div className="row m-0 p-0" key={k}>
                  <dt className="col-5">{k}</dt>
                  <dd className="col-7">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="alert alert-info text-start mt-3" role="note">
              <i className="bi bi-info-circle ms-1" />
              حجزك مسجّل بالفعل. لإبلاغ المالك يمكنك فتح واتساب برسالة جاهزة، لكن{' '}
              <strong>فتح واتساب لا يُرسل الرسالة تلقائيًا</strong> — يجب أن تضغط زر «إرسال» بنفسك.
            </div>

            <div className="d-grid gap-2">
              {href ? (
                <a className="btn btn-success btn-lg" href={href} target="_blank" rel="noopener noreferrer">
                  <i className="bi bi-whatsapp ms-1" />فتح واتساب لإرسال تفاصيل الحجز
                </a>
              ) : (
                <div className="small text-muted">رقم واتساب المالك غير مُعدّ حاليًا. حجزك مسجّل، وسيتواصل معك المالك.</div>
              )}
              <button type="button" className="btn btn-outline-secondary" onClick={onHome}>العودة إلى الشقق</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
