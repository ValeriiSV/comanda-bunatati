export type Category =
  | 'Nuci'
  | 'Fructe uscate'
  | 'Semințe'
  | 'Mix'
  | 'Cafea boabe'
  | 'Olive conservate'
  | 'Ulei de olive'
  | 'Bomboane'
  | 'Drajeuri';

export type Product = {
  id: string;
  name: string;
  category: Category;
  priceLei: number;
  baseGrams: number;
  stepGrams: number;
  priceUnitLabel?: string;
  quantityUnit?: 'g' | 'ml';
};

export const categories: Category[] = [
  'Nuci',
  'Fructe uscate',
  'Semințe',
  'Mix',
  'Cafea boabe',
  'Olive conservate',
  'Ulei de olive',
  'Bomboane',
  'Drajeuri',
];

export const products: Product[] = [
  // Nuci
  { id: 'migdale', name: 'Migdale', category: 'Nuci', priceLei: 230, baseGrams: 1000, stepGrams: 250 },
  { id: 'caju', name: 'Caju', category: 'Nuci', priceLei: 260, baseGrams: 1000, stepGrams: 250 },
  { id: 'alune', name: 'Alune', category: 'Nuci', priceLei: 480, baseGrams: 1000, stepGrams: 250 },
  { id: 'caju-prajit', name: 'Caju prăjit', category: 'Nuci', priceLei: 280, baseGrams: 1000, stepGrams: 250 },
  { id: 'fistic-american', name: 'Fistic American', category: 'Nuci', priceLei: 370, baseGrams: 1000, stepGrams: 250 },
  { id: 'nuci-grecesti', name: 'Nuci Grecești', category: 'Nuci', priceLei: 220, baseGrams: 1000, stepGrams: 250 },
  { id: 'arahide-crude', name: 'Arahide crude', category: 'Nuci', priceLei: 90, baseGrams: 1000, stepGrams: 250 },
  { id: 'arahide-prajite', name: 'Arahide prăjite în coajă', category: 'Nuci', priceLei: 110, baseGrams: 1000, stepGrams: 250 },
  { id: 'macadamia-coaja', name: 'Macadamia în coajă', category: 'Nuci', priceLei: 400, baseGrams: 1000, stepGrams: 250 },
  { id: 'miez-macadamia', name: 'Miez de macadamia', category: 'Nuci', priceLei: 150, baseGrams: 250, stepGrams: 250 },
  { id: 'nuci-braziliene', name: 'Nuci braziliene', category: 'Nuci', priceLei: 620, baseGrams: 1000, stepGrams: 250 },
  { id: 'nuca-pecan', name: 'Nucă Pecan', category: 'Nuci', priceLei: 450, baseGrams: 1000, stepGrams: 250 },

  // Fructe uscate
  { id: 'curaga-bruna', name: 'Curaga brună', category: 'Fructe uscate', priceLei: 300, baseGrams: 1000, stepGrams: 250 },
  { id: 'curmale-tunis', name: 'Curmale Tunis', category: 'Fructe uscate', priceLei: 130, baseGrams: 1000, stepGrams: 250 },
  { id: 'curmale-regale', name: 'Curmale regale', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 250 },
  { id: 'mango-uscat', name: 'Mango uscat', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 250 },
  { id: 'stafide-gold', name: 'Stafide gold', category: 'Fructe uscate', priceLei: 140, baseGrams: 1000, stepGrams: 250 },
  { id: 'stafide-negre', name: 'Stafide negre', category: 'Fructe uscate', priceLei: 180, baseGrams: 1000, stepGrams: 250 },
  { id: 'rachitele', name: 'Răchițele uscate', category: 'Fructe uscate', priceLei: 200, baseGrams: 1000, stepGrams: 250 },
  { id: 'cernosliv', name: 'Cernosliv (prune uscate)', category: 'Fructe uscate', priceLei: 90, baseGrams: 1000, stepGrams: 250 },
  { id: 'visina-uscata', name: 'Vișină uscată', category: 'Fructe uscate', priceLei: 350, baseGrams: 1000, stepGrams: 250 },
  { id: 'ananas-uscat', name: 'Ananas uscat', category: 'Fructe uscate', priceLei: 270, baseGrams: 1000, stepGrams: 250 },
  { id: 'cuburi-cocos', name: 'Cuburi de cocos', category: 'Fructe uscate', priceLei: 200, baseGrams: 1000, stepGrams: 250 },
  { id: 'smochine-uscate', name: 'Smochine uscate', category: 'Fructe uscate', priceLei: 220, baseGrams: 1000, stepGrams: 250 },
  { id: 'cipsuri-banane', name: 'Cipsuri din banane', category: 'Fructe uscate', priceLei: 60, baseGrams: 300, stepGrams: 300 },

  // Semințe
  { id: 'seminte-dovleac', name: 'Semințe de dovleac', category: 'Semințe', priceLei: 180, baseGrams: 1000, stepGrams: 250 },
  { id: 'seminte-floarea-soarelui', name: 'Semințe de floarea-soarelui', category: 'Semințe', priceLei: 60, baseGrams: 1000, stepGrams: 250 },
  { id: 'seminte-chia', name: 'Semințe Chia', category: 'Semințe', priceLei: 200, baseGrams: 1000, stepGrams: 250 },
  { id: 'seminte-in-cafenii', name: 'Semințe de in cafenii', category: 'Semințe', priceLei: 100, baseGrams: 1000, stepGrams: 250 },
  { id: 'seminte-susan', name: 'Semințe de susan', category: 'Semințe', priceLei: 160, baseGrams: 1000, stepGrams: 250 },
  { id: 'mix-4-seminte', name: 'Mix 4 semințe', category: 'Semințe', priceLei: 30, baseGrams: 200, stepGrams: 200 },
  { id: 'quinoa', name: 'Quinoa', category: 'Semințe', priceLei: 150, baseGrams: 1000, stepGrams: 250 },

  // Mix
  { id: 'mix-nuci-fructe-seminte', name: 'Mix migdale, caju, nuci grecești, macadamia, alune, stafide, vișină, răchițele și semințe de dovleac', category: 'Mix', priceLei: 70, baseGrams: 250, stepGrams: 250 },

  // Cafea boabe
  { id: 'marzotto-expresso-bar-grani', name: 'Marzotto Expresso Bar Grani (Italia)', category: 'Cafea boabe', priceLei: 350, baseGrams: 1000, stepGrams: 250 },

  // Olive conservate
  { id: 'olive-cu-samburi', name: 'Olive cu sâmburi · Producător Grecia', category: 'Olive conservate', priceLei: 100, baseGrams: 720, stepGrams: 720, priceUnitLabel: 'borcan 720 g' },
  { id: 'masline-cu-samburi', name: 'Măsline cu sâmburi · Producător Grecia', category: 'Olive conservate', priceLei: 100, baseGrams: 720, stepGrams: 720, priceUnitLabel: 'borcan 720 g' },

  // Ulei de olive
  { id: 'ulei-olive-extra-virgin', name: 'Ulei de olive Extra Virgin · presare la rece, pentru salate', category: 'Ulei de olive', priceLei: 200, baseGrams: 500, stepGrams: 500, priceUnitLabel: '0,5 L', quantityUnit: 'ml' },

  // Bomboane — ambalaj de 0,5 kg, producător Ucraina
  { id: 'prune-ciocolata-nuca', name: 'Prune în ciocolată cu nucă', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'prune-ciocolata-migdale', name: 'Prune în ciocolată cu migdale', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'zamos-galben-nuci', name: 'Zamos galben cu nuci', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'finic-nuci-ciocolata', name: 'Finic cu nuci în ciocolată', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'cocos-ciocolata', name: 'Cocos în ciocolată', category: 'Bomboane', priceLei: 180, baseGrams: 1000, stepGrams: 500 },
  { id: 'martipan', name: 'Marțipan', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'caramel-sarat', name: 'Caramel sărat', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 500 },
  { id: 'negresa-migdale', name: 'Negreasă cu migdale', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 500 },

  // Drajeuri
  { id: 'migdale-ciocolata-lapte', name: 'Migdale în ciocolată cu lapte', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
  { id: 'migdale-ciocolata-alba', name: 'Migdale în ciocolată albă / lapte', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
  { id: 'migdale-trufel', name: 'Migdale în ciocolată trufel', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
  { id: 'alune-ciocolata-lapte', name: 'Alune în ciocolată cu lapte', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
];

export function linePrice(product: Product, amount: number) {
  return Math.round((product.priceLei * amount) / product.baseGrams * 100) / 100;
}

export function priceLabel(product: Product) {
  if (product.priceUnitLabel) return `${product.priceLei} lei/${product.priceUnitLabel}`;
  return `${product.priceLei} lei/${product.baseGrams === 1000 ? 'kg' : `${product.baseGrams} g`}`;
}

export function quantityLabel(product: Product, amount: number) {
  if (product.quantityUnit === 'ml') {
    const liters = amount / 1000;
    return `${new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(liters)} L`;
  }
  return `${amount} g`;
}
