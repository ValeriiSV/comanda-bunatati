export type RoundAwareOrder = {
  roundId?: string;
  roundLabel?: string;
  roundSequence?: number;
  createdAt?: Date | string | null;
  scheduledOrderDates?: string[];
};

export type RoundMeta = {
  roundId: string;
  roundLabel: string;
  roundSequence: number;
  roundMonth: string;
};

export function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function dateFromOrder(order: RoundAwareOrder) {
  const value = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || 0);
  return Number.isNaN(value.getTime()) ? new Date() : value;
}

export function monthLabelFromKey(key: string) {
  const [year, month] = key.split('-').map(Number);
  const label = new Intl.DateTimeFormat('ro-MD', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function roundMeta(monthKey: string, sequence = 1): RoundMeta {
  const safeSequence = Math.max(1, Math.floor(sequence || 1));
  return {
    roundId: `${monthKey}-r${safeSequence}`,
    roundLabel: `${monthLabelFromKey(monthKey)} · Runda #${safeSequence}`,
    roundSequence: safeSequence,
    roundMonth: monthKey,
  };
}

export function roundMonthFromDateValue(value?: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
  return monthKeyFromDate(new Date());
}

export function effectiveRound(order: RoundAwareOrder): RoundMeta {
  if (order.roundId) {
    const month = order.roundId.match(/^(\d{4}-\d{2})/)?.[1] || monthKeyFromDate(dateFromOrder(order));
    const sequence = Number(order.roundSequence) || Number(order.roundId.match(/-r(\d+)$/)?.[1]) || 1;
    return {
      roundId: order.roundId,
      roundLabel: order.roundLabel || roundMeta(month, sequence).roundLabel,
      roundSequence: sequence,
      roundMonth: month,
    };
  }

  // Toate comenzile create înainte de sistemul de runde sunt considerate Runda #1.
  const month = order.scheduledOrderDates?.[0]?.slice(0, 7) || monthKeyFromDate(dateFromOrder(order));
  return roundMeta(month, 1);
}

export function sameRound(order: RoundAwareOrder, roundId: string) {
  return effectiveRound(order).roundId === roundId;
}


export const ORDER_STAGES = ['Trimisă', 'Confirmată', 'Comandată furnizorului', 'Gata de ridicare', 'Predată'] as const;
export type OrderStage = typeof ORDER_STAGES[number];
export type GroupableItem = { productId?: string; productName?: string; category?: string; grams?: number; quantityUnit?: string; lineTotalBani?: number };
export type GroupableOrder = RoundAwareOrder & { id: string; phone?: string; customerName?: string; orderCode?: string; paid?: boolean; totalBani?: number; discountBani?: number; status?: string; items?: GroupableItem[] };

export function normalizedOrderPhone(value?: string) {
  const raw = (value || '').trim();
  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^0\d{8}$/.test(digits)) digits = '373' + digits.slice(1);
  if (/^[67]\d{7}$/.test(digits)) digits = '373' + digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}
export function stageRank(status?: string) {
  return Math.max(0, ORDER_STAGES.indexOf((status || 'Trimisă') as OrderStage));
}
export function groupStage(orders: GroupableOrder[]): OrderStage {
  return ORDER_STAGES[orders.length ? Math.min(...orders.map(o => stageRank(o.status))) : 0];
}
export function grossOrderBani(order: GroupableOrder) {
  return Math.max(0, Math.round(Number(order.totalBani) || 0));
}
export function orderDiscountBani(order: GroupableOrder) {
  return Math.min(grossOrderBani(order), Math.max(0, Math.round(Number(order.discountBani) || 0)));
}
export function netOrderBani(order: GroupableOrder) {
  return grossOrderBani(order) - orderDiscountBani(order);
}
export function parseDiscountLei(value: string): number | null {
  const clean = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const bani = Math.round(Number(clean) * 100);
  return Number.isSafeInteger(bani) ? bani : null;
}
// Preserve amounts already recorded as paid. Allocate the remaining discount
// deterministically over unpaid submissions in the same customer group.
export function allocateGroupDiscount<T extends GroupableOrder>(entries: T[], requestedBani: number) {
  const locked = entries.filter(o => o.paid).reduce((sum,o) => sum + orderDiscountBani(o), 0);
  const unpaid = entries.filter(o => !o.paid).sort((a,b) => a.id.localeCompare(b.id));
  const capacity = unpaid.reduce((sum,o) => sum + grossOrderBani(o), 0);
  if (!Number.isSafeInteger(requestedBani) || requestedBani < locked || requestedBani > locked + capacity) throw new Error('Reducerea depășește suma disponibilă sau modifică o plată deja înregistrată.');
  let remaining = requestedBani - locked;
  return unpaid.map(o => {
    const discountBani = Math.min(grossOrderBani(o), remaining);
    remaining -= discountBani;
    return { id: o.id, discountBani };
  });
}
export function groupRoundOrders<T extends GroupableOrder>(orders: T[]) {
  const groups = new Map<string, T[]>();
  for (const order of orders) {
    const phone = normalizedOrderPhone(order.phone);
    const key = phone ? JSON.stringify([effectiveRound(order).roundId, phone]) : JSON.stringify(['id', order.id]);
    const entries = groups.get(key) || [];
    entries.push(order);
    groups.set(key, entries);
  }
  return [...groups].map(([key, entries]) => {
    const items = new Map<string, GroupableItem>();
    for (const order of entries) for (const [index, item] of (order.items || []).entries()) {
      const key = JSON.stringify([item.productId || item.productName || order.id + index, item.quantityUnit || 'g']);
      const previous = items.get(key);
      if (previous) {
        previous.grams = (Number(previous.grams) || 0) + (Number(item.grams) || 0);
        previous.lineTotalBani = (Number(previous.lineTotalBani) || 0) + (Number(item.lineTotalBani) || 0);
      } else items.set(key, { ...item });
    }
    return { key, entries, items: [...items.values()],
      grossBani: entries.reduce((sum,o) => sum + grossOrderBani(o),0),
      discountBani: entries.reduce((sum,o) => sum + orderDiscountBani(o),0),
      totalBani: entries.reduce((sum,o) => sum + netOrderBani(o),0),
      paidBani: entries.reduce((sum,o) => sum + (o.paid ? netOrderBani(o) : 0),0),
      status: groupStage(entries), paid: entries.every(o => o.paid) };
  });
}
