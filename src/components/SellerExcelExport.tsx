import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';
import { listCollection } from '@/lib/firebaseRest';

type OrderItem = {
  productId?: string;
  productName?: string;
  grams?: number;
  lineTotalBani?: number;
};

type Order = {
  createdAt?: Date | string | null;
  items?: OrderItem[];
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function orderDate(order: Order) {
  const date = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function findSelectedMonth() {
  const sections = Array.from(document.querySelectorAll('section'));
  const periodSection = sections.find((section) => section.textContent?.includes('Perioada comenzilor'));
  const select = periodSection?.querySelector('select') as HTMLSelectElement | null;
  return select?.value || monthKey(new Date());
}

export default function SellerExcelExport() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const timer = window.setInterval(() => {
      attempts += 1;
      const sections = Array.from(document.querySelectorAll('section'));
      const sellerSection = sections.find((section) => section.textContent?.includes('Lista pentru vânzător'));
      const heading = sellerSection?.querySelector('h2');

      if (sellerSection && heading) {
        let target = sellerSection.querySelector('[data-seller-excel-slot]') as HTMLElement | null;
        if (!target) {
          target = document.createElement('div');
          target.setAttribute('data-seller-excel-slot', 'true');
          target.style.marginTop = '12px';
          heading.insertAdjacentElement('afterend', target);
        }
        if (!cancelled) setMount(target);
        window.clearInterval(timer);
      } else if (attempts >= 50) {
        window.clearInterval(timer);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const exportExcel = async () => {
    setBusy(true);
    try {
      const selectedMonth = findSelectedMonth();
      const orders = (await listCollection('groupOrders')) as Order[];
      const monthOrders = orders.filter((order) => monthKey(orderDate(order)) === selectedMonth);

      const grouped = new Map<string, { name: string; grams: number; sumBani: number }>();
      monthOrders.forEach((order) => {
        (order.items || []).forEach((item) => {
          const key = item.productId || item.productName || 'produs';
          const current = grouped.get(key) || {
            name: item.productName || 'Produs',
            grams: 0,
            sumBani: 0,
          };
          current.grams += Number(item.grams) || 0;
          current.sumBani += Number(item.lineTotalBani) || 0;
          grouped.set(key, current);
        });
      });

      const rows = [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
      const totalGrams = rows.reduce((sum, row) => sum + row.grams, 0);
      const totalBani = rows.reduce((sum, row) => sum + row.sumBani, 0);

      const tableRows = rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${row.grams}</td>
          <td>${(row.grams / 1000).toFixed(3)}</td>
          <td>${(row.sumBani / 100).toFixed(2)}</td>
        </tr>`).join('');

      const html = `<!doctype html>
<html><head><meta charset="UTF-8"></head><body>
<table border="1">
  <tr><th colspan="4">Lista pentru vânzător — ${escapeHtml(selectedMonth)}</th></tr>
  <tr><th>Produs</th><th>Cantitate (g)</th><th>Cantitate (kg)</th><th>Sumă (lei)</th></tr>
  ${tableRows}
  <tr><th>TOTAL GENERAL</th><th>${totalGrams}</th><th>${(totalGrams / 1000).toFixed(3)}</th><th>${(totalBani / 100).toFixed(2)}</th></tr>
</table>
</body></html>`;

      const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lista-vanzator-${selectedMonth}.xls`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(`Exportul Excel nu a reușit: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!mount) return null;

  return createPortal(
    <button
      type="button"
      onClick={exportExcel}
      disabled={busy}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#d9e3d7] bg-white px-3 text-sm font-semibold text-[#173d2c] transition hover:bg-[#f2f5ed] disabled:opacity-50"
    >
      <Download className="size-4" />
      {busy ? 'Se exportă…' : 'Export Excel'}
    </button>,
    mount,
  );
}
