import { useEffect, useState } from 'react';
import { getPageParam } from './api.js';
import PublicApp from './public/PublicApp.jsx';
import AdminApp from './admin/AdminApp.jsx';

// الصفحة تُحدَّد من ?page=admin. الحماية الحقيقية للمالك على الخادم (requireOwner_)،
// وهذا الاختيار هنا لعرض الواجهة المناسبة فقط.
export default function App() {
  const [page, setPage] = useState(null);

  useEffect(() => {
    let off = false;
    getPageParam().then((p) => { if (!off) setPage(p); });
    return () => { off = true; };
  }, []);

  if (page === null) {
    return (
      <div className="state-box">
        <div className="spinner-border text-primary" role="status" aria-hidden="true" />
        <div className="mt-3">جارٍ التحميل...</div>
      </div>
    );
  }
  return page === 'admin' ? <AdminApp /> : <PublicApp />;
}
