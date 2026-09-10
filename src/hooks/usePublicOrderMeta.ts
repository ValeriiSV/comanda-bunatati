import { useEffect, useState } from 'react';

const BASE = 'https://firestore.googleapis.com/v1/projects/comanda-bunatati/databases/(default)/documents/settings';

export type PublicOrderStats = {
  orderCount: number;
  totalBani: number;
  paidCount: number;
  roundLabel: string;
  updatedAt?: string;
};

type FireValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  mapValue?: { fields?: Record<string, FireValue> };
};

function numberValue(value?: FireValue) {
  if (!value) return 0;
  if (typeof value.doubleValue === 'number') return value.doubleValue;
  if (typeof value.integerValue === 'string') return Number(value.integerValue) || 0;
  return 0;
}

function stringValue(value?: FireValue) {
  if (!value) return '';
  return typeof value.stringValue === 'string' ? value.stringValue : '';
}

async function fetchDocument(name: string) {
  const response = await fetch(`${BASE}/${name}?t=${Date.now()}`, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json() as Promise<{ fields?: Record<string, FireValue> }>;
}

export function usePublicOrderMeta() {
  const [stats, setStats] = useState<PublicOrderStats>({
    orderCount: 0,
    totalBani: 0,
    paidCount: 0,
    roundLabel: '',
  });
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [statsDoc, statusesDoc] = await Promise.all([
          fetchDocument('publicStats'),
          fetchDocument('publicStatuses'),
        ]);
        if (!active) return;

        const fields = statsDoc?.fields || {};
        setStats({
          orderCount: numberValue(fields.orderCount),
          totalBani: numberValue(fields.totalBani),
          paidCount: numberValue(fields.paidCount),
          roundLabel: stringValue(fields.roundLabel),
          updatedAt: fields.updatedAt?.timestampValue,
        });

        const map = statusesDoc?.fields?.statuses?.mapValue?.fields || {};
        setStatuses(Object.fromEntries(
          Object.entries(map)
            .map(([code, value]) => [code.toUpperCase(), stringValue(value)])
            .filter(([, status]) => Boolean(status)),
        ));
      } catch {
        // Metadatele publice sunt auxiliare; catalogul trebuie să rămână funcțional.
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(load, 20000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return { stats, statuses, loading };
}
