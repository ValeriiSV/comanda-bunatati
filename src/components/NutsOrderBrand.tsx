import { useEffect } from 'react';

export default function NutsOrderBrand() {
  useEffect(() => {
    document.title = 'Nuci & Fructe Uscate · Orbico Market';

    const applyBrand = () => {
      document.querySelectorAll('img').forEach((node) => {
        const image = node as HTMLImageElement;
        if (image.src.includes('valera-logo') || image.alt.includes('Bunătăți împreună cu Valera')) {
          image.src = '/nuci-fructe-logo.jpg?v=3';
          image.alt = 'Nuci & Fructe Uscate';
          image.classList.remove('rounded-full');
          image.classList.add('rounded-xl');
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
