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

        stopDirectory = onSnapshot(
          directoryQuery,
          (snapshot) => {
            setProfiles(
              snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as DirectoryProfile)),
            );
          },
          () => setProfiles([]),
        );
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
    let scheduled = false;

    const applyPhones = () => {
      scheduled = false;
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.listing-card'));

      cards.forEach((card) => {
        const sellerLine = card.querySelector<HTMLElement>('.seller-line');
        if (!sellerLine) return;

        const sellerName = sellerLine.querySelector('span')?.textContent?.trim() || '';
        const phone = phoneByName.get(sellerName) || '';
        const existing = card.querySelector<HTMLAnchorElement>('.seller-phone-inline');

        if (!phone) {
          existing?.remove();
          return;
        }

        const href = `tel:${normalizePhoneForTel(phone)}`;

        if (existing) {
          if (existing.dataset.phone !== phone) {
            existing.dataset.phone = phone;
            existing.href = href;
            const strong = existing.querySelector('strong');
            if (strong) strong.textContent = phone;
            existing.setAttribute('aria-label', `Sună ${sellerName} la ${phone}`);
          }
          return;
        }

        const anchor = document.createElement('a');
        anchor.className = 'seller-phone-inline';
        anchor.href = href;
        anchor.dataset.phone = phone;
        anchor.setAttribute('aria-label', `Sună ${sellerName} la ${phone}`);

        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '☎';

        const strong = document.createElement('strong');
        strong.textContent = phone;

        const small = document.createElement('small');
        small.textContent = 'Sună';

        anchor.append(icon, strong, small);
        sellerLine.insertAdjacentElement('afterend', anchor);
      });
    };

    const scheduleApply = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(applyPhones);
    };

    applyPhones();

    const observer = new MutationObserver((mutations) => {
      const hasRelevantChange = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) => {
          if (!(node instanceof HTMLElement)) return false;
          return node.matches?.('.listing-card') || Boolean(node.querySelector?.('.listing-card'));
        }),
      );

      if (hasRelevantChange) scheduleApply();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [phoneByName]);

  return null;
}
