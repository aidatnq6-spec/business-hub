'use client';
import { useHub } from './hub-provider';
import { Modal, KPIs, Section, Empty, Button } from './ui';
import { STAGES, type Deal } from '@/lib/types';
import { totals, moneyText } from '@/lib/domain';
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
export function CustomerDialog({
  deal,
  onClose,
  onEdit,
}: {
  deal: Deal;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { data } = useHub();
  const name = norm(deal.ten);
  const ds = data.deals.filter(
    (d) =>
      d.id === deal.id ||
      (name && norm(d.ten).includes(name)) ||
      (deal.phone && d.phone === deal.phone),
  );
  const tx = data.transactions.filter((t) => name && norm(t.desc).includes(name));
  const debts = data.debts.filter((d) => name && norm(d.name).includes(name));
  return (
    <Modal title={'Customer 360 — ' + deal.ten} onClose={onClose} wide>
      <p className="muted">
        {deal.phone || 'Chưa có số điện thoại'} · {deal.product}
      </p>
      <KPIs
        items={[
          { label: 'Deal', value: ds.length },
          {
            label: 'Đã chốt',
            value: moneyText(ds.filter((x) => x.stage === 'won').reduce((s, x) => s + x.value, 0)),
          },
          { label: 'Công nợ', value: moneyText(debts.reduce((s, d) => s + d.amount - d.paid, 0)) },
          { label: 'Thu/chi liên quan', value: moneyText(totals(tx).net) },
        ]}
      />
      <div className="two-columns">
        <Section title="Sale Pipeline">
          {ds.map((d) => (
            <p key={d.id}>
              <strong>{d.product || d.ten}</strong> · {STAGES[d.stage]}
            </p>
          ))}
        </Section>
        <Section title="Công nợ">
          {debts.length ? (
            debts.map((d) => (
              <p key={d.id}>
                Còn {moneyText(d.amount - d.paid)} · hạn {d.dueDate || 'chưa hẹn'}
              </p>
            ))
          ) : (
            <Empty>Không có công nợ liên quan.</Empty>
          )}
        </Section>
        <Section title="Giao dịch">
          {tx.length ? (
            tx.map((t) => (
              <p key={t.id}>
                {t.date} · {t.desc}
              </p>
            ))
          ) : (
            <Empty>Chưa tìm thấy giao dịch theo tên.</Empty>
          )}
        </Section>
        <Section title="Follow-up">
          {data.followups
            .filter((f) => norm(f.name).includes(name))
            .map((f) => (
              <p key={f.id}>{f.note}</p>
            ))}
        </Section>
      </div>
      <div className="modal-actions">
        <Button onClick={onEdit}>Chỉnh sửa deal</Button>
      </div>
    </Modal>
  );
}
