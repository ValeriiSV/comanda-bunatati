import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { products as fallbackProducts, type Product } from '@/lib/products';

export type ManagedProduct = Product & {
  active?: boolean;
  isNew?: boolean;
  promo?: boolean;
  sortOrder?: number;
};

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
        setProducts(snapshot.docs.map((entry) => ({
          id: entry.id,
          ...(entry.data() as Omit<ManagedProduct, 'id'>),
        })));
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
