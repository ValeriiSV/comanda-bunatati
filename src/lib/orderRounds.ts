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
