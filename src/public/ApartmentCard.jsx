import SafeImg from '../components/SafeImg.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { money } from '../utils.js';

export default function ApartmentCard({ apartment: a, currency, onOpen }) {
  const hasDaily = a.dailyPrice > 0;
  return (
    <div className="col-12 col-md-6 col-lg-4">
      <article className="apt-card">
        <div className="apt-card-media">
          <SafeImg key={a.images[0] || 'none'} src={a.images[0]} alt={a.title} className="apt-card-img" />
          <StatusBadge status={a.status} className="apt-badge" />
        </div>
        <div className="apt-card-body">
          <div className="apt-title">{a.title}</div>
          <div className="apt-meta"><i className="bi bi-geo-alt ms-1" />{a.address}</div>
          <div className="apt-specs">
            <span><i className="bi bi-door-closed ms-1" />{a.bedrooms} غرف</span>
            <span><i className="bi bi-droplet ms-1" />{a.bathrooms} حمام</span>
          </div>
          <div className="mt-auto">
            <div className="apt-price">
              {money(hasDaily ? a.dailyPrice : a.monthlyPrice, currency)}
              <small>{hasDaily ? ' / ليلة' : ' / شهر'}</small>
            </div>
            <button type="button" className="btn btn-primary mt-3" onClick={() => onOpen(a.apartmentId)}>
              عرض التفاصيل <i className="bi bi-arrow-left me-1" />
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
