(() => {
  const CACHE_VERSION = '20260911-13';
  const COLUMNS = 8;
  const ROWS = 6;

  const ATLAS_PARTS = [
    `/product-atlas-v2/part-01.txt?v=${CACHE_VERSION}`,
    `/product-atlas-v2/part-02.txt?v=${CACHE_VERSION}`,
    `/product-atlas-v2/part-03a.txt?v=${CACHE_VERSION}`,
    `/product-atlas-v2/part-03b.txt?v=${CACHE_VERSION}`,
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
        gap: 14px !important;
      }
      .premium-product-card {
        overflow: hidden !important;
        border-radius: 20px !important;
        background: rgba(255,255,255,.76) !important;
        border: 1px solid rgba(255,255,255,.72) !important;
        box-shadow: 0 10px 28px rgba(32,65,46,.09), inset 0 1px 0 rgba(255,255,255,.85) !important;
      }
      .premium-product-card > div:first-child {
        height: auto !important;
        aspect-ratio: 16 / 9 !important;
        background: #e9ddc8 !important;
      }
      .premium-product-card > div:first-child > img {
        display: block !important;
        visibility: visible !important;
        filter: saturate(1.06) contrast(1.035) brightness(1.01) !important;
      }
      .premium-product-card > div:first-child > div:first-of-type {
        background: linear-gradient(to top, rgba(23,61,44,.12), transparent 52%, rgba(0,0,0,.01)) !important;
      }
      .premium-product-card > div:first-child > div:nth-of-type(2) {
        inset-inline: 7px !important;
        top: 7px !important;
      }
      .premium-product-card > div:first-child > div:nth-of-type(2) > span,
      .premium-product-card > div:first-child > div:nth-of-type(2) > button {
        width: 31px !important;
        height: 31px !important;
        min-width: 31px !important;
        border-radius: 12px !important;
        font-size: 14px !important;
        background: rgba(248,248,242,.88) !important;
        color: #315b32 !important;
        border-color: rgba(255,255,255,.75) !important;
      }
      .premium-product-card > div:first-child > div:nth-of-type(3) {
        left: 7px !important;
        right: 7px !important;
        bottom: 7px !important;
        gap: 4px !important;
      }
      .premium-product-card > div:first-child > div:nth-of-type(3) span {
        font-size: 10px !important;
        padding: 4px 7px !important;
        box-shadow: 0 2px 8px rgba(52,42,25,.08) !important;
      }
      .premium-card-body {
        display: grid !important;
        grid-template-columns: minmax(0,.82fr) minmax(0,1.18fr) !important;
        gap: 8px !important;
        align-items: center !important;
        padding: 10px !important;
      }
      .premium-card-body h3 {
        grid-column: 1 / -1 !important;
        min-height: 38px !important;
        margin: 0 !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        line-height: 18px !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        color: #173d2c !important;
      }
      .premium-zero-qty {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        height: 38px !important;
        overflow: hidden !important;
        border: 1px solid rgba(23,61,44,.10) !important;
        border-radius: 12px !important;
        background: rgba(255,255,255,.92) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.8) !important;
      }
      .premium-zero-qty button,
      .premium-zero-qty span {
        display: grid !important;
        place-items: center !important;
        min-width: 0 !important;
        border: 0 !important;
        background: transparent !important;
        color: #174a35 !important;
        font-size: 16px !important;
        font-weight: 700 !important;
      }
      .premium-zero-qty span {
        border-inline: 1px solid rgba(23,61,44,.08) !important;
        font-size: 12px !important;
        color: #263f34 !important;
      }
      .premium-add-button {
        height: 38px !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 4px 8px !important;
        border: 0 !important;
        border-radius: 12px !important;
        background: linear-gradient(145deg, #1b6548, #0e5137) !important;
        color: white !important;
        box-shadow: 0 7px 16px rgba(19,80,55,.18) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
      }
      .premium-cart-glyph { font-size: 14px !important; line-height: 1 !important; }
      .premium-add-copy { display: flex !important; min-width: 0 !important; flex-direction: column !important; align-items: flex-start !important; line-height: 1 !important; }
      .premium-add-copy strong { font-size: 12px !important; line-height: 13px !important; color: white !important; font-weight: 700 !important; }
      .premium-add-copy small { margin-top: 2px !important; font-size: 9px !important; line-height: 9px !important; color: rgba(255,255,255,.82) !important; }
      .premium-active-row {
        grid-column: 1 / -1 !important;
        margin-top: 0 !important;
        gap: 7px !important;
      }
      .premium-filter-block { scroll-margin-top: 84px !important; }
      .premium-count-row { margin-bottom: 12px !important; }
      .premium-mobile-cart-shell {
        border: 1px solid rgba(255,255,255,.72) !important;
        background: rgba(242,246,239,.72) !important;
        box-shadow: 0 12px 32px rgba(22,61,43,.18) !important;
      }
      .premium-mobile-cart-button {
        background: linear-gradient(145deg,#1b6548,#0d5137) !important;
        color: white !important;
        border: 1px solid rgba(255,255,255,.20) !important;
        box-shadow: 0 9px 24px rgba(19,80,55,.20) !important;
      }
      @media (max-width: 699px) {
        .category-dock {
          position: static !important;
          top: auto !important;
          margin-bottom: 14px !important;
        }
        .premium-filter-block {
          flex-direction: column-reverse !important;
          gap: 12px !important;
          margin-bottom: 6px !important;
        }
        .premium-filter-block > div:first-child > p { display: none !important; }
        .premium-filter-block > div:first-child h2 {
          font-size: 36px !important;
          line-height: 40px !important;
        }
        .premium-count-row {
          margin-top: -47px !important;
          margin-bottom: 16px !important;
          padding-right: 2px !important;
          pointer-events: none !important;
        }
      }
      @media (max-width: 380px) {
        .premium-product-grid { gap: 9px !important; }
        .premium-card-body { gap: 6px !important; padding: 8px !important; }
        .premium-card-body h3 { min-height: 34px !important; font-size: 13px !important; line-height: 17px !important; }
        .premium-zero-qty, .premium-add-button { height: 36px !important; }
        .premium-add-button { padding-inline: 5px !important; }
        .premium-add-copy strong { font-size: 11px !important; }
      }
      @media (min-width: 700px) {
        .premium-product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
      }
      @media (min-width: 1180px) {
        .premium-product-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 14px !important;
        }
        .premium-card-body { padding: 12px !important; }
        .premium-card-body h3 { font-size: 15px !important; line-height: 19px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  async function buildAtlasUrl() {
    const chunks = await Promise.all(ATLAS_PARTS.map(async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return (await response.text()).trim();
    }));

    const encoded = chunks.join('');
    if (!encoded || encoded.length % 4 !== 0) throw new Error('Atlas JPEG Base64 incomplet');

    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));

    const test = new Image();
    test.src = url;
    if (test.decode) await test.decode();
    else await new Promise((resolve, reject) => { test.onload = resolve; test.onerror = reject; });
    if (!test.naturalWidth || !test.naturalHeight) throw new Error('Atlas JPEG invalid');
    return url;
  }

  function restorePhoto(img) {
    if (!img) return;
    const original = img.dataset.originalProductSrc;
    img.onerror = null;
    ['position','left','top','width','height','maxWidth','objectFit','opacity','pointerEvents','transform','transition','zIndex','display','visibility','filter'].forEach((prop) => { img.style[prop] = ''; });
    if (original) img.src = original;
  }

  function stylePhoto(img, item) {
    if (!img || !atlasUrl) return;
    const frame = img.parentElement;
    if (!frame) return;
    if (!img.dataset.originalProductSrc) img.dataset.originalProductSrc = img.getAttribute('src') || '';

    const column = item.index % COLUMNS;
    const row = Math.floor(item.index / COLUMNS);
    frame.style.position = 'relative';
    frame.style.overflow = 'hidden';
    frame.style.backgroundImage = '';
    frame.style.backgroundColor = '#e9ddc8';

    img.removeAttribute('srcset');
    img.src = atlasUrl;
    img.alt = item.name;
    img.dataset.productPhoto = item.id;
    img.loading = 'eager';
    img.style.display = 'block';
    img.style.visibility = 'visible';
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
    img.style.transition = 'none';
    img.style.zIndex = '0';
    img.onerror = () => restorePhoto(img);
  }

  function upgradeZeroState(body) {
    const addButton = Array.from(body.children).find((node) => node.tagName === 'BUTTON' && /Adaugă/.test(node.textContent || ''));
    if (!addButton) return;
    addButton.classList.add('premium-add-button');

    if (!addButton.dataset.premiumUpgraded) {
      const originalText = (addButton.textContent || '').replace(/^\s*\+\s*/, '').trim();
      const quantity = originalText.replace(/^Adaugă\s*/i, '') || '';
      addButton.innerHTML = `<span class="premium-cart-glyph">🛒</span><span class="premium-add-copy"><strong>Adaugă</strong><small>${quantity}</small></span>`;
      addButton.dataset.premiumUpgraded = '1';
    }

    if (!body.querySelector(':scope > .premium-zero-qty')) {
      const qty = document.createElement('div');
      qty.className = 'premium-zero-qty';
      qty.innerHTML = '<button type="button" aria-label="Cantitate minimă">−</button><span>0</span><button type="button" aria-label="Adaugă o unitate">+</button>';
      const buttons = qty.querySelectorAll('button');
      buttons[0].addEventListener('click', (event) => event.preventDefault());
      buttons[1].addEventListener('click', (event) => {
        event.preventDefault();
        addButton.click();
      });
      body.insertBefore(qty, addButton);
    }
  }

  function applyLayout() {
    const parents = new Set();
    products.forEach((item) => {
      const card = document.getElementById(`product-${item.id}`);
      if (!card) return;
      card.classList.add('premium-product-card');
      if (card.parentElement) parents.add(card.parentElement);

      const body = card.children[1];
      if (body) {
        body.classList.add('premium-card-body');
        upgradeZeroState(body);
        const activeRow = Array.from(body.children).find((node) => node.tagName === 'DIV' && !node.classList.contains('premium-zero-qty'));
        if (activeRow) activeRow.classList.add('premium-active-row');
      }
    });
    parents.forEach((parent) => parent.classList.add('premium-product-grid'));

    const searchInput = document.querySelector('input[placeholder="Caută un produs"]');
    const filterBlock = searchInput?.closest('label')?.parentElement?.parentElement;
    if (filterBlock) filterBlock.classList.add('premium-filter-block');

    document.querySelectorAll('span').forEach((span) => {
      if (/^\d+\s+produse$/.test((span.textContent || '').trim())) span.parentElement?.classList.add('premium-count-row');
    });

    const cartButton = Array.from(document.querySelectorAll('button')).find((button) => /Vezi comanda/.test(button.textContent || ''));
    if (cartButton) {
      cartButton.classList.add('premium-mobile-cart-button');
      cartButton.closest('div.fixed')?.classList.add('premium-mobile-cart-shell');
    }
  }

  function applyProductPhotos() {
    if (!atlasUrl) return;
    products.forEach((item) => {
      const card = document.getElementById(`product-${item.id}`);
      if (card) stylePhoto(card.querySelector('img'), item);
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
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyLayout();
      if (atlasUrl) applyProductPhotos();
    });
  }

  async function init() {
    injectPremiumStyles();
    applyLayout();
    new MutationObserver(scheduleApply).observe(document.documentElement, { childList: true, subtree: true });

    try {
      atlasUrl = await buildAtlasUrl();
      applyProductPhotos();
    } catch (error) {
      console.error('Atlasul JPEG nu a putut fi încărcat; păstrez imaginile standard.', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();