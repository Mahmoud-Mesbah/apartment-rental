export default function StatusBadge({ status, className = '' }) {
  const ok = status === 'AVAILABLE';
  return (
    <span className={`badge rounded-pill ${ok ? 'badge-available' : 'badge-unavailable'} ${className}`}>
      <i className={`bi ${ok ? 'bi-check-circle' : 'bi-x-circle'} ms-1`} />
      {ok ? 'متاحة' : 'غير متاحة'}
    </span>
  );
}
