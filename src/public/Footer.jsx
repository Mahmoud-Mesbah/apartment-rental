const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export default function Footer({ settings }) {
  const s = settings;
  const phone = s.contactPhone;
  const email = s.contactEmail && EMAIL_RE.test(s.contactEmail) ? s.contactEmail : '';
  const address = s.contactAddress;
  const any = phone || email || address;
  return (
    <footer className="site-footer" id="contact">
      <div className="container">
        <div className="row g-4">
          <div className="col-md-5">
            <h2><i className="bi bi-buildings-fill ms-2" />{s.websiteName}</h2>
            <p className="small mb-0">منصة لحجز الشقق المفروشة بخطوات بسيطة وأسعار واضحة.</p>
          </div>
          <div className="col-md-7">
            <h2>تواصل معنا</h2>
            <ul className="list-unstyled small mb-0">
              {phone && (
                <li>
                  <i className="bi bi-telephone ms-2" />
                  <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`} dir="ltr">{phone}</a>
                </li>
              )}
              {email && (
                <li>
                  <i className="bi bi-envelope ms-2" />
                  <a href={`mailto:${email}`}>{email}</a>
                </li>
              )}
              {address && (
                <li>
                  <i className="bi bi-geo-alt ms-2" />
                  <span>{address}</span>
                </li>
              )}
              {!any && <li>سيتم إضافة بيانات التواصل قريبًا.</li>}
            </ul>
          </div>
        </div>
        <hr className="border-secondary" />
        <div className="small text-center">
          جميع الحقوق محفوظة © {new Date().getFullYear().toLocaleString('ar-EG', { useGrouping: false })}
        </div>
      </div>
    </footer>
  );
}
