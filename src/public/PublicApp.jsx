import { useCallback, useEffect, useState } from 'react';
import { call } from '../api.js';
import { scrollToId } from '../utils.js';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import ListView from './ListView.jsx';
import DetailView from './DetailView.jsx';
import SuccessView from './SuccessView.jsx';

const DEFAULT_SETTINGS = {
  websiteName: 'شقق للإيجار', ownerWhatsApp: '', currency: 'جنيه',
  contactPhone: '', contactEmail: '', contactAddress: ''
};
const EMPTY_FILTERS = { location: '', minPrice: '', maxPrice: '', rooms: '0', onlyAvailable: false };

export default function PublicApp() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [view, setView] = useState({ name: 'list' });
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const mergeSettings = useCallback((s) => {
    if (s) setSettings((prev) => ({ ...prev, ...s }));
  }, []);

  useEffect(() => {
    let off = false;
    call('getOwnerSettings')
      .then((r) => { if (!off && r && r.success) mergeSettings(r.settings); })
      .catch(() => { /* غير حرج */ });
    return () => { off = true; };
  }, [mergeSettings]);

  useEffect(() => { document.title = settings.websiteName || document.title; }, [settings.websiteName]);

  const toList = () => { setView({ name: 'list' }); window.scrollTo(0, 0); };
  const onNav = (id) => {
    if (view.name !== 'list' && id !== 'contact') {
      setView({ name: 'list' });
      setTimeout(() => scrollToId(id), 60);
    } else {
      scrollToId(id);
    }
  };

  return (
    <>
      <Navbar name={settings.websiteName} onNav={onNav} />
      <main>
        {view.name === 'list' && (
          <ListView
            settings={settings}
            applied={filters}
            onApply={setFilters}
            onSettings={mergeSettings}
            onOpen={(id) => { setView({ name: 'detail', id }); window.scrollTo(0, 0); }}
          />
        )}
        {view.name === 'detail' && (
          <DetailView
            key={view.id}
            id={view.id}
            currency={settings.currency}
            onBack={toList}
            onSettings={mergeSettings}
            onSuccess={(res) => {
              mergeSettings(res.settings);
              setView({ name: 'success', booking: res.booking });
              window.scrollTo(0, 0);
            }}
          />
        )}
        {view.name === 'success' && <SuccessView booking={view.booking} settings={settings} onHome={toList} />}
      </main>
      <Footer settings={settings} />
    </>
  );
}
