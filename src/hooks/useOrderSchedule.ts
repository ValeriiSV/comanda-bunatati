import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type OrderSchedule = {
  dates: string[];
  message?: string;
};

export function useOrderSchedule() {
  const [schedule, setSchedule] = useState<OrderSchedule>({ dates: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'orderSchedule'), (snapshot) => {
      const data = snapshot.data() as Partial<OrderSchedule> | undefined;
      setSchedule({
        dates: Array.isArray(data?.dates) ? data!.dates.filter((date): date is string => typeof date === 'string').sort() : [],
        message: typeof data?.message === 'string' ? data.message : '',
      });
      setLoading(false);
    }, () => {
      setSchedule({ dates: [] });
      setLoading(false);
    });
  }, []);

  return { schedule, loading };
}

export function formatOrderDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('ro-MD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
}
