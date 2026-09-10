(() => {
  const products = {
    'migdale': { name: 'Migdale', src: '/products/migdale.jpg' },
    'caju': { name: 'Caju', src: '/products/caju.jpg' },
    'caju-prajit': { name: 'Caju în coajă prăjit', src: '/products/caju-prajit.jpg' },
    'caju-fara-coaja-prajit': { name: 'Caju fără coajă prăjit', src: '/products/caju-fara-coaja-prajit.jpg' },
    'fistic-american': { name: 'Fistic American', src: '/products/fistic-american.jpg' },
    'miez-fistic': { name: 'Miez de Fistic', src: '/products/miez-fistic.jpg' },
    'nuci-grecesti': { name: 'Nuci Grecești', src: '/products/nuci-grecesti.jpg' },
    'arahide-crude': { name: 'Arahide crude', src: '/products/arahide-crude.jpg' },
    'macadamia-coaja': { name: 'Macadamia în coajă', src: '/products/macadamia-coaja.jpg' },
    'nuci-braziliene': { name: 'Nuci braziliene', src: '/products/nuci-braziliene.jpg' },
  };

  const byName = Object.fromEntries(Object.entries(products).map(([id, item]) => [item.name, { id, ...item }]));

  function setPhoto(img, id, item) {
    if (!img || img.dataset.productPhoto === id) return;
    img.src = item.src;
    img.alt = item.name;
    img.dataset.productPhoto = id;
    img.style.display = '';
  }

  function applyProductPhotos() {
    for (const [id, item] of Object.entries(products)) {
      const card = document.getElementById(`product-${id}`);
      setPhoto(card?.querySelector('img'), id, item);
    }

    // „Nou în catalog” nu are ID pe card, de aceea îl identificăm după denumire.
    document.querySelectorAll('button').forEach((button) => {
      const img = button.querySelector('img');
      const nameNode = button.querySelector('strong');
      if (!img || !nameNode) return;
      const item = byName[nameNode.textContent?.trim() || ''];
      if (item) setPhoto(img, item.id, item);
    });
  }

  let scheduled = false;
  const scheduleApply = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyProductPhotos();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleApply, { once: true });
  } else {
    scheduleApply();
  }

  new MutationObserver(scheduleApply).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
