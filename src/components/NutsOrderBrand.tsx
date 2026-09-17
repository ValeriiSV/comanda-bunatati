import { useEffect } from 'react';

const NUTS_LOGO = '/nuci-logo-orbico-2026.jpg';

export default function NutsOrderBrand() {
  useEffect(() => {
    document.title = 'Nuci & Fructe Uscate · Orbico Market';

    const applyBrand = () => {
      document.querySelectorAll('img').forEach((node) => {
        const image = node as HTMLImageElement;
        if (
          image.src.includes('valera-logo') ||
          image.src.includes('nuci-fructe-logo') ||
          image.alt.includes('Bunătăți împreună cu Valera') ||
          image.alt === 'Nuci & Fructe Uscate'
        ) {
          if (!image.src.includes('nuci-logo-orbico-2026.jpg')) image.src = NUTS_LOGO;
          image.alt = 'Nuci & Fructe Uscate';
          image.classList.remove('rounded-full');
          image.classList.add('rounded-xl');
          image.style.objectFit = 'cover';
        }
      });

      document.querySelectorAll('p,h1,h2,h3,span').forEach((node) => {
        const text = (node.textContent || '').trim();
        if (text === 'Bunătăți împreună cu Valera' || text === 'Comanda lunii') {
          node.textContent = 'Nuci & Fructe Uscate';
        }
        if (text === 'Live · comanda lunii') {
          node.textContent = 'LIVE · NUCI & FRUCTE USCATE';
        }
      });
    };

    applyBrand();
    const observer = new MutationObserver(() => window.requestAnimationFrame(applyBrand));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
