import { useEffect } from 'react';

export default function ConfirmModal({ title, body, danger, busy, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="modal-backdrop-custom">
      <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5" id="confirmTitle">{title}</h2>
              <button type="button" className="btn-close ms-0 me-auto" aria-label="إغلاق" onClick={onCancel} disabled={busy} />
            </div>
            <div className="modal-body">{body}</div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>تراجع</button>
              <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
                {busy && <span className="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true" />}
                تأكيد
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
