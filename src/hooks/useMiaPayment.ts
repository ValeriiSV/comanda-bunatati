import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type MiaPaymentSettings = {
  phone: string;
  paymentLink: string;
  recipientName: string;
};

const emptySettings: MiaPaymentSettings = {
  phone: '',
  paymentLink: '',
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
          paymentLink: data.paymentLink || '',
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
