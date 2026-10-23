import { useState } from 'react';

export default function Navbar({ name, onNav }) {
  const [open, setOpen] = useState(false);
  const go = (target) => (e) => {
    e.preventDefault();
    setOpen(false);
    onNav(target);
  };
  return (
    <nav className="navbar navbar-expand-lg site-nav sticky-top">
      <div className="container">
        <a className="navbar-brand" href="#" onClick={go('top')}>
          <i className="bi bi-buildings-fill ms-2" />
          {name}
        </a>
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="mainNav"
          aria-expanded={open}
          aria-label="تبديل القائمة"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className={`navbar-collapse collapse ${open ? 'show' : ''}`} id="mainNav">
          <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
            <li className="nav-item"><a className="nav-link" href="#" onClick={go('top')}>الرئيسية</a></li>
            <li className="nav-item"><a className="nav-link" href="#" onClick={go('apartments')}>الشقق</a></li>
            <li className="nav-item"><a className="nav-link" href="#" onClick={go('contact')}>تواصل معنا</a></li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
