import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { products as fallbackProducts, type Product } from '@/lib/products';

export type ManagedProduct = Product & {
  active?: boolean;
  isNew?: boolean;
  promo?: boolean;
  sortOrder?: number;
  updatedAt?: unknown;
};

// Produsele din catalog au fost actualizate la 10.09.2026.
// Valorile Firebase mai vechi decât această versiune nu trebuie să suprascrie
// noile prețuri/cantități, dar păstrăm statusurile (activ/nou/promo).
const CATALOG_REFRESH_AT = Date.parse('2026-09-10T04:45:00Z');

function updatedAtMillis(value: unknown) {
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

  const refreshed = fallbackProducts.map<ManagedProduct>((catalogProduct, index) => {
    const remote = remoteById.get(catalogProduct.id);
    if (!remote) return { ...catalogProduct, sortOrder: index };

    const remoteWasEditedAfterRefresh = updatedAtMillis(remote.updatedAt) > CATALOG_REFRESH_AT;
    if (remoteWasEditedAfterRefresh) {
      return { ...catalogProduct, ...remote, id: catalogProduct.id };
    }

    return {
      ...catalogProduct,
      active: remote.active,
      isNew: remote.isNew,
      promo: remote.promo,
      sortOrder: remote.sortOrder ?? index,
    };
  });

  // Produsele create ulterior direct din panoul managerului rămân vizibile.
  const customProducts = remoteProducts.filter((product) => !catalogIds.has(product.id));

  return [...refreshed, ...customProducts].sort(
    (a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999),
  );
}

export function useProducts() {
  const [products, setProducts] = useState<ManagedProduct[]>(fallbackProducts);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const productsQuery = query(collection(db, 'products'), orderBy('sortOrder', 'asc'));
    return onSnapshot(productsQuery, (snapshot) => {
      if (snapshot.empty) {
        setProducts(fallbackProducts);
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
      setProducts(fallbackProducts);
      setUsingFallback(true);
      setError('Catalogul Firebase nu a putut fi încărcat. Se afișează catalogul local.');
      setLoading(false);
    });
  }, []);

  return { products, loading, usingFallback, error };
}
