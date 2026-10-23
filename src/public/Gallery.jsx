import { useState } from 'react';
import SafeImg from '../components/SafeImg.jsx';

export default function Gallery({ images, title }) {
  const [index, setIndex] = useState(0);
  const list = images.length ? images : [''];
  const current = list[Math.min(index, list.length - 1)];
  return (
    <div>
      <SafeImg key={current || 'none'} src={current} alt={title} className="gallery-main" loading="eager" />
      {list.length > 1 && (
        <div className="gallery-thumbs">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className={`gallery-thumb ${i === index ? 'active' : ''}`}
              aria-label={`عرض الصورة ${i + 1}`}
              onClick={() => setIndex(i)}
            >
              <SafeImg src={src} alt="" className="gallery-thumb-img" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
