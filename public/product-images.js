(() => {
  const CACHE_VERSION = '20260911-7';
  const COLUMNS = 8;
  const ROWS = 6;

  // Folosim doar atlasul JPEG: compatibil stabil cu Safari/iPhone si desktop.
  const JPEG_PARTS = [
    { url: `/product-atlas-v2/part-01.txt?v=${CACHE_VERSION}` },
    { url: `/product-atlas-v2/part-02.txt?v=${CACHE_VERSION}` },
    { url: `/product-atlas-v2/part-03a.txt?v=${CACHE_VERSION}` },
    { url: `/product-atlas-v2/part-03b.txt?v=${CACHE_VERSION}` },
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
  let atlasUrl = '';
  let scheduled = false;

  async function buildAtlasUrl() {
    const chunks = await Promise.all(JPEG_PARTS.map(async ({ url }) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return (await response.text()).trim();
    }));

    const binary = atob(chunks.join(''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    const test = new Image();
    test.src = url;
    if (test.decode) await test.decode();
    else await new Promise((resolve, reject) => {
      test.onload = resolve;
      test.onerror = reject;
    });

    if (!test.naturalWidth || !test.naturalHeight) throw new Error('Atlas JPEG invalid');
    return url;
  }

  function restorePhoto(img) {
    if (!img) return;
    const original = img.dataset.originalProductSrc;
    img.onerror = null;
    img.style.position = '';
    img.style.inset = '';
    img.style.left = '';
    img.style.top = '';
    img.style.width = '';
    img.style.height = '';
    img.style.maxWidth = '';
    img.style.objectFit = '';
    img.style.opacity = '';
    img.style.pointerEvents = '';
    img.style.transform = '';
    img.style.transformOrigin = '';
    img.style.transition = '';
    if (original) img.src = original;
  }

  function stylePhoto(img, item) {
    if (!img || !atlasUrl) return;
    const frame = img.parentElement;
    if (!frame) return;

    if (!img.dataset.originalProductSrc) {
      img.dataset.originalProductSrc = img.getAttribute('src') || '';
    }

    // Anulam stilurile lasate de vechiul loader cu background/aspect-ratio.
    frame.style.backgroundImage = '';
    frame.style.backgroundSize = '';
    frame.style.backgroundPosition = '';
    frame.style.backgroundRepeat = '';
    frame.style.backgroundColor = '';
    frame.style.aspectRatio = '';
    frame.style.height = '';

    const column = item.index % COLUMNS;
    const row = Math.floor(item.index / COLUMNS);

    img.src = atlasUrl;
    img.alt = item.name;
    img.dataset.productPhoto = item.id;
    img.loading = 'eager';

    // Atlas 8 x 6. Imaginea devine 8 ori mai lata si 6 ori mai inalta
    // decat fereastra cardului; deplasarea selecteaza exact produsul dorit.
    img.style.position = 'absolute';
    img.style.left = `${-column * 100}%`;
    img.style.top = `${-row * 100}%`;
    img.style.width = `${COLUMNS * 100}%`;
    img.style.height = `${ROWS * 100}%`;
    img.style.maxWidth = 'none';
    img.style.objectFit = 'fill';
    img.style.opacity = '1';
    img.style.pointerEvents = 'none';
    img.style.transform = 'none';
    img.style.transformOrigin = 'top left';
    img.style.transition = 'none';

    img.onerror = () => restorePhoto(img);
  }

  function applyProductPhotos() {
    if (!atlasUrl) return;

    products.forEach((item) => {
      const card = document.getElementById(`product-${item.id}`);
      stylePhoto(card?.querySelector('img'), item);
    });

    document.querySelectorAll('button').forEach((button) => {
      const image = button.querySelector('img');
      const nameNode = button.querySelector('strong');
      if (!image || !nameNode) return;
      const item = byName.get(nameNode.textContent?.trim() || '');
      if (item) stylePhoto(image, item);
    });
  }

  function scheduleApply() {
    if (!atlasUrl || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyProductPhotos();
    });
  }

  async function init() {
    try {
      atlasUrl = await buildAtlasUrl();
      applyProductPhotos();
      new MutationObserver(scheduleApply).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (error) {
      console.error('Catalogul JPEG nu a putut fi încărcat; păstrez imaginile standard.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
