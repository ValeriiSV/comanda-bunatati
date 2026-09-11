(() => {
  const CACHE_VERSION = '20260911-6';
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
    return url;
  }

  function stylePhoto(img, item) {
    if (!img || !atlasUrl) return;
    const frame = img.parentElement;
    if (!frame) return;

    const column = item.index % COLUMNS;
    const row = Math.floor(item.index / COLUMNS);
    const x = COLUMNS === 1 ? 0 : (column / (COLUMNS - 1)) * 100;
    const y = ROWS === 1 ? 0 : (row / (ROWS - 1)) * 100;

    frame.style.backgroundImage = `url("${atlasUrl}")`;
    frame.style.backgroundSize = `${COLUMNS * 100}% ${ROWS * 100}%`;
    frame.style.backgroundPosition = `${x}% ${y}%`;
    frame.style.backgroundRepeat = 'no-repeat';
    frame.style.backgroundColor = '#ead9bd';
    frame.style.aspectRatio = '16 / 9';
    frame.style.height = 'auto';

    img.alt = item.name;
    img.dataset.productPhoto = item.id;
    img.style.opacity = '0';
    img.style.pointerEvents = 'none';
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
      try {
        atlasUrl = await buildAtlasUrl(HD_PARTS, 'image/avif');
      } catch (hdError) {
        console.warn('Atlas AVIF indisponibil, folosesc JPEG.', hdError);
        atlasUrl = await buildAtlasUrl(JPEG_PARTS, 'image/jpeg');
      }

      applyProductPhotos();
      new MutationObserver(scheduleApply).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (error) {
      console.error('Catalogul vizual nu a putut fi încărcat. Se păstrează imaginile standard.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();