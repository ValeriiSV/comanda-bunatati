import { useState } from 'react';
import { Download } from 'lucide-react';
import { listCollection } from '@/lib/firebaseRest';

type OrderItem = {
  productId?: string;
  productName?: string;
  grams?: number;
  quantityUnit?: string;
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

function amountLabel(amount: number, unit = 'g') {
  if (unit === 'g') return amount >= 1000 && amount % 1000 === 0 ? `${amount / 1000} kg` : `${amount} g`;
  if (unit === 'ml') return amount >= 1000 ? `${amount / 1000} L` : `${amount} ml`;
  if (unit === 'buc') return `${amount} buc.`;
  return `${amount} ${unit}`;
}

export default function SellerExcelExport({ selectedMonth }: { selectedMonth: string }) {
  const [busy, setBusy] = useState(false);

  const exportExcel = async () => {
    setBusy(true);
    try {
      const month = selectedMonth || monthKey(new Date());
      const orders = (await listCollection('groupOrders')) as Order[];
      const monthOrders = orders.filter((order) => monthKey(orderDate(order)) === month);

      const grouped = new Map<string, { name: string; grams: number; unit: string; sumBani: number }>();
      monthOrders.forEach((order) => {
        (order.items || []).forEach((item) => {
          const key = item.productId || item.productName || 'produs';
          const current = grouped.get(key) || {
            name: item.productName || 'Produs',
            grams: 0,
            unit: item.quantityUnit || 'g',
            sumBani: 0,
          };
          current.grams += Number(item.grams) || 0;
          current.sumBani += Number(item.lineTotalBani) || 0;
          grouped.set(key, current);
        });
      });

      const rows = [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
      const totalBani = rows.reduce((sum, row) => sum + row.sumBani, 0);
      const tableRows = rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(amountLabel(row.grams, row.unit))}</td>
          <td>${(row.sumBani / 100).toFixed(2)}</td>
        </tr>`).join('');

      const html = `<!doctype html>
<html><head><meta charset="UTF-8"></head><body>
<table border="1">
  <tr><th colspan="3">Lista pentru vânzător — ${escapeHtml(month)}</th></tr>
  <tr><th>Produs</th><th>Cantitate</th><th>Sumă (lei)</th></tr>
  ${tableRows}
  <tr><th>TOTAL GENERAL</th><th></th><th>${(totalBani / 100).toFixed(2)}</th></tr>
</table>
</body></html>`;

      const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lista-vanzator-${month}.xls`;
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

  return (
    <button
      type="button"
      onClick={exportExcel}
      disabled={busy}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#d9e3d7] bg-white px-3 text-sm font-semibold text-[#173d2c] transition hover:bg-[#f2f5ed] disabled:opacity-50"
    >
      <Download className="size-4" />
      {busy ? 'Se exportă…' : 'Excel vânzător'}
    </button>
  );
}
