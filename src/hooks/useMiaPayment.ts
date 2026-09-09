import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type MiaPaymentSettings = {
  phone: string;
  paymentLink: string;
  recipientName: string;
};

// Linkul real extras din QR-ul MIA generat în MICB Mobile Banking.
// Când colegul îl deschide, MIA îi permite să aleagă banca și apoi
// îl redirecționează către aplicația bancară pentru confirmarea plății.
const DEFAULT_MIA_PAYMENT_LINK = 'https://mia-qr.bnm.md/1/m/BNM/MCB983a07f55265457d90654eb9f97574fc';

const emptySettings: MiaPaymentSettings = {
  phone: '',
  paymentLink: DEFAULT_MIA_PAYMENT_LINK,
  recipientName: '',
};

export function useMiaPayment() {
  const [payment, setPayment] = useState<MiaPaymentSettings>(emptySettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'miaPayment'), (snapshot) => {
      if (!snapshot.exists()) {
        setPayment(emptySettings);
      } else {
        const data = snapshot.data() as Partial<MiaPaymentSettings>;
        setPayment({
          phone: data.phone || '',
          paymentLink: data.paymentLink || DEFAULT_MIA_PAYMENT_LINK,
          recipientName: data.recipientName || '',
        });
      }
      setLoading(false);
    }, () => {
      setPayment(emptySettings);
      setLoading(false);
    });
  }, []);

  return { payment, loading };
}
