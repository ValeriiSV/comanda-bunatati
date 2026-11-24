import { useState } from 'react';
import { Download } from 'lucide-react';
import { listCollection } from '@/lib/firebaseRest';
import { effectiveRound, groupRoundOrders, type GroupableOrder } from '@/lib/orderRounds';

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function exportUnit(unit = 'g') {
  return unit === 'g' ? 'gr' : unit;
}

export default function SellerExcelExport({ selectedMonth, selectedRoundId }: { selectedMonth: string; selectedRoundId?: string }) {
  const [busy, setBusy] = useState(false);

  const exportExcel = async () => {
    setBusy(true);
    try {
      const month = selectedMonth || monthKey(new Date());
      const orders = (await listCollection('groupOrders')) as GroupableOrder[];
      const monthOrders = orders.filter((order) =>
        effectiveRound(order).roundMonth === month &&
        (!selectedRoundId || effectiveRound(order).roundId === selectedRoundId)
      );

      const grouped = new Map<string, { name: string; grams: number; unit: string; sumBani: number }>();
      monthOrders.forEach((order) => {
        (order.items || []).forEach((item) => {
          const unit = item.quantityUnit || 'g';
          const key = JSON.stringify([item.productId || item.productName || 'produs', unit]);
          const current = grouped.get(key) || {
            name: item.productName || 'Produs',
            grams: 0,
            unit,
            sumBani: 0,
          };
          current.grams += Number(item.grams) || 0;
          current.sumBani += Number(item.lineTotalBani) || 0;
          grouped.set(key, current);
        });
      });

      const rows = [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
      const totalBani = rows.reduce((sum, row) => sum + row.sumBani, 0);
      const customerGroups = groupRoundOrders(monthOrders);
      const grossBani = customerGroups.reduce((sum, group) => sum + group.grossBani, 0);
      const discountBani = customerGroups.reduce((sum, group) => sum + group.discountBani, 0);
      const netBani = customerGroups.reduce((sum, group) => sum + group.totalBani, 0);
      const tableRows = rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td x:num="${row.grams}" style="mso-number-format:'0.###'">${row.grams}</td>
          <td>${escapeHtml(exportUnit(row.unit))}</td>
          <td x:num="${(row.sumBani / 100).toFixed(2)}" style="mso-number-format:'0.00'">${(row.sumBani / 100).toFixed(2)}</td>
        </tr>`).join('');

      const html = `<!doctype html>
<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>
<table border="1">
  <tr><th colspan="4">Lista pentru vânzător — ${escapeHtml(selectedRoundId || month)}</th></tr>
  <tr><th>Produs</th><th>Cantitate</th><th>Unitate</th><th>Sumă (lei)</th></tr>
  ${tableRows}
  <tr><th>TOTAL PRODUSE (furnizor)</th><th></th><th></th><th x:num="${(totalBani / 100).toFixed(2)}" style="mso-number-format:'0.00'">${(totalBani / 100).toFixed(2)}</th></tr>
  <tr><th colspan="3">Total inițial comenzi clienți</th><td x:num="${(grossBani / 100).toFixed(2)}" style="mso-number-format:'0.00'">${(grossBani / 100).toFixed(2)}</td></tr>
  <tr><th colspan="3">Reduceri acordate clienților (lei)</th><td x:num="${(discountBani / 100).toFixed(2)}" style="mso-number-format:'0.00'">${(discountBani / 100).toFixed(2)}</td></tr>
  <tr><th colspan="3">Total final clienți după reduceri</th><th x:num="${(netBani / 100).toFixed(2)}" style="mso-number-format:'0.00'">${(netBani / 100).toFixed(2)}</th></tr>
  <tr><td colspan="4">Reducerile sunt acordate clienților; nu modifică automat suma datorată furnizorului.</td></tr>
</table>
</body></html>`;

      const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lista-vanzator-${selectedRoundId || month}.xls`;
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
