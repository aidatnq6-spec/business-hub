'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useHub } from './demo-provider';
import { businessDate, income, expense, moneyText, shiftMonth, totals } from '@/lib/domain';
import { AREAS } from '@/lib/types';
import { AreaBadge, Button, KPIs, MonthNav, Section, Empty } from './ui';
import { TelegramPreview } from './telegram-preview';
const CashChart = dynamic(() => import('./charts').then((m) => m.CashChart), { ssr: false });
export function Reports() {
  const { data } = useHub();
  const [month, setMonth] = useState(businessDate().slice(0, 7));
  const [telegram, setTelegram] = useState(false);
  const t = totals(data.transactions, month),
    prev = totals(data.transactions, shiftMonth(month, -1));
  const growth = prev.net ? ((t.net - prev.net) / Math.abs(prev.net)) * 100 : null;
  return (
    <div id="page-baocao">
      <div className="page-heading">
        <div>
          <h1>📊 Báo cáo tháng</h1>
          <p>Kỳ báo cáo {month}</p>
        </div>
        <div className="button-row no-print">
          <Button secondary onClick={() => window.print()}>
            🖨️ In báo cáo / PDF
          </Button>
          <Button onClick={() => setTelegram(true)}>📨 Xem báo cáo Telegram</Button>
        </div>
      </div>
      <div className="toolbar">
        <MonthNav month={month} onChange={setMonth} />
        <Button secondary onClick={() => setMonth(businessDate().slice(0, 7))}>
          Tháng hiện tại
        </Button>
      </div>
      <KPIs
        items={[
          { label: 'Doanh thu', value: moneyText(t.thu), color: '#15803D' },
          { label: 'Chi phí', value: moneyText(t.chi), color: '#B91C1C' },
          {
            label: 'Lợi nhuận',
            value: moneyText(t.net),
            sub:
              growth === null
                ? 'Chưa có cơ sở so sánh'
                : `${growth >= 0 ? '↑' : '↓'} ${Math.abs(growth).toFixed(1)}% so với tháng trước`,
            color: t.net >= 0 ? '#15803D' : '#B91C1C',
          },
          {
            label: 'Tỷ suất lợi nhuận',
            value: (t.thu ? (t.net / t.thu) * 100 : 0).toFixed(1) + '%',
            sub: t.count + ' giao dịch',
          },
        ]}
      />
      <div className="two-columns">
        <Section title="Thu / Chi 6 tháng">
          <CashChart transactions={data.transactions} month={month} />
        </Section>
        <Section title="Cơ cấu theo mảng">
          <div className="table-scroll">
            <table className="metric-table">
              <thead>
                <tr>
                  <th>Mảng</th>
                  <th className="r">Thu</th>
                  <th className="r">Chi</th>
                  <th className="r">Lợi nhuận</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(AREAS).map(([key]) => {
                  const n = totals(
                    data.transactions.filter((r) => r.mang === key),
                    month,
                  );
                  return (
                    <tr key={key}>
                      <td>
                        <AreaBadge area={key as keyof typeof AREAS} />
                      </td>
                      <td className="r money positive">{moneyText(n.thu)}</td>
                      <td className="r money negative">{moneyText(n.chi)}</td>
                      <td className="r money">{moneyText(n.net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
      <Section title="Top 5 giao dịch lớn nhất">
        {data.transactions
          .filter((r) => r.date.startsWith(month))
          .sort((a, b) => income(b) + expense(b) - income(a) - expense(a))
          .slice(0, 5)
          .map((r) => (
            <div className="summary-line" key={r.id}>
              <div>
                <strong>{r.desc}</strong>
                <p className="muted">
                  {r.date} · {AREAS[r.mang].label}
                </p>
              </div>
              <div className="money">
                <div className="positive">+{moneyText(income(r))}</div>
                <div className="negative">−{moneyText(expense(r))}</div>
              </div>
            </div>
          ))}
        {!t.count && <Empty>Chưa có giao dịch trong kỳ.</Empty>}
      </Section>
      <div className="two-columns">
        <Section title="📈 Hiệu suất Sale — toàn bộ pipeline">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mảng</th>
                  <th>Tổng</th>
                  <th>Đã chốt</th>
                  <th>Tỷ lệ chốt</th>
                  <th className="r">Giá trị chốt</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(AREAS).map(([key, a]) => {
                  const deals = data.deals.filter((d) => d.mang === key),
                    won = deals.filter((d) => d.stage === 'won');
                  return (
                    <tr key={key}>
                      <td>
                        {a.icon} {a.short}
                      </td>
                      <td>{deals.length}</td>
                      <td>{won.length}</td>
                      <td>{deals.length ? Math.round((won.length / deals.length) * 100) : 0}%</td>
                      <td className="r money">{moneyText(won.reduce((s, d) => s + d.value, 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="Pipeline và công nợ hiện tại">
          <p>
            Đã chốt: <strong>{data.deals.filter((d) => d.stage === 'won').length} deal</strong>
          </p>
          <p>
            Đang chạy:{' '}
            <strong>
              {data.deals.filter((d) => !['won', 'lost'].includes(d.stage)).length} deal
            </strong>
          </p>
          <p>
            Công nợ còn lại:{' '}
            <strong>
              {moneyText(data.debts.reduce((s, d) => s + Math.max(d.amount - d.paid, 0), 0))}
            </strong>
          </p>
          <p className="muted">
            Các chỉ số pipeline/công nợ là trạng thái hiện tại; thu chi được lọc theo tháng ở trên.
          </p>
        </Section>
      </div>
      {telegram && <TelegramPreview onClose={() => setTelegram(false)} />}
    </div>
  );
}
