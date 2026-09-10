import { useEffect, useState } from 'react';

export type OrderSchedule = {
  dates: string[];
  message?: string;
  closed?: boolean;
};

const SCHEDULE_URL = 'https://firestore.googleapis.com/v1/projects/comanda-bunatati/databases/(default)/documents/settings/orderSchedule';

function readString(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const candidate = value as { stringValue?: unknown };
  return typeof candidate.stringValue === 'string' ? candidate.stringValue : '';
}

function readBoolean(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { booleanValue?: unknown };
  return candidate.booleanValue === true;
}

function parseSchedule(data: unknown): OrderSchedule {
  if (!data || typeof data !== 'object') return { dates: [] };

  const fields = (data as { fields?: Record<string, unknown> }).fields || {};
  const datesField = fields.dates as { arrayValue?: { values?: unknown[] } } | undefined;
  const values = datesField?.arrayValue?.values || [];

  return {
    dates: values.map(readString).filter(Boolean).sort(),
    message: readString(fields.message),
    closed: readBoolean(fields.closed),
  };
}

export function useOrderSchedule() {
  const [schedule, setSchedule] = useState<OrderSchedule>({ dates: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(`${SCHEDULE_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const data = await response.json();
        if (active) setSchedule(parseSchedule(data));
      } catch {
        if (active) setSchedule({ dates: [] });
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(load, 30000);

    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, []);

  return { schedule, loading };
}

export function formatOrderDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('ro-MD', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}
