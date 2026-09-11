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

export const products: Product[] = [
  // Toate produsele afișate în lei/kg se comandă în pași de 500 g.
  // Nuci
  { id: 'migdale', name: 'Migdale', category: 'Nuci', priceLei: 230, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/migdale.jpg' },
  { id: 'caju', name: 'Caju', category: 'Nuci', priceLei: 260, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/caju.jpg' },
  { id: 'caju-prajit', name: 'Caju în coajă prăjit', category: 'Nuci', priceLei: 280, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/caju-prajit.jpg' },
  { id: 'caju-fara-coaja-prajit', name: 'Caju fără coajă prăjit', category: 'Nuci', priceLei: 300, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/caju-fara-coaja-prajit.jpg' },
  { id: 'fistic-american', name: 'Fistic American', category: 'Nuci', priceLei: 370, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/fistic-american.jpg' },
  { id: 'miez-fistic', name: 'Miez de Fistic', category: 'Nuci', priceLei: 200, baseGrams: 250, stepGrams: 500, imageUrl: '/products/miez-fistic.jpg' },
  { id: 'nuci-grecesti', name: 'Nuci Grecești', category: 'Nuci', priceLei: 230, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/nuci-grecesti.jpg' },
  { id: 'arahide-crude', name: 'Arahide crude', category: 'Nuci', priceLei: 90, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/arahide-crude.jpg' },
  { id: 'macadamia-coaja', name: 'Macadamia în coajă', category: 'Nuci', priceLei: 400, baseGrams: 1000, stepGrams: 500, imageUrl: '/products/macadamia-coaja.jpg' },
  { id: 'nuci-braziliene', name: 'Nuci braziliene', category: 'Nuci', priceLei: 155, baseGrams: 250, stepGrams: 500, imageUrl: '/products/nuci-braziliene.jpg' },
  { id: 'nuca-pecan', name: 'Nucă Pecan', category: 'Nuci', priceLei: 450, baseGrams: 1000, stepGrams: 500 },
  { id: 'nuci-cedru', name: 'Nuci de cedru', category: 'Nuci', priceLei: 215, baseGrams: 250, stepGrams: 500 },

  // Miere
  { id: 'miere-salcam', name: 'Miere de salcâm', category: 'Miere', priceLei: 170, baseGrams: 1000, stepGrams: 500 },

  // Fructe uscate
  { id: 'cernosliv', name: 'Prune uscate (Cernosliv)', category: 'Fructe uscate', priceLei: 90, baseGrams: 1000, stepGrams: 500 },
  { id: 'curmale-tunis', name: 'Curmale Tunis', category: 'Fructe uscate', priceLei: 130, baseGrams: 1000, stepGrams: 500 },
  { id: 'curmale-regale', name: 'Curmale regale', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 500 },
  { id: 'mango-uscat', name: 'Mango uscat', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 500 },
  { id: 'stafide-negre', name: 'Stafide negre', category: 'Fructe uscate', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'rachitele', name: 'Răchițele uscate', category: 'Fructe uscate', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'visina-uscata', name: 'Vișină uscată', category: 'Fructe uscate', priceLei: 350, baseGrams: 1000, stepGrams: 500 },
  { id: 'ananas-uscat', name: 'Ananas uscat', category: 'Fructe uscate', priceLei: 270, baseGrams: 1000, stepGrams: 500 },
  { id: 'zamos-uscat', name: 'Zamos uscat', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 500 },
  { id: 'cuburi-cocos', name: 'Cuburi de cocos', category: 'Fructe uscate', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'cipsuri-banane', name: 'Cipsuri din banane', category: 'Fructe uscate', priceLei: 60, baseGrams: 300, stepGrams: 300 },
  { id: 'cipsuri-mere', name: 'Cipsuri din mere', category: 'Fructe uscate', priceLei: 60, baseGrams: 150, stepGrams: 150 },

  // Conserve
  { id: 'visina-suc-propriu', name: 'Vișină în suc propriu', category: 'Conserve', priceLei: 250, baseGrams: 3000, stepGrams: 3000, priceUnitLabel: 'borcan 3 L', quantityUnit: 'ml' },

  // Semințe
  { id: 'mix-4-seminte', name: 'Mix 4 semințe', category: 'Semințe', priceLei: 30, baseGrams: 200, stepGrams: 200 },
  { id: 'seminte-dovleac', name: 'Semințe de dovleac', category: 'Semințe', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'seminte-floarea-soarelui', name: 'Semințe de floarea-soarelui', category: 'Semințe', priceLei: 60, baseGrams: 1000, stepGrams: 500 },
  { id: 'seminte-chia', name: 'Semințe Chia', category: 'Semințe', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'seminte-in-cafenii', name: 'Semințe de in cafenii', category: 'Semințe', priceLei: 100, baseGrams: 1000, stepGrams: 500 },
  { id: 'seminte-susan', name: 'Semințe de susan', category: 'Semințe', priceLei: 160, baseGrams: 1000, stepGrams: 500 },
  { id: 'quinoa', name: 'Quinoa albă', category: 'Semințe', priceLei: 150, baseGrams: 1000, stepGrams: 500 },

  // Mix
  { id: 'mix-nuci-fructe-seminte', name: 'Mix: migdale, caju, nuci grecești, macadamia, alune, stafide, vișină, răchițele și semințe de dovleac', category: 'Mix', priceLei: 70, baseGrams: 250, stepGrams: 250 },

  // Cafea boabe
  { id: 'marzotto-expresso-bar-grani', name: 'Marzotto Expresso Bar Grani', category: 'Cafea boabe', priceLei: 350, baseGrams: 1000, stepGrams: 500 },

  // Olive conservate — producător Grecia
  { id: 'olive-cu-samburi', name: 'Olive cu sâmburi', category: 'Olive conservate', priceLei: 100, baseGrams: 720, stepGrams: 720, priceUnitLabel: 'borcan 720 g' },
  { id: 'masline-cu-samburi', name: 'Măsline cu sâmburi', category: 'Olive conservate', priceLei: 100, baseGrams: 720, stepGrams: 720, priceUnitLabel: 'borcan 720 g' },

  // Ulei de olive
  { id: 'ulei-olive-extra-virgin', name: 'Ulei de olive Extra Virgin · prima presare, pentru salate', category: 'Ulei de olive', priceLei: 200, baseGrams: 500, stepGrams: 500, priceUnitLabel: '0,5 L', quantityUnit: 'ml' },

  // Bomboane — ambalaj de 0,5 kg, producător Ucraina
  { id: 'mix-bomboane', name: 'Mix bomboane', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'prune-ciocolata', name: 'Prune în ciocolată', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'finic-nuci-ciocolata', name: 'Finic cu nuci în ciocolată', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'cocos-ciocolata', name: 'Cocos în ciocolată', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'banana-ciocolata', name: 'Banana în ciocolată', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'martipan', name: 'Marțipan', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'caramel-sarat', name: 'Caramel sărat', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'negresa-migdale', name: 'Negreasă cu migdale', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 500 },

  // Drajeuri
  { id: 'alune-ciocolata-lapte', name: 'Alune în ciocolată cu lapte', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
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
