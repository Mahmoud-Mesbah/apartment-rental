import { useCallback, useState } from 'react';

export function useToasts() {
  const [items, setItems] = useState([]);
  const dismiss = useCallback((id) => setItems((l) => l.filter((i) => i.id !== id)), []);
  const push = useCallback((msg, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, msg, type }]);
    setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), 6000);
  }, []);
  return { items, push, dismiss };
}

export function Toasts({ items, dismiss }) {
  return (
    <div className="toast-area" aria-live="assertive">
      {items.map((t) => (
        <div key={t.id} className={`alert alert-${t.type} alert-dismissible`} role="alert">
          {t.msg}
          <button type="button" className="btn-close" aria-label="إغلاق" onClick={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
