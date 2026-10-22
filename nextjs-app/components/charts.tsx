'use client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { AREAS, type Transaction } from '@/lib/types';
import { shiftMonth, totals } from '@/lib/domain';
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);
ChartJS.defaults.font.family = "'Be Vietnam Pro', sans-serif";
export function CashChart({ transactions, month }: { transactions: Transaction[]; month: string }) {
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  return (
    <div className="chart-box" role="img" aria-label="Biểu đồ tổng thu và chi sáu tháng">
      <Bar
        data={{
          labels: months.map((m) => 'T' + Number(m.slice(5)) + '/' + m.slice(2, 4)),
          datasets: [
            {
              label: 'Thu (triệu đồng)',
              data: months.map((m) => totals(transactions, m).thu / 1e6),
              backgroundColor: 'rgba(16,185,129,.35)',
              borderColor: '#10B981',
              borderWidth: 1,
              borderRadius: 5,
            },
            {
              label: 'Chi (triệu đồng)',
              data: months.map((m) => totals(transactions, m).chi / 1e6),
              backgroundColor: 'rgba(239,68,68,.25)',
              borderColor: '#EF4444',
              borderWidth: 1,
              borderRadius: 5,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true } },
        }}
      />
    </div>
  );
}
export function AreaChart({ transactions, month }: { transactions: Transaction[]; month: string }) {
  const entries = Object.entries(AREAS).map(([key, a]) => ({
    label: a.short,
    color: a.color,
    value: totals(
      transactions.filter((t) => t.mang === key),
      month,
    ).thu,
  }));
  return (
    <div className="chart-box" role="img" aria-label="Biểu đồ tỷ trọng thu theo mảng">
      <Doughnut
        data={{
          labels: entries.map((e) => e.label),
          datasets: [
            {
              data: entries.map((e) => e.value),
              backgroundColor: entries.map((e) => e.color),
              borderWidth: 2,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
        }}
      />
    </div>
  );
}
