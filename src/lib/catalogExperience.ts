import type { Category, Product } from '@/lib/products';

export type CategoryExperience = {
  icon: string;
  note: string;
  photoUrl: string;
  photoAlt: string;
};

const localPhoto: Record<string, string> = {
  nuts: '/products-ultra/migdale.jpg',
  honey: '/products-ultra/miere-salcam.jpg',
  dried: '/products-ultra/mango-uscat.jpg',
  conserve: '/products-ultra/visina-suc-propriu.jpg',
  seeds: '/products-ultra/mix-4-seminte.jpg',
  mix: '/products-ultra/mix-nuci-fructe-seminte.jpg',
  coffee: '/products-ultra/marzotto-expresso-bar-grani.jpg',
  olives: '/products-ultra/olive-cu-samburi.jpg',
  oil: '/products-ultra/ulei-olive-extra-virgin.jpg',
  sweets: '/products-ultra/mix-bomboane.jpg',
  dragee: '/products-ultra/alune-ciocolata-lapte.jpg',
};

export const categoryExperience: Record<string, CategoryExperience> = {
  Nuci: {
    icon: '🥜',
    note: 'nuci crude, prăjite și sortimente speciale',
    photoUrl: localPhoto.nuts,
    photoAlt: 'Migdale și nuci',
  },
  Miere: {
    icon: '🍯',
    note: 'miere naturală de salcâm',
    photoUrl: localPhoto.honey,
    photoAlt: 'Miere naturală',
  },
  'Fructe uscate': {
    icon: '🍑',
    note: 'fructe uscate, aromate și gustoase',
    photoUrl: localPhoto.dried,
    photoAlt: 'Fructe uscate',
  },
  Conserve: {
    icon: '🍒',
    note: 'fructe conservate în suc propriu',
    photoUrl: localPhoto.conserve,
    photoAlt: 'Fructe pentru conserve',
  },
  'Semințe': {
    icon: '🌱',
    note: 'semințe, chia, quinoa și mixuri',
    photoUrl: localPhoto.seeds,
    photoAlt: 'Semințe',
  },
  Mix: {
    icon: '🥣',
    note: 'mix de nuci, fructe uscate și semințe',
    photoUrl: localPhoto.mix,
    photoAlt: 'Mix de nuci',
  },
  'Cafea boabe': {
    icon: '☕',
    note: 'cafea boabe din Italia',
    photoUrl: localPhoto.coffee,
    photoAlt: 'Cafea boabe',
  },
  'Olive conservate': {
    icon: '🫒',
    note: 'olive și măsline · producător Grecia',
    photoUrl: localPhoto.olives,
    photoAlt: 'Olive',
  },
  'Ulei de olive': {
    icon: '🫗',
    note: 'extra virgin, prima presare, pentru salate',
    photoUrl: localPhoto.oil,
    photoAlt: 'Olive pentru ulei extra virgin',
  },
  Bomboane: {
    icon: '🍬',
    note: 'ambalaj de 0,5 kg · producător Ucraina',
    photoUrl: localPhoto.sweets,
    photoAlt: 'Ciocolată',
  },
  Drajeuri: {
    icon: '🍫',
    note: 'porții de 250 g',
    photoUrl: localPhoto.dragee,
    photoAlt: 'Ciocolată și cacao',
  },
  'Produse de casă': {
    icon: '🧺',
    note: 'produse locale, direct de la gospodărie',
    photoUrl: localPhoto.nuts,
    photoAlt: 'Produse de casă',
  },
};

const fallbackExperience: CategoryExperience = {
  icon: '🛍️',
  note: 'produse speciale adăugate în catalog',
  photoUrl: localPhoto.nuts,
  photoAlt: 'Produs din catalog',
};

export function getCategoryExperience(category: Category) {
  return categoryExperience[category] || fallbackExperience;
}

export const newestProductIds = new Set([
  'caju-fara-coaja-prajit',
  'miez-fistic',
  'nuci-cedru',
  'miere-salcam',
  'zamos-uscat',
  'cipsuri-mere',
  'visina-suc-propriu',
  'mix-bomboane',
  'banana-ciocolata',
]);

export function isNewProduct(product: Product & { isNew?: boolean }) {
  return Boolean(product.isNew) || newestProductIds.has(product.id);
}

const pairings: Partial<Record<Category, Category[]>> = {
  Nuci: ['Fructe uscate', 'Miere', 'Mix'],
  Miere: ['Nuci', 'Cafea boabe'],
  'Fructe uscate': ['Nuci', 'Mix', 'Drajeuri'],
  Conserve: ['Cafea boabe', 'Bomboane'],
  'Semințe': ['Nuci', 'Mix'],
  Mix: ['Cafea boabe', 'Miere'],
  'Cafea boabe': ['Bomboane', 'Drajeuri', 'Miere'],
  'Olive conservate': ['Ulei de olive'],
  'Ulei de olive': ['Olive conservate'],
  Bomboane: ['Cafea boabe', 'Drajeuri'],
  Drajeuri: ['Cafea boabe', 'Bomboane'],
};

export function recommendProducts<T extends Product>(products: T[], cart: Record<string, number>, limit = 3) {
  const chosen = products.filter((product) => (cart[product.id] || 0) > 0);
  const chosenIds = new Set(chosen.map((product) => product.id));
  const desired = new Set<Category>();
  chosen.forEach((product) => pairings[product.category]?.forEach((category) => desired.add(category)));

  return products
    .filter((product) => !chosenIds.has(product.id))
    .map((product, index) => ({
      product,
      score: (desired.has(product.category) ? 10 : 0) + (isNewProduct(product) ? 3 : 0) - index / 1000,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product }) => product);
}
