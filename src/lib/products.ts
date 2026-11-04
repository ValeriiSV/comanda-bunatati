export type Category = string;
export type QuantityUnit = 'g' | 'ml' | 'buc' | 'pachet' | 'borcan' | 'cofraj';

export type Product = {
  id: string;
  name: string;
  category: Category;
  priceLei: number;
  baseGrams: number;
  stepGrams: number;
  priceUnitLabel?: string;
  quantityUnit?: QuantityUnit;
  imageUrl?: string;
  stockLimit?: number;
};

export const categories: Category[] = [
  'Nuci',
  'Miere',
  'Fructe uscate',
  'Conserve',
  'Semințe',
  'Mix',
  'Cafea boabe',
  'Olive conservate',
  'Ulei de olive',
  'Bomboane',
  'Drajeuri',
  'Produse de casă',
];

// Catalog oficial actualizat conform listei furnizorului din 26.10.2026.
// Regula de comandă rămâne neschimbată pentru produsele existente:
// produsele la kg se comandă în pași de 500 g, iar ambalajele fixe
// păstrează gramajul / unitatea lor.
export const products: Product[] = [
  // Nuci
  { id: 'migdale', name: 'Migdale', category: 'Nuci', priceLei: 230, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/migdale.jpg' },
  { id: 'alune-padure', name: 'Alune de pădure', category: 'Nuci', priceLei: 480, baseGrams: 1000, stepGrams: 500 },
  { id: 'caju', name: 'Caju', category: 'Nuci', priceLei: 260, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/caju.jpg' },
  { id: 'caju-fara-coaja-prajit', name: 'Caju prăjit fără coajă', category: 'Nuci', priceLei: 300, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/caju-fara-coaja-prajit.jpg' },
  { id: 'nuci-grecesti', name: 'Nuci grecești', category: 'Nuci', priceLei: 230, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/nuci-grecesti.jpg' },
  { id: 'arahide-crude', name: 'Arahide crude', category: 'Nuci', priceLei: 90, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/arahide-crude.jpg' },
  { id: 'fistic-american', name: 'Fistic SUA', category: 'Nuci', priceLei: 370, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/fistic-american.jpg' },
  // Aceste produse sunt cotate la 250 g, dar pasul existent de comandă rămâne 500 g.
  { id: 'miez-fistic', name: 'Miez de fistic', category: 'Nuci', priceLei: 200, baseGrams: 250, stepGrams: 500, imageUrl: '/products/miez-fistic.jpg' },
  { id: 'miez-macadamia', name: 'Miez de macadamia', category: 'Nuci', priceLei: 150, baseGrams: 250, stepGrams: 500 },
  { id: 'nuci-braziliene', name: 'Nuci braziliene', category: 'Nuci', priceLei: 160, baseGrams: 250, stepGrams: 500, imageUrl: '/products/nuci-braziliene.jpg' },

  // Miere
  { id: 'miere-salcam', name: 'Miere de salcâm 2026', category: 'Miere', priceLei: 170, baseGrams: 1000, stepGrams: 500 },

  // Fructe uscate
  { id: 'cernosliv', name: 'Prune uscate', category: 'Fructe uscate', priceLei: 90, baseGrams: 1000, stepGrams: 500 },
  { id: 'caise-uscate-portocalii', name: 'Caise uscate portocalii', category: 'Fructe uscate', priceLei: 300, baseGrams: 1000, stepGrams: 500 },
  { id: 'caise-uscate-brune', name: 'Caise uscate brune', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 500 },
  { id: 'stafide-negre', name: 'Stafide negre', category: 'Fructe uscate', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'stafide-deschise', name: 'Stafide deschise', category: 'Fructe uscate', priceLei: 150, baseGrams: 1000, stepGrams: 500 },
  { id: 'curmale-regale', name: 'Curmale regale', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 500 },
  { id: 'curmale-tunis', name: 'Curmale Tunis', category: 'Fructe uscate', priceLei: 130, baseGrams: 1000, stepGrams: 500 },
  { id: 'curmale-mazafati', name: 'Curmale Mazafati', category: 'Fructe uscate', priceLei: 55, baseGrams: 1, stepGrams: 1, priceUnitLabel: 'pachet', quantityUnit: 'pachet' },
  { id: 'mango-uscat', name: 'Mango uscat', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 500 },
  { id: 'ananas-uscat', name: 'Ananas uscat', category: 'Fructe uscate', priceLei: 270, baseGrams: 1000, stepGrams: 500 },
  { id: 'zamos-uscat', name: 'Pepene galben uscat', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 500 },
  { id: 'smochine-uscate', name: 'Smochine uscate', category: 'Fructe uscate', priceLei: 250, baseGrams: 1000, stepGrams: 500 },
  { id: 'cuburi-cocos', name: 'Cuburi de cocos', category: 'Fructe uscate', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'rachitele', name: 'Răchițele uscate', category: 'Fructe uscate', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'visina-uscata', name: 'Vișine uscate', category: 'Fructe uscate', priceLei: 350, baseGrams: 1000, stepGrams: 500 },
  { id: 'cipsuri-banane', name: 'Chipsuri de banane', category: 'Fructe uscate', priceLei: 60, baseGrams: 300, stepGrams: 300 },
  { id: 'cipsuri-mere', name: 'Chipsuri de mere', category: 'Fructe uscate', priceLei: 60, baseGrams: 150, stepGrams: 150 },

  // Conserve
  { id: 'visina-suc-propriu', name: 'Vișine în suc propriu', category: 'Conserve', priceLei: 250, baseGrams: 1, stepGrams: 1, priceUnitLabel: 'borcan 3 L', quantityUnit: 'borcan' },

  // Semințe
  { id: 'mix-4-seminte', name: 'Mix 4 semințe', category: 'Semințe', priceLei: 30, baseGrams: 200, stepGrams: 200 },
  { id: 'seminte-dovleac', name: 'Semințe de dovleac (miez)', category: 'Semințe', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'seminte-floarea-soarelui', name: 'Semințe de floarea-soarelui (miez)', category: 'Semințe', priceLei: 60, baseGrams: 1000, stepGrams: 500 },
  { id: 'seminte-chia', name: 'Semințe Chia', category: 'Semințe', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'seminte-in-cafenii', name: 'Semințe de in brune', category: 'Semințe', priceLei: 100, baseGrams: 1000, stepGrams: 500 },
  { id: 'seminte-susan', name: 'Semințe de susan', category: 'Semințe', priceLei: 160, baseGrams: 1000, stepGrams: 500 },
  { id: 'quinoa', name: 'Quinoa albă', category: 'Semințe', priceLei: 150, baseGrams: 1000, stepGrams: 500 },

  // Mixuri
  { id: 'mix-nuci-fructe-seminte', name: 'Mix: migdale, caju, nuci grecești, alune de pădure, nuci braziliene, răchițele, vișine, stafide și semințe de dovleac', category: 'Mix', priceLei: 75, baseGrams: 250, stepGrams: 250 },
  { id: 'mix-caju-rachitele', name: 'Mix Caju + Răchițele', category: 'Mix', priceLei: 65, baseGrams: 250, stepGrams: 250 },

  // Cafea boabe
  { id: 'marzotto-expresso-bar-grani', name: 'Marzotto Expresso Bar Grani', category: 'Cafea boabe', priceLei: 350, baseGrams: 1000, stepGrams: 500 },

  // Olive conservate — producător Grecia
  { id: 'olive-cu-samburi', name: 'Olive cu sâmburi', category: 'Olive conservate', priceLei: 100, baseGrams: 1, stepGrams: 1, priceUnitLabel: 'borcan 720 g', quantityUnit: 'borcan' },
  { id: 'masline-cu-samburi', name: 'Măsline cu sâmburi', category: 'Olive conservate', priceLei: 100, baseGrams: 1, stepGrams: 1, priceUnitLabel: 'borcan 720 g', quantityUnit: 'borcan' },

  // Ulei de măsline
  { id: 'ulei-olive-extra-virgin', name: 'Ulei de măsline Extra Virgin · prima presare', category: 'Ulei de olive', priceLei: 200, baseGrams: 500, stepGrams: 500, priceUnitLabel: '0,5 L', quantityUnit: 'ml' },

  // Bomboane — ambalaj de 0,5 kg, producător Ucraina
  { id: 'mix-bomboane', name: 'Mix bomboane', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'prune-ciocolata', name: 'Prune în ciocolată', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'finic-nuci-ciocolata', name: 'Curmale cu nuci în ciocolată', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'caise-ciocolata', name: 'Caise uscate în ciocolată', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'banana-ciocolata', name: 'Banane în ciocolată', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'martipan', name: 'Marțipan', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'caramel-sarat', name: 'Caramel sărat', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'negresa-migdale', name: 'Brownie cu migdale', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 500 },

  // Drajeuri
  { id: 'alune-ciocolata-lapte', name: 'Alune de pădure în ciocolată cu lapte', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
  { id: 'migdale-ciocolata-lapte', name: 'Migdale în ciocolată cu lapte', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
  { id: 'inimioare-ciocolata-colorate', name: 'Inimioare multicolore din ciocolată', category: 'Drajeuri', priceLei: 50, baseGrams: 250, stepGrams: 250 },
];

export function linePrice(product: Product, amount: number) {
  return Math.round((product.priceLei * amount) / product.baseGrams * 100) / 100;
}

export function priceLabel(product: Product) {
  if (product.priceUnitLabel) return `${product.priceLei} lei/${product.priceUnitLabel}`;
  const unit = product.quantityUnit || 'g';
  if (unit === 'g' && product.baseGrams === 1000) return `${product.priceLei} lei/kg`;
  if (unit === 'ml' && product.baseGrams === 1000) return `${product.priceLei} lei/L`;
  return `${product.priceLei} lei/${quantityLabel(product, product.baseGrams)}`;
}

export function quantityLabel(product: Product, amount: number) {
  const unit = product.quantityUnit || 'g';
  if (unit === 'ml') {
    const liters = amount / 1000;
    return amount >= 1000 ? `${new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(liters)} L` : `${amount} ml`;
  }
  if (unit === 'g') return amount >= 1000 && amount % 1000 === 0 ? `${amount / 1000} kg` : `${amount} g`;
  if (unit === 'buc') return `${amount} buc.`;
  const labels: Record<Exclude<QuantityUnit, 'g' | 'ml' | 'buc'>, [string, string]> = {
    pachet: ['pachet', 'pachete'],
    borcan: ['borcan', 'borcane'],
    cofraj: ['cofraj', 'cofraje'],
  };
  const [singular, plural] = labels[unit];
  return `${amount} ${amount === 1 ? singular : plural}`;
}
