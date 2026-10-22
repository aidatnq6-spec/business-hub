'use client';
import { useState } from 'react';
import { useHub } from './demo-provider';
import { businessDate, dueLabel, moneyText, dueDebts } from '@/lib/domain';
import { type Debt } from '@/lib/types';
import { AreaBadge, AreaSelect, Button, DeleteConfirm, Empty, KPIs, Section } from './ui';
import { RecordEditor } from './record-editor';
export function Debts() {
  const hub = useHub();
  const { data } = hub;
  const [editor, setEditor] = useState<Debt | true | null>(null);
  const [remove, setRemove] = useState<Debt | null>(null);
  const [filter, setFilter] = useState('all');
  const [area, setArea] = useState('all');
  const date = businessDate();
  const rows = (filter === 'week' ? dueDebts(data, date) : data.debts).filter(
    (d) =>
      (area === 'all' || d.mang === area) &&
      (filter !== 'overdue' || (d.amount > d.paid && d.dueDate && d.dueDate < date)) &&
      (filter !== 'open' || d.amount > d.paid) &&
      (filter !== 'paid' || d.amount <= d.paid),
  );
  const amount = rows.reduce((s, d) => s + d.amount, 0),
    paid = rows.reduce((s, d) => s + d.paid, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>📋 Công nợ</h1>
          <p>Theo dõi khoản phải thu, đã thu và hạn thanh toán</p>
        </div>
        <Button onClick={() => setEditor(true)}>+ Thêm công nợ</Button>
      </div>
      <KPIs
        items={[
          { label: 'Tổng nợ', value: moneyText(amount) },
          { label: 'Đã thu', value: moneyText(paid), color: '#15803D' },
          { label: 'Còn phải thu', value: moneyText(amount - paid), color: '#B91C1C' },
        ]}
      />
      <div className="toolbar">
        <AreaSelect value={area} onChange={setArea} />
        <label className="inline-field">
          <span>Lọc trạng thái</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="open">Còn nợ</option>
            <option value="overdue">Quá hạn</option>
            <option value="week">Đến hạn trong 7 ngày</option>
            <option value="paid">Đã thu đủ</option>
          </select>
        </label>
      </div>
      <Section title="Danh sách công nợ">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Mảng</th>
                <th className="r">Tổng nợ</th>
                <th className="r">Đã thu</th>
                <th className="r">Còn lại</th>
                <th>Hạn thanh toán</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.name}</strong>
                  </td>
                  <td>
                    <AreaBadge area={d.mang} />
                  </td>
                  <td className="r money">{moneyText(d.amount)}</td>
                  <td className="r">
                    <input
                      aria-label={'Đã thu của ' + d.name}
                      className="paid-input"
                      type="number"
                      min={0}
                      max={d.amount}
                      defaultValue={d.paid}
                      key={String(d.paid)}
                      onBlur={(e) => {
                        const paid = Number(e.target.value);
                        if (paid !== d.paid && !hub.save('debts', { ...d, paid }))
                          e.target.value = String(d.paid);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                    />
                  </td>
                  <td className="r money negative">{moneyText(d.amount - d.paid)}</td>
                  <td>{d.dueDate || '—'}</td>
                  <td>
                    <span
                      className={
                        'status-pill ' +
                        (d.amount <= d.paid
                          ? 'success'
                          : d.dueDate && d.dueDate < date
                            ? 'danger'
                            : 'warning')
                      }
                    >
                      {d.amount <= d.paid ? '✅ Đã thu' : dueLabel(d.dueDate, date)}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button aria-label={'Sửa công nợ ' + d.name} onClick={() => setEditor(d)}>
                        ✏️
                      </button>
                      <button aria-label={'Xóa công nợ ' + d.name} onClick={() => setRemove(d)}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty>Không có công nợ phù hợp bộ lọc.</Empty>}
        </div>
      </Section>
      {editor && (
        <RecordEditor
          collection="debts"
          record={editor === true ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}{' '}
      {remove && (
        <DeleteConfirm
          collection="debts"
          id={remove.id}
          title={remove.name}
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}
