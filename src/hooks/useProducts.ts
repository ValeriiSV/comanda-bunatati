import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { products as fallbackProducts, type Product } from '@/lib/products';

export type ManagedProduct = Product & {
  active?: boolean;
  isNew?: boolean;
  promo?: boolean;
  sortOrder?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

// Lista finală a catalogului actualizată la 11.09.2026.
// Datele Firebase mai vechi nu trebuie să suprascrie prețurile sau
// pașii de cantitate actuali. Produsele/editările făcute ulterior
// din panoul managerului rămân însă active.
const CATALOG_FINAL_AT = Date.parse('2026-09-11T05:35:00Z');

function normalizeKgStep<T extends ManagedProduct>(product: T): T {
  const isBuiltInProduct = fallbackProducts.some((catalogProduct) => catalogProduct.id === product.id);
  if (isBuiltInProduct && (!product.quantityUnit || product.quantityUnit === 'g') && product.baseGrams === 1000 && !product.priceUnitLabel) {
    return { ...product, stepGrams: 500 };
  }
  return product;
}

const normalizedFallbackProducts = fallbackProducts.map((product) => normalizeKgStep({ ...product }));

function timestampMillis(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const toMillis = (value as { toMillis?: () => number }).toMillis;
    return typeof toMillis === 'function' ? toMillis.call(value) : 0;
  }
  return 0;
}

function mergeWithCatalog(remoteProducts: ManagedProduct[]) {
  const remoteById = new Map(remoteProducts.map((product) => [product.id, product]));
  const catalogIds = new Set(fallbackProducts.map((product) => product.id));

  const finalCatalog = fallbackProducts.map<ManagedProduct>((catalogProduct, index) => {
    const remote = remoteById.get(catalogProduct.id);
    if (!remote) return { ...catalogProduct, sortOrder: index };

    const editedAfterFinalCatalog = timestampMillis(remote.updatedAt) > CATALOG_FINAL_AT;
    if (editedAfterFinalCatalog) {
      return { ...catalogProduct, ...remote, id: catalogProduct.id };
    }

    return {
      ...catalogProduct,
      active: remote.active,
      isNew: remote.isNew,
      promo: remote.promo,
      sortOrder: index,
    };
  });

  const futureCustomProducts = remoteProducts.filter((product) => {
    if (catalogIds.has(product.id)) return false;
    return timestampMillis(product.createdAt) > CATALOG_FINAL_AT;
  });

  return [...finalCatalog, ...futureCustomProducts]
    .map((product) => normalizeKgStep(product))
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
}

export function useProducts() {
  const [products, setProducts] = useState<ManagedProduct[]>(normalizedFallbackProducts);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const productsQuery = query(collection(db, 'products'), orderBy('sortOrder', 'asc'));
    return onSnapshot(productsQuery, (snapshot) => {
      if (snapshot.empty) {
        setProducts(normalizedFallbackProducts);
        setUsingFallback(true);
      } else {
        const remoteProducts = snapshot.docs.map((entry) => ({
          id: entry.id,
          ...(entry.data() as Omit<ManagedProduct, 'id'>),
        }));
        setProducts(mergeWithCatalog(remoteProducts));
        setUsingFallback(false);
      }
      setError('');
      setLoading(false);
    }, () => {
      setProducts(normalizedFallbackProducts);
      setUsingFallback(true);
      setError('Catalogul Firebase nu a putut fi încărcat. Se afișează catalogul local.');
      setLoading(false);
    });
  }, []);

  return { products, loading, usingFallback, error };
}
