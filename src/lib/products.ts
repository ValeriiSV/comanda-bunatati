export type Category = 'Nuci' | 'Fructe uscate' | 'Bomboane' | 'Drajeuri';

export type Product = {
  id: string;
  name: string;
  category: Category;
  priceLei: number;
  baseGrams: number;
  stepGrams: number;
};

export const categories: Category[] = ['Nuci', 'Fructe uscate', 'Bomboane', 'Drajeuri'];

export const products: Product[] = [
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
  { id: 'curaga-bruna', name: 'Curaga brună', category: 'Fructe uscate', priceLei: 300, baseGrams: 1000, stepGrams: 250 },
  { id: 'curmale-tunis', name: 'Curmale Tunis', category: 'Fructe uscate', priceLei: 130, baseGrams: 1000, stepGrams: 250 },
  { id: 'curmale-regale', name: 'Curmale regale', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 250 },
  { id: 'mango-uscat', name: 'Mango uscat', category: 'Fructe uscate', priceLei: 320, baseGrams: 1000, stepGrams: 250 },
  { id: 'stafide-gold', name: 'Stafide gold', category: 'Fructe uscate', priceLei: 140, baseGrams: 1000, stepGrams: 250 },
  { id: 'stafide-negre', name: 'Stafide negre', category: 'Fructe uscate', priceLei: 180, baseGrams: 1000, stepGrams: 250 },
  { id: 'rachitele', name: 'Răchițele uscate', category: 'Fructe uscate', priceLei: 200, baseGrams: 1000, stepGrams: 250 },
  { id: 'martipan', name: 'Marțipan', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 250 },
  { id: 'caramel-sarat', name: 'Caramel sărat', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 250 },
  { id: 'negresa-migdale', name: 'Negreasă cu migdale', category: 'Bomboane', priceLei: 200, baseGrams: 1000, stepGrams: 250 },
  { id: 'migdale-ciocolata-lapte', name: 'Migdale în ciocolată cu lapte', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
  { id: 'migdale-ciocolata-alba', name: 'Migdale în ciocolată albă / lapte', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
  { id: 'migdale-trufel', name: 'Migdale în ciocolată trufel', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
  { id: 'alune-ciocolata-lapte', name: 'Alune în ciocolată cu lapte', category: 'Drajeuri', priceLei: 90, baseGrams: 250, stepGrams: 250 },
];

export function linePrice(product: Product, grams: number) {
  return Math.round((product.priceLei * grams) / product.baseGrams * 100) / 100;
}

export function priceLabel(product: Product) {
  return `${product.priceLei} lei/${product.baseGrams === 1000 ? 'kg' : `${product.baseGrams} g`}`;
}
