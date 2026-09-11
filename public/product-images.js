(() => {
  const CACHE_VERSION = '20260911-9';
  const COLUMNS = 8;
  const ROWS = 6;

  const HD_PARTS = [
    { url: `/product-atlas-hd/part-01.txt?v=${CACHE_VERSION}` },
    { url: `/product-atlas-hd/part-02a.txt?v=${CACHE_VERSION}` },
    { url: `/product-atlas-hd/part-02b.txt?v=${CACHE_VERSION}` },
    { url: `/product-atlas-hd/part-03.txt?v=${CACHE_VERSION}` },
    { url: `/product-atlas-hd/part-04.txt?v=${CACHE_VERSION}` },
    { url: `/product-atlas-hd/part-05.txt?v=${CACHE_VERSION}` },
    { url: `/product-atlas-hd/part-06.txt?v=${CACHE_VERSION}`, take: 16000 },
    { url: `/product-atlas-hd/part-07.txt?v=${CACHE_VERSION}` },
  ];

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

  function injectPremiumStyles() {
    if (document.getElementById('premium-product-card-styles')) return;
    const style = document.createElement('style');
    style.id = 'premium-product-card-styles';
    style.textContent = `
      .premium-product-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 12px !important;
      }
      .premium-product-card {
        border-radius: 20px !important;
        box-shadow: 0 12px 32px rgba(35, 67, 48, .10), inset 0 1px 0 rgba(255,255,255,.58) !important;
        background: rgba(255,255,255,.54) !important;
      }
      .premium-product-card > div:first-child {
        height: auto !important;
        aspect-ratio: 16 / 9 !important;
        background: #ead8bb !important;
      }
      .premium-product-card > div:first-child > img {
        filter: saturate(1.05) contrast(1.035) brightness(1.015) !important;
      }
      .premium-product-card > div:first-child > div:first-of-type {
        background: linear-gradient(to top, rgba(23,61,44,.40), rgba(23,61,44,.03) 58%, rgba(0,0,0,.02)) !important;
      }
      .premium-product-card > div:nth-child(2) {
        padding: 11px !important;
      }
      .premium-product-card h3 {
        min-height: 36px !important;
        font-size: 14px !important;
        line-height: 18px !important;
        overflow: hidden !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
      }
      .premium-product-card > div:nth-child(2) > button {
        height: 36px !important;
        margin-top: 10px !important;
        padding-inline: 8px !important;
        font-size: 12px !important;
        border-radius: 12px !important;
      }
      .premium-product-card > div:nth-child(2) > div {
        margin-top: 10px !important;
        gap: 7px !important;
        flex-wrap: wrap !important;
      }
      .premium-product-card > div:first-child > div:nth-of-type(2) {
        inset-inline: 8px !important;
        top: 8px !important;
      }
      .premium-product-card > div:first-child > div:nth-of-type(2) > span,
      .premium-product-card > div:first-child > div:nth-of-type(2) > button {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        border-radius: 12px !important;
        font-size: 14px !important;
      }
      .premium-product-card > div:first-child > div:nth-of-type(3) {
        left: 8px !important;
        right: 8px !important;
        bottom: 8px !important;
        gap: 5px !important;
      }
      .premium-product-card > div:first-child > div:nth-of-type(3) span {
        font-size: 10px !important;
        padding: 4px 7px !important;
      }
      @media (max-width: 380px) {
        .premium-product-grid { gap: 9px !important; }
        .premium-product-card > div:nth-child(2) { padding: 9px !important; }
        .premium-product-card h3 { font-size: 13px !important; line-height: 17px !important; min-height: 34px !important; }
        .premium-product-card > div:nth-child(2) > button { font-size: 11px !important; padding-inline: 5px !important; }
      }
      @media (min-width: 700px) {
        .premium-product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
      }
      @media (min-width: 1180px) {
        .premium-product-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 14px !important; }
        .premium-product-card > div:nth-child(2) { padding: 14px !important; }
        .premium-product-card h3 { font-size: 15px !important; line-height: 19px !important; min-height: 38px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  async function buildAtlasUrl(parts, mime) {
    const chunks = await Promise.all(parts.map(async ({ url, take }) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const text = (await response.text()).trim();
      return typeof take === 'number' ? text.slice(0, take) : text;
    }));

    const binary = atob(chunks.join(''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const test = new Image();
    test.src = url;
    if (test.decode) await test.decode();
    else await new Promise((resolve, reject) => {
      test.onload = resolve;
      test.onerror = reject;
    });

    if (!test.naturalWidth || !test.naturalHeight) throw new Error('Atlas invalid');
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
    img.style.filter = '';
    if (original) img.src = original;
  }

  function stylePhoto(img, item) {
    if (!img || !atlasUrl) return;
    const frame = img.parentElement;
    if (!frame) return;

    if (!img.dataset.originalProductSrc) {
      img.dataset.originalProductSrc = img.getAttribute('src') || '';
    }

    frame.style.backgroundImage = '';
    frame.style.backgroundSize = '';
    frame.style.backgroundPosition = '';
    frame.style.backgroundRepeat = '';
    frame.style.aspectRatio = '16 / 9';
    frame.style.height = 'auto';

    const column = item.index % COLUMNS;
    const row = Math.floor(item.index / COLUMNS);

    img.src = atlasUrl;
    img.alt = item.name;
    img.dataset.productPhoto = item.id;
    img.loading = 'eager';
    img.decoding = 'async';
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

    let productGrid = null;
    products.forEach((item) => {
      const card = document.getElementById(`product-${item.id}`);
      if (card) {
        card.classList.add('premium-product-card');
        productGrid ||= card.parentElement;
      }
      stylePhoto(card?.querySelector('img'), item);
    });
    if (productGrid) productGrid.classList.add('premium-product-grid');

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
    injectPremiumStyles();
    try {
      try {
        atlasUrl = await buildAtlasUrl(HD_PARTS, 'image/avif');
      } catch (hdError) {
        console.warn('Atlas HD indisponibil, folosesc JPEG de rezervă.', hdError);
        atlasUrl = await buildAtlasUrl(JPEG_PARTS, 'image/jpeg');
      }

      applyProductPhotos();
      new MutationObserver(scheduleApply).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (error) {
      console.error('Catalogul vizual nu a putut fi încărcat; păstrez imaginile standard.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();