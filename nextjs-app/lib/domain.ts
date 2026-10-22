import { z } from 'zod';
import {
  dataSchema,
  type AppData,
  type CollectionName,
  type Transaction,
  type Todo,
  type Change,
  type Entity,
} from './types';

export const ZONE = 'Asia/Ho_Chi_Minh';
export function businessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function addDays(date: string, days: number) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function shiftMonth(month: string, offset: number) {
  const d = new Date(month + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}
export function daysBetween(date: string, today = businessDate()) {
  return Math.round(
    (Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000,
  );
}
export const moneyText = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(value)) + 'đ';
export function shortMoney(n: number) {
  return Math.abs(n) >= 1e9
    ? (n / 1e9).toFixed(1) + 'tỷ'
    : Math.abs(n) >= 1e6
      ? (n / 1e6).toFixed(1) + 'tr'
      : Math.abs(n) >= 1e3
        ? (n / 1e3).toFixed(0) + 'k'
        : moneyText(n);
}
export function income(r: Transaction) {
  return Number(r.thu ?? (r.type === 'THU' ? r.amount : 0) ?? 0);
}
export function expense(r: Transaction) {
  return Number(r.chi ?? (r.type === 'CHI' ? r.amount : 0) ?? 0);
}
export function totals(records: Transaction[], month?: string) {
  const rows = month ? records.filter((r) => r.date.startsWith(month)) : records;
  const thu = rows.reduce((s, r) => s + income(r), 0),
    chi = rows.reduce((s, r) => s + expense(r), 0);
  return { thu, chi, net: thu - chi, count: rows.length };
}
export function isDone(t: Todo) {
  return t.done || t.status === 'done';
}
export function todayTasks(d: AppData, date = businessDate()) {
  return d.todos.filter((t) => !isDone(t) && t.dueDate === date);
}
export function overdueTasks(d: AppData, date = businessDate()) {
  return d.todos.filter((t) => !isDone(t) && t.dueDate && t.dueDate < date);
}
export function dueDebts(d: AppData, date = businessDate()) {
  return d.debts
    .filter((x) => x.amount > x.paid && x.dueDate >= date && x.dueDate <= addDays(date, 6))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
export function dueLabel(date: string, today = businessDate()) {
  if (!date) return 'Chưa có hạn';
  const days = daysBetween(date, today);
  return days < 0
    ? 'Quá hạn ' + -days + ' ngày'
    : days === 0
      ? 'Hôm nay'
      : days === 1
        ? 'Ngày mai'
        : 'Còn ' + days + ' ngày';
}
export function validateData(raw: unknown): AppData {
  const data = dataSchema.parse(raw);
  for (const records of Object.values(data)) {
    const ids = new Set<string>();
    for (const row of records) {
      if (ids.has(row.id)) throw new Error('ID trùng: ' + row.id);
      ids.add(row.id);
    }
  }
  return data;
}
export function errorText(error: unknown) {
  if (error instanceof z.ZodError) return error.issues.map((x) => x.message).join('. ');
  return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác';
}
export function applyChange(
  data: AppData,
  collection: CollectionName,
  id: string,
  value: Record<string, unknown> | null,
) {
  const before = data[collection].find((r) => r.id === id) ?? null;
  const rows = data[collection].filter((r) => r.id !== id);
  if (value)
    rows.unshift({
      ...value,
      id,
      createdAt: before?.createdAt ?? value.createdAt ?? new Date().toISOString(),
    } as Entity);
  const next = validateData({ ...data, [collection]: rows });
  return {
    data: next,
    change: {
      collection,
      id,
      before,
      after: next[collection].find((r) => r.id === id) ?? null,
      at: new Date().toISOString(),
    } satisfies Change,
  };
}
export function undoChange(data: AppData, change: Change) {
  const current = data[change.collection].find((r) => r.id === change.id) ?? null;
  if (JSON.stringify(current) !== JSON.stringify(change.after))
    throw new Error('Bản ghi đã thay đổi sau thao tác này; không thể hoàn tác an toàn.');
  const rows = data[change.collection].filter((r) => r.id !== change.id);
  if (change.before) rows.unshift(change.before);
  // Preserve the relative record order for display; identity/value is the undo contract.
  return validateData({ ...data, [change.collection]: rows });
}
export function materializeRecurring(data: AppData, date = businessDate()): AppData {
  const next = structuredClone(data);
  const n = new Date(date + 'T00:00:00Z');
  for (const r of next.recurringTasks) {
    const due =
      r.active &&
      ((r.type === 'monthly' && r.dayOfMonth === n.getUTCDate()) ||
        (r.type === 'weekly' && r.dayOfWeek === n.getUTCDay()) ||
        (r.type === 'yearly' &&
          r.dayOfMonth === n.getUTCDate() &&
          r.month === n.getUTCMonth() + 1));
    const id = `recur_${r.id}_${date}`;
    if (!due || next.recurringRuns.some((x) => x.id === id)) continue;
    if (!next.todos.some((t) => t.id === id))
      next.todos.unshift({
        id,
        text: r.taskText,
        mang: r.mang,
        dueDate: date,
        priority: r.priority,
        repeat: 'none',
        status: 'open',
        done: false,
        recurringTaskId: r.id,
        createdAt: date + 'T00:00:00Z',
      });
    next.recurringRuns.push({ id, recurringTaskId: r.id, date, createdAt: date + 'T00:00:00Z' });
  }
  return validateData(next);
}
export function setRentPaid(data: AppData, aptId: string, month: string) {
  const id = month.replace('-', '_') + '_' + aptId;
  const before = data.rentPayments.find(
    (p) => p.apartmentId === aptId && `${p.year}-${String(p.month).padStart(2, '0')}` === month,
  );
  return applyChange(data, 'rentPayments', before?.id ?? id, {
    id: before?.id ?? id,
    apartmentId: aptId,
    year: Number(month.slice(0, 4)),
    month: Number(month.slice(5)),
    paid: !before?.paid,
  }).data;
}
export function rentIsPaid(data: AppData, aptId: string, month: string) {
  return data.rentPayments.some(
    (p) =>
      p.apartmentId === aptId &&
      p.year === Number(month.slice(0, 4)) &&
      p.month === Number(month.slice(5)) &&
      p.paid,
  );
}
export function exportBackup(data: AppData, exportedBy = '') {
  return JSON.stringify(
    {
      appName: 'Business Hub',
      version: 3,
      exportedAt: new Date().toISOString(),
      exportedBy,
      data: validateData(data),
    },
    null,
    2,
  );
}
export function importBackup(text: string) {
  const raw = JSON.parse(text, (key, value) => {
    if (['__proto__', 'prototype', 'constructor'].includes(key))
      throw new Error('Tên trường không hợp lệ');
    return value;
  });
  const backup = z
    .object({
      appName: z.literal('Business Hub'),
      version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      data: z.record(z.string(), z.unknown()),
    })
    .parse(raw);
  return validateData(backup.data);
}
export function mergeBackup(current: AppData, incoming: AppData): AppData {
  const result = { ...current };
  for (const key of Object.keys(current) as CollectionName[]) {
    const rows = new Map<string, Entity>(current[key].map((r) => [r.id, r]));
    for (const row of incoming[key]) rows.set(row.id, row);
    Object.assign(result, { [key]: [...rows.values()] });
  }
  return validateData(result);
}
export function telegramReport(data: AppData, date = businessDate()): string[] {
  const d = materializeRecurring(data, date);
  const financial = totals(d.transactions, date.slice(0, 7));
  const debts = dueDebts(d, date);
  const tasks = (rows: Todo[]) =>
    rows.length
      ? rows
          .map(
            (t) => '• ' + t.text + (t.dueDate < date ? ' (' + dueLabel(t.dueDate, date) + ')' : ''),
          )
          .join('\n')
      : 'Không có.';
  const text = `[Business Hub] Báo cáo ngày ${date}\nLịch gửi: 07:00 (giờ Việt Nam)\n\n✅ Việc hôm nay (${todayTasks(d, date).length})\n${tasks(todayTasks(d, date))}\n\n⚠️ Việc quá hạn (${overdueTasks(d, date).length})\n${tasks(overdueTasks(d, date))}\n\n📋 Công nợ cần thu (${date} → ${addDays(date, 6)})\n${debts.length ? debts.map((x) => '• ' + x.name + ' | ' + x.dueDate + ' | ' + moneyText(x.amount - x.paid)).join('\n') : 'Không có.'}\nTổng cần thu: ${moneyText(debts.reduce((s, x) => s + x.amount - x.paid, 0))}\n\n💰 Tháng ${date.slice(0, 7)} — tính đến thời điểm lập báo cáo\nDoanh thu: ${moneyText(financial.thu)}\nChi phí: ${moneyText(financial.chi)}\nLợi nhuận: ${moneyText(financial.net)}`;
  const chunks: string[] = [];
  let chunk = '';
  for (const line of text.split('\n')) {
    // Slice by Unicode code points and leave room for numbering/headings.
    const points = Array.from(line);
    do {
      const part = points.splice(0, 1800).join('');
      if (chunk.length + part.length + 1 > 3900) {
        chunks.push(chunk);
        chunk = '';
      }
      chunk += (chunk ? '\n' : '') + part;
    } while (points.length);
  }
  if (chunk) chunks.push(chunk);
  return chunks.length > 1
    ? chunks.map((s, i) => `[Business Hub ${i + 1}/${chunks.length}]\n${s}`)
    : chunks;
}
export function searchData(data: AppData, query: string) {
  const q = query.trim().toLocaleLowerCase('vi');
  if (!q) return [];
  const routes = {
    deals: '/sale',
    transactions: '/accounting',
    debts: '/debts',
    todos: '/operations',
    followups: '/operations',
    apartments: '/operations',
  } as const;
  return (Object.keys(routes) as (keyof typeof routes)[])
    .flatMap((collection) =>
      data[collection]
        .filter((r) =>
          Object.values(r).some(
            (v) => typeof v === 'string' && v.toLocaleLowerCase('vi').includes(q),
          ),
        )
        .slice(0, 4)
        .map((r) => ({
          collection,
          id: r.id,
          title: String(
            ('ten' in r
              ? r.ten
              : 'name' in r
                ? r.name
                : 'text' in r
                  ? r.text
                  : 'address' in r
                    ? r.address
                    : r.desc) ?? '',
          ),
          route: routes[collection],
        })),
    )
    .slice(0, 20);
}
