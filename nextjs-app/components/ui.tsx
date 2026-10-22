'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AREAS, COLLECTION_LABELS, type Area, type CollectionName } from '@/lib/types';
import { moneyText, shiftMonth } from '@/lib/domain';
import { useHub } from './demo-provider';

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = ref.current;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex="0"]') ??
          [],
      ).filter((el) => !el.hasAttribute('disabled'));
    (focusable()[0] ?? root)?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key === 'Tab') {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay show"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={'modal ' + (wide ? 'modal-wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={id} className="modal-title-text">
            {title}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            aria-label="Đóng hộp thoại"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export function Button({
  children,
  onClick,
  secondary = false,
  danger = false,
  disabled = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={'btn ' + (danger ? 'btn-danger' : secondary ? 'btn-secondary' : 'btn-primary')}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-title">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function KPIs({
  items,
}: {
  items: { label: string; value: ReactNode; sub?: ReactNode; color?: string }[];
}) {
  return (
    <div
      className="kpi-grid"
      style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)},minmax(0,1fr))` }}
    >
      {items.map((item) => (
        <div className="kpi-card" key={item.label}>
          <div className="kpi-label">{item.label}</div>
          <div className="kpi-val" style={{ color: item.color ?? 'var(--navy)' }}>
            {item.value}
          </div>
          {item.sub && <div className="kpi-sub">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}
export function AreaBadge({ area }: { area: Area }) {
  const a = AREAS[area];
  return (
    <span className="badge-sm" style={{ color: a.color, background: a.bg }}>
      {a.icon} {a.short}
    </span>
  );
}
export function AreaSelect({
  value,
  onChange,
  label = 'Mảng kinh doanh',
  all = true,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  all?: boolean;
}) {
  const id = useId();
  return (
    <label className="inline-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {all && <option value="all">Tất cả mảng</option>}
        {Object.entries(AREAS).map(([key, a]) => (
          <option value={key} key={key}>
            {a.icon} {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function MonthNav({ month, onChange }: { month: string; onChange: (v: string) => void }) {
  return (
    <div className="month-nav">
      <button aria-label="Tháng trước" onClick={() => onChange(shiftMonth(month, -1))}>
        ‹
      </button>
      <label>
        Tháng{' '}
        <input
          aria-label="Chọn tháng"
          type="month"
          value={month}
          onChange={(e) => {
            if (/^\d{4}-\d{2}$/.test(e.target.value)) onChange(e.target.value);
          }}
        />
      </label>
      <button aria-label="Tháng sau" onClick={() => onChange(shiftMonth(month, 1))}>
        ›
      </button>
    </div>
  );
}
export function Empty({ children = 'Chưa có dữ liệu phù hợp.' }: { children?: ReactNode }) {
  return <div className="empty-mini">{children}</div>;
}
export async function copyText(text: string, notify: (s: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    notify('Đã sao chép.');
  } catch {
    notify('Trình duyệt chưa cho phép sao chép. Bạn có thể chọn nội dung và copy thủ công.');
  }
}
export function DeleteConfirm({
  collection,
  id,
  title,
  onClose,
}: {
  collection: CollectionName;
  id: string;
  title: string;
  onClose: () => void;
}) {
  const hub = useHub();
  return (
    <Modal title={'Xóa ' + COLLECTION_LABELS[collection] + '?'} onClose={onClose}>
      <p>
        Bạn muốn xóa <strong>{title}</strong> khỏi dữ liệu mẫu?
      </p>
      <p className="muted">Có thể hoàn tác thao tác gần nhất trong phiên này.</p>
      <div className="modal-actions">
        <Button secondary onClick={onClose}>
          Hủy
        </Button>
        <Button
          danger
          onClick={() => {
            hub.remove(collection, id);
            onClose();
          }}
        >
          Xác nhận xóa
        </Button>
      </div>
    </Modal>
  );
}
export function Money({ value }: { value: number }) {
  return <span className={'money ' + (value < 0 ? 'negative' : '')}>{moneyText(value)}</span>;
}
