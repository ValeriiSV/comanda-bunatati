(() => {
  const TILE_WIDTH = 80;
  const TILE_HEIGHT = 45;
  const COLUMNS = 8;
  const ATLAS_PARTS = [
    '/product-atlas-v2/part-01.txt?v=3',
    '/product-atlas-v2/part-02.txt?v=3',
    '/product-atlas-v2/part-03.txt?v=3',
  ];

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
    ['nuca-pecan', 'Nucă Pecan'],
    ['nuci-cedru', 'Nuci de cedru'],
    ['miere-salcam', 'Miere de salcâm'],
    ['cernosliv', 'Prune uscate (Cernosliv)'],
    ['curmale-tunis', 'Curmale Tunis'],
    ['curmale-regale', 'Curmale regale'],
    ['mango-uscat', 'Mango uscat'],
    ['stafide-negre', 'Stafide negre'],
    ['rachitele', 'Răchițele uscate'],
    ['visina-uscata', 'Vișină uscată'],
    ['ananas-uscat', 'Ananas uscat'],
    ['zamos-uscat', 'Zamos uscat'],
    ['cuburi-cocos', 'Cuburi de cocos'],
    ['cipsuri-banane', 'Cipsuri din banane'],
    ['cipsuri-mere', 'Cipsuri din mere'],
    ['visina-suc-propriu', 'Vișină în suc propriu'],
    ['mix-4-seminte', 'Mix 4 semințe'],
    ['seminte-dovleac', 'Semințe de dovleac'],
    ['seminte-floarea-soarelui', 'Semințe de floarea-soarelui'],
    ['seminte-chia', 'Semințe Chia'],
    ['seminte-in-cafenii', 'Semințe de in cafenii'],
    ['seminte-susan', 'Semințe de susan'],
    ['quinoa', 'Quinoa albă'],
    ['mix-nuci-fructe-seminte', 'Mix: migdale, caju, nuci grecești, macadamia, alune, stafide, vișină, răchițele și semințe de dovleac'],
    ['marzotto-expresso-bar-grani', 'Marzotto Expresso Bar Grani'],
    ['olive-cu-samburi', 'Olive cu sâmburi'],
    ['masline-cu-samburi', 'Măsline cu sâmburi'],
    ['ulei-olive-extra-virgin', 'Ulei de olive Extra Virgin · prima presare, pentru salate'],
    ['mix-bomboane', 'Mix bomboane'],
    ['prune-ciocolata', 'Prune în ciocolată'],
    ['finic-nuci-ciocolata', 'Finic cu nuci în ciocolată'],
    ['cocos-ciocolata', 'Cocos în ciocolată'],
    ['banana-ciocolata', 'Banana în ciocolată'],
    ['martipan', 'Marțipan'],
    ['caramel-sarat', 'Caramel sărat'],
    ['negresa-migdale', 'Negreasă cu migdale'],
    ['alune-ciocolata-lapte', 'Alune în ciocolată cu lapte'],
  ].map(([id, name], index) => ({ id, name, index }));

  const byName = new Map(products.map((item) => [item.name, item]));
  const photoUrls = new Map();
  let ready = false;
  let scheduled = false;

  async function loadAtlas() {
    const parts = await Promise.all(
      ATLAS_PARTS.map(async (url) => {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Nu s-a putut încărca ${url}`);
        return (await response.text()).trim();
      }),
    );

    const image = new Image();
    image.decoding = 'async';
    image.src = `data:image/jpeg;base64,${parts.join('')}`;
    if (image.decode) await image.decode();
    else await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    return image;
  }

  function buildProductPhotos(atlas) {
    products.forEach((item) => {
      const column = item.index % COLUMNS;
      const row = Math.floor(item.index / COLUMNS);
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 225;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(
        atlas,
        column * TILE_WIDTH,
        row * TILE_HEIGHT,
        TILE_WIDTH,
        TILE_HEIGHT,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      photoUrls.set(item.id, canvas.toDataURL('image/jpeg', 0.9));
    });
  }

  function setPhoto(img, item) {
    if (!img || img.dataset.productPhoto === item.id) return;
    const src = photoUrls.get(item.id);
    if (!src) return;
    img.src = src;
    img.alt = item.name;
    img.dataset.productPhoto = item.id;
    img.style.display = '';
    img.style.objectFit = 'cover';
  }

  function applyProductPhotos() {
    if (!ready) return;

    products.forEach((item) => {
      const card = document.getElementById(`product-${item.id}`);
      setPhoto(card?.querySelector('img'), item);
    });

    // Cardurile din „Nou în catalog” sunt identificate după denumire.
    document.querySelectorAll('button').forEach((button) => {
      const image = button.querySelector('img');
      const nameNode = button.querySelector('strong');
      if (!image || !nameNode) return;
      const item = byName.get(nameNode.textContent?.trim() || '');
      if (item) setPhoto(image, item);
    });
  }

  function scheduleApply() {
    if (!ready || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyProductPhotos();
    });
  }

  async function init() {
    try {
      const atlas = await loadAtlas();
      buildProductPhotos(atlas);
      ready = true;
      applyProductPhotos();
      new MutationObserver(scheduleApply).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (error) {
      console.error('Fotografiile produselor nu au putut fi încărcate:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
