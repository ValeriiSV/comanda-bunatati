import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAdminSession, getDocument, updateDocument } from '@/lib/firebaseRest';

const STORAGE_KEY = 'bunatati_cutoff_time_v1';

function findScheduleSection() {
  return Array.from(document.querySelectorAll('section')).find((section) =>
    section.querySelector('h2')?.textContent?.trim() === 'Următoarea comandă',
  ) as HTMLElement | undefined;
}

export default function OrderDeadlineTimeEditor() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [time, setTime] = useState(localStorage.getItem(STORAGE_KEY) || '');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const locate = () => setTarget(findScheduleSection() || null);
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const sync = async () => {
      try {
        const session = await getAdminSession();
        if (!session) {
          timer = window.setTimeout(sync, 1200);
          return;
        }
        const schedule = await getDocument('settings/orderSchedule');
        const remoteTime = typeof schedule?.cutoffTime === 'string' ? schedule.cutoffTime : '';
        const localTime = localStorage.getItem(STORAGE_KEY) || '';

        if (remoteTime) {
          localStorage.setItem(STORAGE_KEY, remoteTime);
          if (!cancelled) setTime(remoteTime);
        } else if (localTime) {
          await updateDocument('settings/orderSchedule', { cutoffTime: localTime, updatedAt: new Date() });
          if (!cancelled) setTime(localTime);
        }
        if (!cancelled) setReady(true);
      } catch {
        timer = window.setTimeout(sync, 1800);
      }
    };

    void sync();

    const guard = window.setInterval(async () => {
      const localTime = localStorage.getItem(STORAGE_KEY) || '';
      if (!localTime) return;
      try {
        const session = await getAdminSession();
        if (!session) return;
        const schedule = await getDocument('settings/orderSchedule');
        if (!schedule?.cutoffTime) {
          await updateDocument('settings/orderSchedule', { cutoffTime: localTime, updatedAt: new Date() });
        }
      } catch {
        // Reîncercăm la următorul interval.
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(guard);
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setNotice('');
    try {
      await updateDocument('settings/orderSchedule', { cutoffTime: time, updatedAt: new Date() });
      if (time) localStorage.setItem(STORAGE_KEY, time);
      else localStorage.removeItem(STORAGE_KEY);
      setNotice(time ? `Ora limită a fost setată la ${time}.` : 'Ora limită a fost eliminată.');
    } catch {
      setNotice('Nu am putut salva ora limită. Reîncearcă după autentificare.');
    } finally {
      setSaving(false);
    }
  };

  if (!target || !ready) return null;

  return createPortal(
    <div className="mt-4 rounded-2xl border border-[#e4d4b8] bg-white/75 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 sm:max-w-[220px]">
          <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[#5d4527]"><Clock3 className="size-4" /> Ora limită</span>
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="bg-white" />
        </label>
        <Button type="button" variant="outline" onClick={save} disabled={saving} className="sm:mb-0">
          <Save className="size-4" /> {saving ? 'Se salvează…' : 'Salvează ora'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-[#7d674d]">Această oră se aplică datei limită afișate în catalog și countdown-ului public.</p>
      {notice && <p className="mt-2 text-xs font-medium text-[#315b32]">{notice}</p>}
    </div>,
    target,
  );
}
