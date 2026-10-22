'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useHub } from './demo-provider';
import { businessDate, totals, moneyText, income, expense, shiftMonth } from '@/lib/domain';
import { AREAS, type Transaction } from '@/lib/types';
import { AreaBadge, AreaSelect, Button, DeleteConfirm, Empty, KPIs, MonthNav, Section } from './ui';
import { RecordEditor } from './record-editor';
import { VoiceInput } from './voice-input';
import { AIDialog } from './ai-dialog';
const CashChart = dynamic(() => import('./charts').then((m) => m.CashChart), {
  ssr: false,
  loading: () => <p>Đang tải biểu đồ…</p>,
});
const AreaChart = dynamic(() => import('./charts').then((m) => m.AreaChart), {
  ssr: false,
  loading: () => <p>Đang tải biểu đồ…</p>,
});
export function Accounting() {
  const { data } = useHub();
  const [month, setMonth] = useState(businessDate().slice(0, 7));
  const [area, setArea] = useState('all');
  const [editor, setEditor] = useState<Record<string, unknown> | null>(null);
  const [remove, setRemove] = useState<Transaction | null>(null);
  const [ai, setAI] = useState<'accounting' | 'forecast' | null>(null);
  const byArea = data.transactions.filter((t) => area === 'all' || t.mang === area);
  const rows = byArea
    .filter((t) => t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = totals(rows);
  const historical = [1, 2, 3].map((n) =>
    totals(data.transactions, shiftMonth(businessDate().slice(0, 7), -n)),
  );
  const avgThu = historical.reduce((s, t) => s + t.thu, 0) / 3,
    avgChi = historical.reduce((s, t) => s + t.chi, 0) / 3;
  const fixed = data.apartments
    .filter((a) => a.status === 'occupied')
    .reduce((s, a) => s + a.price, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>💰 Kế toán</h1>
          <p>Sổ thu chi và dòng tiền theo mảng kinh doanh</p>
        </div>
        <Button onClick={() => setEditor({ date: businessDate(), thu: 0, chi: 0 })}>
          + Thêm giao dịch
        </Button>
      </div>
      <div className="toolbar">
        <MonthNav month={month} onChange={setMonth} />
        <AreaSelect value={area} onChange={setArea} />
        <Button secondary onClick={() => setMonth(businessDate().slice(0, 7))}>
          Tháng hiện tại
        </Button>
      </div>
      <KPIs
        items={[
          { label: 'Tổng thu', value: moneyText(total.thu), color: '#15803D' },
          { label: 'Tổng chi', value: moneyText(total.chi), color: '#B91C1C' },
          {
            label: 'Lợi nhuận',
            value: moneyText(total.net),
            color: total.net >= 0 ? '#15803D' : '#B91C1C',
          },
          { label: 'Số giao dịch', value: total.count },
        ]}
      />
      <VoiceInput onParsed={setEditor} />
      <div className="two-columns">
        <Section title="📊 Thu / Chi 6 tháng">
          <CashChart transactions={byArea} month={month} />
        </Section>
        <Section title="Tỷ trọng thu theo mảng">
          <AreaChart transactions={data.transactions} month={month} />
        </Section>
      </div>
      <Section
        title="🧾 Sổ giao dịch"
        action={
          <div className="button-row">
            <Button secondary onClick={() => setEditor({ date: businessDate(), thu: 0, chi: 0 })}>
              + Thu nhanh
            </Button>
            <Button secondary onClick={() => setEditor({ date: businessDate(), thu: 0, chi: 0 })}>
              − Chi nhanh
            </Button>
          </div>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Mảng</th>
                <th>Mô tả</th>
                <th className="r">Thu</th>
                <th className="r">Chi</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>
                    <AreaBadge area={r.mang} />
                  </td>
                  <td>{r.desc}</td>
                  <td className="r positive money">{income(r) ? moneyText(income(r)) : '—'}</td>
                  <td className="r negative money">{expense(r) ? moneyText(expense(r)) : '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button aria-label={'Sửa ' + r.desc} onClick={() => setEditor(r)}>
                        ✏️
                      </button>
                      {income(r) > 0 && (
                        <button
                          onClick={() =>
                            setEditor({
                              date: businessDate(),
                              mang: r.mang,
                              thu: 0,
                              chi: income(r),
                              desc: 'Chi ứng — ' + r.desc,
                            })
                          }
                        >
                          Chi ứng
                        </button>
                      )}
                      <button aria-label={'Xóa ' + r.desc} onClick={() => setRemove(r)}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3}>Tổng cộng</th>
                <th className="r money positive">{moneyText(total.thu)}</th>
                <th className="r money negative">{moneyText(total.chi)}</th>
                <th />
              </tr>
            </tfoot>
          </table>
          {!rows.length && (
            <Empty>Chưa có giao dịch trong tháng/mảng này. Bấm “Thêm giao dịch” để bắt đầu.</Empty>
          )}
        </div>
      </Section>
      <div className="button-row no-print">
        <Button secondary onClick={() => setAI('accounting')}>
          🤖 AI Phân tích kế toán
        </Button>
        <Button secondary onClick={() => setAI('forecast')}>
          📈 AI Dự báo tháng tới
        </Button>
      </div>
      <Section title="📈 Dự báo dòng tiền 3 tháng tới">
        <p className="muted">
          Công thức tham khảo của bản hiện tại: thu dự kiến = lớn hơn giữa tiền thuê cố định và 85%
          thu trung bình 3 tháng trước; chi = trung bình chi.
        </p>
        <div className="three-columns">
          {[1, 2, 3].map((n) => (
            <div key={n} className="kpi-card">
              <h3>Tháng {shiftMonth(businessDate().slice(0, 7), n)}</h3>
              <p>
                Thu: <strong>{moneyText(Math.max(fixed, avgThu * 0.85))}</strong>
              </p>
              <p>Chi: {moneyText(avgChi)}</p>
              <p>Lợi nhuận: {moneyText(Math.max(fixed, avgThu * 0.85) - avgChi)}</p>
            </div>
          ))}
        </div>
      </Section>
      {editor && (
        <RecordEditor collection="transactions" record={editor} onClose={() => setEditor(null)} />
      )}{' '}
      {remove && (
        <DeleteConfirm
          collection="transactions"
          id={remove.id}
          title={remove.desc}
          onClose={() => setRemove(null)}
        />
      )}{' '}
      {ai && <AIDialog kind={ai} onClose={() => setAI(null)} />}
      <p className="muted">
        {Object.values(AREAS)
          .map((a) => a.short)
          .join(' · ')}
      </p>
    </>
  );
}
