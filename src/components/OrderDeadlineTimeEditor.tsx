import { useEffect, useState } from 'react';
import { Clock3, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAdminSession, getDocument, updateDocument } from '@/lib/firebaseRest';

const STORAGE_KEY = 'bunatati_cutoff_time_v1';

export default function OrderDeadlineTimeEditor() {
  const [time, setTime] = useState(localStorage.getItem(STORAGE_KEY) || '');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const session = await getAdminSession();
        if (!session) return;
        const schedule = await getDocument('settings/orderSchedule');
        const remoteTime = typeof schedule?.cutoffTime === 'string' ? schedule.cutoffTime : '';
        if (cancelled) return;

        if (remoteTime) {
          localStorage.setItem(STORAGE_KEY, remoteTime);
          setTime(remoteTime);
        }
        setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    };

    void sync();
    return () => { cancelled = true; };
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
      setNotice('Nu am putut salva ora limită.');
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="mt-4 rounded-2xl border border-[#e4d4b8] bg-white/75 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 sm:max-w-[220px]">
          <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[#5d4527]"><Clock3 className="size-4" /> Ora limită</span>
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="bg-white" />
        </label>
        <Button type="button" variant="outline" onClick={save} disabled={saving}>
          <Save className="size-4" /> {saving ? 'Se salvează…' : 'Salvează ora'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-[#7d674d]">Ora se aplică datei limită și countdown-ului din catalog.</p>
      {notice && <p className="mt-2 text-xs font-medium text-[#315b32]">{notice}</p>}
    </div>
  );
}
