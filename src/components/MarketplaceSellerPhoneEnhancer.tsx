import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import './marketplace-seller-phone.css';

type DirectoryProfile = {
  uid?: string;
  displayName?: string;
  phone?: string;
  approved?: boolean;
  blocked?: boolean;
};

function normalizePhoneForTel(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

export default function MarketplaceSellerPhoneEnhancer() {
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [domVersion, setDomVersion] = useState(0);

  useEffect(() => {
    let stopDirectory: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(auth, async (user) => {
      stopDirectory?.();
      stopDirectory = undefined;
      setProfiles([]);
      if (!user) return;

      try {
        const own = await getDoc(doc(db, 'marketUsers', user.uid));
        const data = own.data() as DirectoryProfile | undefined;
        if (!data?.approved || data.blocked) return;

        const directoryQuery = query(
          collection(db, 'marketUsers'),
          where('approved', '==', true),
          where('blocked', '==', false),
        );

        stopDirectory = onSnapshot(directoryQuery, (snapshot) => {
          setProfiles(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as DirectoryProfile)));
        }, () => {
          setProfiles([]);
        });
      } catch {
        setProfiles([]);
      }
    });

    return () => {
      stopDirectory?.();
      stopAuth();
    };
  }, []);

  const phoneByName = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((profile) => {
      const name = profile.displayName?.trim();
      const phone = profile.phone?.trim();
      if (name && phone) map.set(name, phone);
    });
    return map;
  }, [profiles]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDomVersion((value) => value + 1);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.listing-card'));

    cards.forEach((card) => {
      const sellerLine = card.querySelector<HTMLElement>('.seller-line');
      const sellerName = sellerLine?.querySelector('span')?.textContent?.trim() || '';
      const existing = card.querySelector<HTMLElement>('.seller-phone-inline');
      existing?.remove();

      const phone = phoneByName.get(sellerName);
      if (!sellerLine || !phone) return;

      const anchor = document.createElement('a');
      anchor.className = 'seller-phone-inline';
      anchor.href = `tel:${normalizePhoneForTel(phone)}`;
      anchor.setAttribute('aria-label', `Sună ${sellerName} la ${phone}`);
      anchor.innerHTML = `<span aria-hidden="true">☎</span><strong>${phone}</strong><small>Sună</small>`;
      sellerLine.insertAdjacentElement('afterend', anchor);
    });

    return () => {
      document.querySelectorAll('.seller-phone-inline').forEach((item) => item.remove());
    };
  }, [phoneByName, domVersion]);

  return null;
}
