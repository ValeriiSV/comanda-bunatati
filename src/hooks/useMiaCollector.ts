import { useEffect, useState } from 'react';

export type MiaCollector = {
  name: string;
  phone: string;
};

const EMPTY: MiaCollector = { name: '', phone: '' };
const URL = 'https://firestore.googleapis.com/v1/projects/comanda-bunatati/databases/(default)/documents/settings/miaCollector';

function decodeString(field: any) {
  return typeof field?.stringValue === 'string' ? field.stringValue : '';
}

export function useMiaCollector() {
  const [collector, setCollector] = useState<MiaCollector>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(String(response.status));
        const document = await response.json();
        if (cancelled) return;
        setCollector({
          name: decodeString(document?.fields?.name),
          phone: decodeString(document?.fields?.phone),
        });
      } catch {
        if (!cancelled) setCollector(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(load, 30000);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, []);

  return { collector, loading };
}
