(() => {
  const CACHE_VERSION = '20260911-5';

  const DIRECT_IMAGES = {
    'migdale': '/products/migdale.jpg',
    'caju': '/products/caju.jpg',
    'caju-prajit': '/products/caju-prajit.jpg',
    'caju-fara-coaja-prajit': '/products/caju-fara-coaja-prajit.jpg',
    'fistic-american': '/products/fistic-american.jpg',
    'miez-fistic': '/products/miez-fistic.jpg',
    'nuci-grecesti': '/products/nuci-grecesti.jpg',
    'arahide-crude': '/products/arahide-crude.jpg',
    'macadamia-coaja': '/products/macadamia-coaja.jpg',
    'nuci-braziliene': '/products/nuci-braziliene.jpg',
  };

  const products = [
    ['migdale', 'Migdale'],
    ['caju', 'Caju'],
    ['caju-prajit', 'Caju în coajă prăjit'],
    ['caju-fara-coaja-prajit', 'Caju fără coajă prăjit'],
    ['fistic-american', 'Fistic American'],
    ['miez-fistic', 'Miez de Fistic'],
    ['nuci-grecesti', 'Nuci Grecești'],
    ['arahide-crude', 'Arahide crude'],
    ['macadamia-coaja', 'Macadamia în coajă'],
    ['nuci-braziliene', 'Nuci braziliene'],
  ].map(([id, name]) => ({ id, name }));

  const byName = new Map(products.map((item) => [item.name, item]));
  let scheduled = false;

  function useDirectImage(img, item) {
    if (!img) return;
    const direct = DIRECT_IMAGES[item.id];
    if (!direct) return;

    if (!img.dataset.originalSrc) {
      img.dataset.originalSrc = img.getAttribute('src') || '';
    }

    const wanted = `${direct}?v=${CACHE_VERSION}`;
    if (img.getAttribute('src') !== wanted) img.src = wanted;

    img.alt = item.name;
    img.dataset.productPhoto = item.id;
    img.style.display = '';
    img.style.objectFit = 'cover';
    img.style.imageRendering = 'auto';
    img.loading = 'eager';

    img.onerror = () => {
      const fallback = img.dataset.originalSrc;
      img.onerror = null;
      if (fallback) img.src = fallback;
      img.style.display = '';
    };
  }

  function applyProductPhotos() {
    products.forEach((item) => {
      const card = document.getElementById(`product-${item.id}`);
      useDirectImage(card?.querySelector('img'), item);
    });

    document.querySelectorAll('button').forEach((button) => {
      const image = button.querySelector('img');
      const nameNode = button.querySelector('strong');
      if (!image || !nameNode) return;
      const item = byName.get(nameNode.textContent?.trim() || '');
      if (item) useDirectImage(image, item);
    });
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyProductPhotos();
    });
  }

  function init() {
    applyProductPhotos();
    new MutationObserver(scheduleApply).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();