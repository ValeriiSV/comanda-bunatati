import { useEffect, useState } from 'react';

const BASE = 'https://firestore.googleapis.com/v1/projects/comanda-bunatati/databases/(default)/documents/settings';

export type PublicProductTotal = {
  name: string;
  amount: number;
  unit: string;
  orders: number;
  bani: number;
};

export type CollectiveGoal = {
  goalAmount: number;
  goalPriceLei: number;
};

export type PublicOrderStats = {
  orderCount: number;
  totalBani: number;
  paidCount: number;
  roundLabel: string;
  totalGrams: number;
  lastOrderAt?: string;
  topProductName?: string;
  topProductAmount?: number;
  topProductUnit?: string;
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
  return typeof value?.stringValue === 'string' ? value.stringValue : '';
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
    totalGrams: 0,
  });
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [productTotals, setProductTotals] = useState<Record<string, PublicProductTotal>>({});
  const [goals, setGoals] = useState<Record<string, CollectiveGoal>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [statsDoc, statusesDoc, goalsDoc] = await Promise.all([
          fetchDocument('publicStats'),
          fetchDocument('publicStatuses'),
          fetchDocument('collectiveGoals'),
        ]);
        if (!active) return;

        const fields = statsDoc?.fields || {};
        setStats({
          orderCount: numberValue(fields.orderCount),
          totalBani: numberValue(fields.totalBani),
          paidCount: numberValue(fields.paidCount),
          roundLabel: stringValue(fields.roundLabel),
          totalGrams: numberValue(fields.totalGrams),
          lastOrderAt: fields.lastOrderAt?.timestampValue,
          topProductName: stringValue(fields.topProductName),
          topProductAmount: numberValue(fields.topProductAmount),
          topProductUnit: stringValue(fields.topProductUnit),
          updatedAt: fields.updatedAt?.timestampValue,
        });

        const statusMap = statusesDoc?.fields?.statuses?.mapValue?.fields || {};
        setStatuses(Object.fromEntries(
          Object.entries(statusMap)
            .map(([code, value]) => [code.toUpperCase(), stringValue(value)])
            .filter(([, status]) => Boolean(status)),
        ));

        const totalsMap = fields.productTotals?.mapValue?.fields || {};
        setProductTotals(Object.fromEntries(Object.entries(totalsMap).map(([id, value]) => {
          const f = value.mapValue?.fields || {};
          return [id, {
            name: stringValue(f.name),
            amount: numberValue(f.amount),
            unit: stringValue(f.unit),
            orders: numberValue(f.orders),
            bani: numberValue(f.bani),
          }];
        })));

        const goalsMap = goalsDoc?.fields?.goals?.mapValue?.fields || {};
        const goalEntries = Object.entries(goalsMap).map(([id, value]): [string, CollectiveGoal] => {
          const f = value.mapValue?.fields || {};
          return [id, {
            goalAmount: numberValue(f.goalAmount),
            goalPriceLei: numberValue(f.goalPriceLei),
          }];
        });
        setGoals(Object.fromEntries(
          goalEntries.filter(([, goal]) => goal.goalAmount > 0 && goal.goalPriceLei > 0),
        ));
      } catch {
        // Metadatele publice sunt auxiliare; catalogul trebuie să rămână funcțional.
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(load, 15000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return { stats, statuses, productTotals, goals, loading };
}
