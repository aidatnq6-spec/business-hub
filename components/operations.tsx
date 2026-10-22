'use client';
import { useState } from 'react';
import { useHub } from './hub-provider';
import { businessDate, addDays, dueLabel, isDone, moneyText, rentIsPaid } from '@/lib/domain';
import { COLLECTION_LABELS, type EditableCollection, type Entity, type Todo } from '@/lib/types';
import { AreaBadge, Button, DeleteConfirm, Empty, MonthNav, Section, Modal, copyText } from './ui';
import { RecordEditor } from './record-editor';
type Edit = { collection: EditableCollection; record?: Entity };
export function Operations() {
  const hub = useHub();
  const { data } = hub;
  const date = businessDate();
  const [editor, setEditor] = useState<Edit | null>(null);
  const [remove, setRemove] = useState<{
    collection: EditableCollection;
    record: Entity;
    title: string;
  } | null>(null);
  const [filter, setFilter] = useState('today');
  const [quick, setQuick] = useState('');
  const [month, setMonth] = useState(date.slice(0, 7));
  const [message, setMessage] = useState<string | null>(null);
  const todos = data.todos
    .filter(
      (t) =>
        filter === 'all' ||
        (filter === 'done' && isDone(t)) ||
        (filter === 'today' && !isDone(t) && t.dueDate === date) ||
        (filter === 'overdue' && !isDone(t) && !!t.dueDate && t.dueDate < date) ||
        (filter === 'week' &&
          !isDone(t) &&
          !!t.dueDate &&
          t.dueDate >= date &&
          t.dueDate <= addDays(date, 6)),
    )
    .sort(
      (a, b) =>
        Number(isDone(a)) - Number(isDone(b)) ||
        { high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority] ||
        a.dueDate.localeCompare(b.dueDate),
    );
  const apartments = [...data.apartments].sort(
    (a, b) =>
      ({ occupied: 0, finding: 1, empty: 2 })[a.status] -
      { occupied: 0, finding: 1, empty: 2 }[b.status],
  );
  const occupied = apartments
    .filter((a) => a.status === 'occupied' && a.price > 0)
    .sort((a, b) => a.payDay - b.payDay);
  const expected = occupied.reduce((s, a) => s + a.price, 0),
    paid = occupied.filter((a) => rentIsPaid(data, a.id, month)).reduce((s, a) => s + a.price, 0);
  function toggle(t: Todo) {
    hub.save('todos', { ...t, done: !isDone(t), status: isDone(t) ? 'open' : 'done' });
  }
  function askRemove(collection: EditableCollection, record: Entity, title: string) {
    setRemove({ collection, record, title });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>⚙️ Vận hành</h1>
          <p>Công việc, khách cần chăm sóc và quản lý căn hộ</p>
        </div>
        <Button onClick={() => setEditor({ collection: 'todos' })}>+ Thêm việc</Button>
      </div>
      <div className="two-columns">
        <div>
          <Section title="📅 Lịch thu tiền căn hộ">
            <MonthNav month={month} onChange={setMonth} />
            <div className="summary-line">
              <span>
                Dự kiến <strong>{moneyText(expected)}</strong>
              </span>
              <span className="positive">Đã thu {moneyText(paid)}</span>
            </div>
            {occupied.map((a) => (
              <div className="rent-row" key={a.id}>
                <input
                  type="checkbox"
                  aria-label={'Đã thu tiền thuê ' + a.address}
                  checked={rentIsPaid(data, a.id, month)}
                  disabled={hub.busy || hub.syncStatus !== 'live'}
                  onChange={() => hub.toggleRent(a.id, month)}
                />
                <div>
                  <strong>{a.address}</strong>
                  <small>
                    {a.tenant || 'Chưa có tên khách'} · ngày{' '}
                    {Math.min(
                      a.payDay,
                      new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate(),
                    )}
                    /{month.slice(5)}
                  </small>
                </div>
                <span className="money">{moneyText(a.price)}</span>
                <button
                  className="small-button"
                  aria-label={'Soạn nhắc tiền thuê ' + a.address}
                  onClick={() =>
                    setMessage(
                      `Chào ${a.tenant || 'anh/chị'}! Em nhắc tiền thuê ${a.address} tháng ${month}: ${moneyText(a.price)}. Mình tiện chuyển khoản giúp em nhé!`,
                    )
                  }
                >
                  📱
                </button>
              </div>
            ))}
            {!occupied.length && <Empty>Chưa có căn đang thuê.</Empty>}
            <p className="muted">
              Còn phải thu: <strong>{moneyText(expected - paid)}</strong>. Trạng thái được đồng bộ
              Firebase và lưu cùng backup.
            </p>
          </Section>
          <Section
            title="🔔 Nhắc việc định kỳ"
            action={
              <Button secondary onClick={() => setEditor({ collection: 'recurringTasks' })}>
                + Thêm lịch
              </Button>
            }
          >
            {data.recurringTasks.map((r) => (
              <div className="summary-line" key={r.id}>
                <div>
                  <strong>{r.taskText}</strong>
                  <p className="muted">
                    {r.type === 'monthly'
                      ? `Ngày ${r.dayOfMonth} hằng tháng`
                      : r.type === 'weekly'
                        ? `Thứ trong tuần: ${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][r.dayOfWeek]}`
                        : `Ngày ${r.dayOfMonth}/${r.month} hằng năm`}
                  </p>
                </div>
                <div className="row-actions">
                  <label className="inline-field">
                    <input
                      type="checkbox"
                      aria-label={'Bật ' + r.taskText}
                      checked={r.active}
                      onChange={(e) =>
                        hub.save('recurringTasks', { ...r, active: e.target.checked })
                      }
                    />{' '}
                    Bật
                  </label>
                  <button
                    aria-label={'Sửa lịch ' + r.taskText}
                    onClick={() => setEditor({ collection: 'recurringTasks', record: r })}
                  >
                    ✏️
                  </button>
                  <button
                    aria-label={'Xóa lịch ' + r.taskText}
                    onClick={() => askRemove('recurringTasks', r, r.taskText)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {!data.recurringTasks.length && <Empty>Thêm lịch để tự tạo công việc đến hạn.</Empty>}
            <div className="button-row">
              <Button secondary onClick={hub.runRecurring}>
                Kiểm tra việc đến hạn
              </Button>
            </div>
          </Section>
          <Section
            title={
              '✅ Việc cần làm · ' + data.todos.filter(isDone).length + '/' + data.todos.length
            }
            action={
              <button
                className="small-button"
                onClick={() =>
                  void copyText(
                    todos.map((t) => (isDone(t) ? '☑ ' : '☐ ') + t.text).join('\n'),
                    hub.notify,
                  )
                }
              >
                📋 Copy danh sách
              </button>
            }
          >
            <div className="filter-tabs">
              {Object.entries({
                today: 'Hôm nay',
                overdue: 'Quá hạn',
                week: '7 ngày tới',
                all: 'Tất cả',
                done: 'Đã xong',
              }).map(([key, label]) => (
                <button
                  key={key}
                  className={key === filter ? 'active' : ''}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <form
              className="form-inline"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await hub.save('todos', {
                    text: quick,
                    dueDate: date,
                    mang: 'kh',
                    priority: 'normal',
                    done: false,
                    status: 'open',
                    repeat: 'none',
                  })
                )
                  setQuick('');
              }}
            >
              <input
                aria-label="Thêm nhanh công việc"
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                placeholder="Thêm việc cần làm hôm nay…"
                required
              />
              <Button type="submit" disabled={hub.busy || hub.syncStatus !== 'live'}>
                + Thêm
              </Button>
            </form>
            {todos.map((t) => (
              <div className={'todo-line ' + (isDone(t) ? 'done' : '')} key={t.id}>
                <input
                  aria-label={'Hoàn thành ' + t.text}
                  type="checkbox"
                  checked={isDone(t)}
                  onChange={() => toggle(t)}
                />
                <div className="todo-content">
                  <strong>{t.text}</strong>
                  <small>
                    <span
                      className={
                        'status-pill ' +
                        (t.dueDate && t.dueDate < date && !isDone(t) ? 'danger' : '')
                      }
                    >
                      {dueLabel(t.dueDate, date)}
                    </span>
                    <AreaBadge area={t.mang} />
                    <span>Ưu tiên {{ high: 'Cao', normal: 'Vừa', low: 'Thấp' }[t.priority]}</span>
                  </small>
                </div>
                <div className="row-actions">
                  <button
                    aria-label={'Copy ' + t.text}
                    onClick={() => void copyText(t.text, hub.notify)}
                  >
                    📋
                  </button>
                  <button
                    aria-label={'Sửa việc ' + t.text}
                    onClick={() => setEditor({ collection: 'todos', record: t })}
                  >
                    ✏️
                  </button>
                  <button
                    aria-label={'Xóa việc ' + t.text}
                    onClick={() => askRemove('todos', t, t.text)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {!todos.length && <Empty>Không có việc phù hợp bộ lọc ✅</Empty>}
          </Section>
          <Section
            title="↩️ Undo / Nhật ký thay đổi"
            action={
              <Button secondary disabled={!hub.canUndo} onClick={hub.undo}>
                Hoàn tác gần nhất
              </Button>
            }
          >
            {hub.changes.slice(0, 8).map((c, i) => (
              <div className="summary-line" key={c.at + i}>
                <strong>
                  {c.after ? (c.before ? 'Sửa' : 'Thêm') : 'Xóa'} {COLLECTION_LABELS[c.collection]}
                </strong>
                <span className="muted">{new Date(c.at).toLocaleTimeString('vi-VN')}</span>
              </div>
            ))}
            {!hub.changes.length && <Empty>Chưa có thay đổi trong phiên này.</Empty>}
          </Section>
        </div>
        <div>
          <Section
            title="🔔 Khách cần Follow-up"
            action={
              <Button secondary onClick={() => setEditor({ collection: 'followups' })}>
                + Thêm
              </Button>
            }
          >
            {[...data.followups]
              .sort(
                (a, b) =>
                  ({ urgent: 0, today: 1, normal: 2 })[a.urgency] -
                  { urgent: 0, today: 1, normal: 2 }[b.urgency],
              )
              .map((f) => (
                <div className="summary-line" key={f.id}>
                  <div>
                    <strong>
                      {f.urgency === 'urgent' ? '🔴' : f.urgency === 'today' ? '🟡' : '⚪'} {f.name}
                    </strong>
                    <p className="muted">{f.note}</p>
                    <AreaBadge area={f.mang} />
                  </div>
                  <div className="row-actions">
                    <button
                      aria-label={'Sửa follow-up ' + f.name}
                      onClick={() => setEditor({ collection: 'followups', record: f })}
                    >
                      ✏️
                    </button>
                    <button
                      aria-label={'Hoàn tất follow-up ' + f.name}
                      onClick={() => askRemove('followups', f, f.name)}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ))}
            {!data.followups.length && <Empty>Không có khách cần follow.</Empty>}
          </Section>
          <Section
            title={'🏠 Quản lý căn hộ · ' + apartments.length + ' căn'}
            action={
              <Button secondary onClick={() => setEditor({ collection: 'apartments' })}>
                + Thêm căn
              </Button>
            }
          >
            {apartments.map((a) => (
              <article key={a.id} className="apt-card section">
                <div className="apt-header">
                  <div>
                    <h3>{a.address}</h3>
                    <span
                      className={'status-pill ' + (a.status === 'occupied' ? 'success' : 'warning')}
                    >
                      {
                        {
                          occupied: '🟢 Đang thuê',
                          finding: '🟡 Tìm khách',
                          empty: '🔴 Đang trống',
                        }[a.status]
                      }
                    </span>
                  </div>
                  <strong className="money">
                    {moneyText(a.price)}
                    <small>/tháng</small>
                  </strong>
                </div>
                <div className="apt-meta">
                  <div>
                    <span>Khách thuê</span>
                    <strong>{a.tenant || '—'}</strong>
                  </div>
                  <div>
                    <span>Số điện thoại</span>
                    <strong>{a.phone || '—'}</strong>
                  </div>
                  <div>
                    <span>Hết hợp đồng</span>
                    <strong>{a.expire || '—'}</strong>
                  </div>
                  <div>
                    <span>Tiền cọc</span>
                    <strong>{moneyText(a.deposit)}</strong>
                  </div>
                  <div>
                    <span>Diện tích / phòng ngủ</span>
                    <strong>
                      {a.area || '—'} m² · {a.rooms || '—'} PN
                    </strong>
                  </div>
                  <div>
                    <span>Ngày thu tiền</span>
                    <strong>{a.payDay}</strong>
                  </div>
                </div>
                {a.note && <p className="muted">{a.note}</p>}
                <div className="row-actions">
                  <button onClick={() => setEditor({ collection: 'apartments', record: a })}>
                    ✏️ Sửa HĐ
                  </button>
                  {a.link && (
                    <button onClick={() => setMessage('Liên kết hợp đồng: ' + a.link)}>
                      🔗 HĐ
                    </button>
                  )}
                  <button
                    aria-label={'Xóa căn ' + a.address}
                    onClick={() => askRemove('apartments', a, a.address)}
                  >
                    ✕
                  </button>
                </div>
              </article>
            ))}
            {!apartments.length && <Empty>Thêm căn hộ để quản lý hợp đồng và lịch thu tiền.</Empty>}
          </Section>
        </div>
      </div>
      {editor && (
        <RecordEditor
          collection={editor.collection}
          record={editor.record}
          onClose={() => setEditor(null)}
        />
      )}{' '}
      {remove && (
        <DeleteConfirm
          collection={remove.collection}
          id={remove.record.id}
          title={remove.title}
          onClose={() => setRemove(null)}
        />
      )}{' '}
      {message && (
        <Modal title="📱 Nội dung chuẩn bị" onClose={() => setMessage(null)}>
          <p className="demo-note">Bản thử nghiệm không mở hoặc gửi tin đến khách thật.</p>
          <pre className="text-preview">{message}</pre>
          <Button onClick={() => void copyText(message, hub.notify)}>📋 Copy nội dung</Button>
        </Modal>
      )}
    </>
  );
}
