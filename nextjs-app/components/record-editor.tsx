'use client';
import { useState, type FormEvent } from 'react';
import {
  AREAS,
  STAGES,
  COLLECTION_LABELS,
  type EditableCollection,
  type Entity,
} from '@/lib/types';
import { businessDate, errorText, income, expense, applyChange } from '@/lib/domain';
import { useHub } from './demo-provider';
import { Button, Modal } from './ui';

type Field = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'url';
  options?: Record<string, string>;
  required?: boolean;
  default?: string | number | boolean;
};
const area: Field = {
  name: 'mang',
  label: 'Mảng kinh doanh',
  type: 'select',
  options: Object.fromEntries(Object.entries(AREAS).map(([k, a]) => [k, a.label])),
  default: 'kh',
};
const priority: Field = {
  name: 'priority',
  label: 'Ưu tiên',
  type: 'select',
  options: { high: 'Cao', normal: 'Vừa', low: 'Thấp' },
  default: 'normal',
};
const fields: Record<EditableCollection, Field[]> = {
  deals: [
    { name: 'ten', label: 'Tên khách hàng', required: true },
    { name: 'phone', label: 'Số điện thoại' },
    area,
    { name: 'stage', label: 'Giai đoạn', type: 'select', options: STAGES, default: 'new' },
    {
      name: 'channel',
      label: 'Kênh',
      type: 'select',
      options: { zalo: 'Zalo', fb: 'Facebook', phone: 'Điện thoại', ref: 'Giới thiệu' },
      default: 'zalo',
    },
    { name: 'product', label: 'Sản phẩm quan tâm' },
    { name: 'value', label: 'Giá trị (đồng)', type: 'number', default: 0 },
    { name: 'nextdate', label: 'Ngày liên hệ tiếp', type: 'date', default: businessDate() },
    {
      name: 'priority',
      label: 'Độ ưu tiên',
      type: 'select',
      options: { hot: '🔥 Hot', warm: 'Bình thường', cold: 'Khách lạnh' },
      default: 'warm',
    },
    { name: 'note', label: 'Ghi chú', type: 'textarea' },
  ],
  transactions: [
    {
      name: 'date',
      label: 'Ngày giao dịch',
      type: 'date',
      required: true,
      default: businessDate(),
    },
    area,
    { name: 'thu', label: 'Thu (đồng)', type: 'number', default: 0 },
    { name: 'chi', label: 'Chi (đồng)', type: 'number', default: 0 },
    { name: 'desc', label: 'Mô tả giao dịch', type: 'textarea', required: true },
  ],
  debts: [
    { name: 'name', label: 'Tên khách hàng', required: true },
    area,
    { name: 'amount', label: 'Tổng nợ (đồng)', type: 'number', required: true },
    { name: 'paid', label: 'Đã thu (đồng)', type: 'number', default: 0 },
    { name: 'date', label: 'Ngày phát sinh', type: 'date', default: businessDate() },
    { name: 'dueDate', label: 'Hạn thanh toán', type: 'date' },
  ],
  todos: [
    { name: 'text', label: 'Nội dung công việc', required: true },
    area,
    { name: 'dueDate', label: 'Ngày đến hạn', type: 'date', default: businessDate() },
    priority,
    {
      name: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: { open: 'Chưa làm', doing: 'Đang làm', done: 'Hoàn thành' },
      default: 'open',
    },
    {
      name: 'repeat',
      label: 'Nhãn lặp',
      type: 'select',
      options: {
        none: 'Không lặp',
        daily: 'Hằng ngày',
        weekly: 'Hằng tuần',
        monthly: 'Hằng tháng',
      },
      default: 'none',
    },
  ],
  followups: [
    { name: 'name', label: 'Tên khách hàng', required: true },
    { name: 'phone', label: 'Số điện thoại' },
    area,
    {
      name: 'urgency',
      label: 'Mức độ',
      type: 'select',
      options: { urgent: '🔴 Gấp', today: '🟡 Hôm nay', normal: '⚪ Tuần này' },
      default: 'normal',
    },
    { name: 'note', label: 'Ghi chú', type: 'textarea' },
  ],
  apartments: [
    { name: 'address', label: 'Địa chỉ căn hộ', required: true },
    {
      name: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: { occupied: 'Đang thuê', finding: 'Tìm khách', empty: 'Đang trống' },
      default: 'empty',
    },
    { name: 'tenant', label: 'Khách thuê' },
    { name: 'phone', label: 'Số điện thoại' },
    { name: 'price', label: 'Giá thuê (đồng/tháng)', type: 'number', default: 0 },
    { name: 'deposit', label: 'Tiền cọc (đồng)', type: 'number', default: 0 },
    { name: 'startDate', label: 'Ngày bắt đầu', type: 'date' },
    { name: 'expire', label: 'Ngày hết hợp đồng', type: 'date' },
    { name: 'rooms', label: 'Số phòng ngủ', type: 'number' },
    { name: 'area', label: 'Diện tích (m²)' },
    { name: 'payDay', label: 'Ngày thu tiền hằng tháng (1–31)', type: 'number', default: 1 },
    { name: 'link', label: 'Liên kết hợp đồng', type: 'url' },
    { name: 'note', label: 'Ghi chú', type: 'textarea' },
  ],
  recurringTasks: [
    { name: 'taskText', label: 'Nội dung việc định kỳ', required: true },
    {
      name: 'type',
      label: 'Chu kỳ',
      type: 'select',
      options: { monthly: 'Hằng tháng', weekly: 'Hằng tuần', yearly: 'Hằng năm' },
      default: 'monthly',
    },
    { name: 'dayOfMonth', label: 'Ngày trong tháng', type: 'number', default: 1 },
    {
      name: 'dayOfWeek',
      label: 'Thứ trong tuần',
      type: 'select',
      options: {
        '0': 'Chủ nhật',
        '1': 'Thứ hai',
        '2': 'Thứ ba',
        '3': 'Thứ tư',
        '4': 'Thứ năm',
        '5': 'Thứ sáu',
        '6': 'Thứ bảy',
      },
      default: '1',
    },
    { name: 'month', label: 'Tháng trong năm', type: 'number', default: 1 },
    area,
    priority,
    { name: 'active', label: 'Bật lịch nhắc', type: 'checkbox', default: true },
  ],
};
export function RecordEditor({
  collection,
  record,
  onClose,
}: {
  collection: EditableCollection;
  record?: Entity | Record<string, unknown>;
  onClose: () => void;
}) {
  const hub = useHub();
  const [error, setError] = useState('');
  const [cycle, setCycle] = useState(String(record?.type ?? 'monthly'));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const raw: Record<string, unknown> = { ...record };
    for (const f of fields[collection])
      raw[f.name] =
        f.type === 'checkbox'
          ? form.has(f.name)
          : (form.get(f.name) ?? record?.[f.name] ?? f.default ?? '');
    if (collection === 'todos') raw.done = raw.status === 'done';
    try {
      applyChange(hub.data, collection, String(record?.id ?? 'validation-record'), raw);
      if (hub.save(collection, raw)) onClose();
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <Modal
      title={(record?.id ? 'Chỉnh sửa ' : 'Thêm ') + COLLECTION_LABELS[collection]}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="editor-grid">
          {fields[collection]
            .filter(
              (f) =>
                collection !== 'recurringTasks' ||
                ((f.name !== 'dayOfWeek' || cycle === 'weekly') &&
                  (f.name !== 'dayOfMonth' || cycle !== 'weekly') &&
                  (f.name !== 'month' || cycle === 'yearly')),
            )
            .map((f) => {
              let value =
                record?.[f.name] ??
                (f.type === 'date' && f.default ? businessDate() : f.default) ??
                '';
              if (collection === 'todos' && f.name === 'status' && record?.done === true)
                value = 'done';
              if (collection === 'transactions' && record) {
                if (f.name === 'thu') value = income(record as Parameters<typeof income>[0]);
                if (f.name === 'chi') value = expense(record as Parameters<typeof expense>[0]);
              }
              const fieldId = 'edit-' + f.name;
              return (
                <div key={f.name} className={f.type === 'textarea' ? 'field full' : 'field'}>
                  <label htmlFor={fieldId}>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      id={fieldId}
                      name={f.name}
                      defaultValue={String(value)}
                      onChange={(e) => {
                        if (f.name === 'type') setCycle(e.target.value);
                      }}
                    >
                      {Object.entries(f.options ?? {}).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      id={fieldId}
                      name={f.name}
                      defaultValue={String(value)}
                      rows={3}
                      required={f.required}
                    />
                  ) : f.type === 'checkbox' ? (
                    <input
                      id={fieldId}
                      name={f.name}
                      type="checkbox"
                      defaultChecked={Boolean(value)}
                    />
                  ) : (
                    <input
                      id={fieldId}
                      name={f.name}
                      type={f.type ?? 'text'}
                      defaultValue={String(value)}
                      required={f.required}
                      min={f.type === 'number' ? 0 : undefined}
                      step={f.type === 'number' ? 'any' : undefined}
                    />
                  )}
                </div>
              );
            })}
        </div>
        {collection === 'todos' && (
          <p className="muted">
            Nhãn lặp được giữ như bản hiện tại. Dùng “Nhắc việc định kỳ” để tự tạo công việc.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button secondary onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit">Lưu</Button>
        </div>
      </form>
    </Modal>
  );
}
