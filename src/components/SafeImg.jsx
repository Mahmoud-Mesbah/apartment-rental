import { useState } from 'react';
import { PLACEHOLDER } from '../utils.js';

// صورة آمنة: عند فشل التحميل تُستبدل بصورة بديلة مرة واحدة (بدون حلقة)
export default function SafeImg({ src, alt, className, ...rest }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      {...rest}
      className={className}
      alt={alt || ''}
      loading="lazy"
      src={failed || !src ? PLACEHOLDER : src}
      onError={() => setFailed(true)}
    />
  );
}
