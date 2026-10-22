import { describe, expect, it } from 'vitest';
import { createDemoData } from '@/lib/demo';
import {
  businessDate,
  addDays,
  totals,
  todayTasks,
  overdueTasks,
  dueDebts,
  materializeRecurring,
  exportBackup,
  importBackup,
  mergeBackup,
  telegramReport,
  validateData,
  applyChange,
  undoChange,
  setRentPaid,
  rentIsPaid,
  searchData,
} from '@/lib/domain';
import { parseMockVoice } from '@/lib/mock-ai';

describe('dates and financial reporting', () => {
  it('keeps Vietnam date at midnight instead of truncating UTC', () => {
    expect(businessDate(new Date('2026-10-22T00:30:00+07:00'))).toBe('2026-10-22');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('sums current-month cash and legacy records, excluding other months', () => {
    const d = createDemoData('2026-10-22');
    d.transactions = [
      { id: 'a', date: '2026-10-01', mang: 'kh', desc: 'Legacy income', type: 'THU', amount: 100 },
      { id: 'b', date: '2026-10-22', mang: 'kh', desc: 'Expense', thu: 0, chi: 30 },
      { id: 'c', date: '2026-09-30', mang: 'kh', desc: 'Outside', thu: 999, chi: 0 },
    ];
    expect(totals(d.transactions, '2026-10')).toEqual({ thu: 100, chi: 30, net: 70, count: 2 });
  });
  it('rejects negative amounts and overpaid debts', () => {
    const d = createDemoData('2026-10-22');
    d.transactions[0].thu = -10;
    expect(() => validateData(d)).toThrow();
    const debt = createDemoData('2026-10-22');
    debt.debts[0].paid = debt.debts[0].amount + 1;
    expect(() => validateData(debt)).toThrow();
  });
});

describe('daily report boundaries', () => {
  it('excludes completed/undated tasks and separates today from overdue', () => {
    const d = createDemoData('2026-10-22');
    d.todos = [
      {
        id: 'a',
        text: 'Today',
        mang: 'kh',
        dueDate: '2026-10-22',
        priority: 'normal',
        status: 'open',
        done: false,
        repeat: 'none',
      },
      {
        id: 'b',
        text: 'Late',
        mang: 'kh',
        dueDate: '2026-10-21',
        priority: 'high',
        status: 'open',
        done: false,
        repeat: 'none',
      },
      {
        id: 'c',
        text: 'Done',
        mang: 'kh',
        dueDate: '2026-10-20',
        priority: 'normal',
        status: 'done',
        done: false,
        repeat: 'none',
      },
      {
        id: 'd',
        text: 'No date',
        mang: 'kh',
        dueDate: '',
        priority: 'normal',
        status: 'open',
        done: false,
        repeat: 'none',
      },
    ];
    expect(todayTasks(d, '2026-10-22').map((t) => t.id)).toEqual(['a']);
    expect(overdueTasks(d, '2026-10-22').map((t) => t.id)).toEqual(['b']);
  });
  it('includes today through day six; excludes day seven, overdue, and fully paid debts', () => {
    const d = createDemoData('2026-10-22');
    d.debts = ['2026-10-21', '2026-10-22', '2026-10-28', '2026-10-29'].map((dueDate, i) => ({
      id: String(i),
      name: 'Customer',
      mang: 'kh',
      amount: 100,
      paid: 20,
      date: '2026-10-01',
      dueDate,
    }));
    d.debts.push({
      id: 'paid',
      name: 'Paid',
      mang: 'kh',
      amount: 100,
      paid: 100,
      date: '2026-10-01',
      dueDate: '2026-10-22',
    });
    expect(dueDebts(d, '2026-10-22').map((x) => x.id)).toEqual(['1', '2']);
  });
  it('materializes recurrence before reporting and does not duplicate deleted generated tasks', () => {
    const d = createDemoData('2026-10-22');
    d.recurringTasks = [
      {
        id: 'monthly',
        taskText: 'Pay internet',
        type: 'monthly',
        dayOfMonth: 22,
        dayOfWeek: 0,
        month: 1,
        mang: 'kh',
        priority: 'normal',
        active: true,
      },
    ];
    const next = materializeRecurring(d, '2026-10-22');
    expect(next.todos.filter((t) => t.recurringTaskId === 'monthly')).toHaveLength(1);
    expect(materializeRecurring(next, '2026-10-22').todos).toHaveLength(next.todos.length);
    const removed = { ...next, todos: next.todos.filter((t) => t.recurringTaskId !== 'monthly') };
    expect(
      materializeRecurring(removed, '2026-10-22').todos.some(
        (t) => t.recurringTaskId === 'monthly',
      ),
    ).toBe(false);
    expect(telegramReport(d, '2026-10-22').join('\n')).toContain('Pay internet');
  });
  it('formats required report sections, date range and safe message chunks', () => {
    const d = createDemoData('2026-10-31');
    const report = telegramReport(d, '2026-10-31');
    const text = report.join('\n');
    for (const label of [
      '[Business Hub]',
      'Việc hôm nay',
      'Việc quá hạn',
      'Công nợ cần thu',
      '2026-11-06',
      'Doanh thu',
      'Chi phí',
      'Lợi nhuận',
    ])
      expect(text).toContain(label);
    d.todos = Array.from({ length: 130 }, (_, i) => ({
      ...d.todos[0],
      id: `long-${i}`,
      text: 'Nội dung dài '.repeat(30),
      dueDate: '2026-10-31',
      done: false,
      status: 'open',
    }));
    const chunks = telegramReport(d, '2026-10-31');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 4096)).toBe(true);
  });
});

describe('backup and undo', () => {
  it('round-trips all collections, timestamps and preserves unrelated IDs during merge', () => {
    const d = createDemoData('2026-10-22');
    d.deals[0].createdAt = { seconds: 10, nanoseconds: 20 };
    const imported = importBackup(exportBackup(d));
    expect(imported).toEqual(d);
    const subset = { ...d, deals: [{ ...d.deals[0], ten: 'Updated' }] };
    const merged = mergeBackup(d, subset);
    expect(merged.deals).toHaveLength(d.deals.length);
    expect(merged.deals[0].ten).toBe('Updated');
    expect(merged.deals[0].createdAt).toEqual({ seconds: 10, nanoseconds: 20 });
  });
  it('rejects invalid files entirely, accepts old backup collection subsets', () => {
    expect(() => importBackup('{bad')).toThrow();
    expect(() =>
      importBackup(JSON.stringify({ appName: 'Other', version: 3, data: {} })),
    ).toThrow();
    expect(() =>
      importBackup(
        JSON.stringify({
          appName: 'Business Hub',
          version: 3,
          data: { deals: [{ id: '../bad' }] },
        }),
      ),
    ).toThrow();
    expect(
      importBackup(JSON.stringify({ appName: 'Business Hub', version: 2, data: { todos: [] } }))
        .todos,
    ).toEqual([]);
  });
  it('validates mutations atomically and restores a deleted record with undo', () => {
    const d = createDemoData('2026-10-22');
    const id = d.deals[0].id;
    const changed = applyChange(d, 'deals', id, null);
    expect(changed.data.deals.some((x) => x.id === id)).toBe(false);
    expect(undoChange(changed.data, changed.change)).toEqual(d);
    expect(() =>
      applyChange(d, 'transactions', d.transactions[0].id, { ...d.transactions[0], thu: -1 }),
    ).toThrow();
    expect(d.deals[0].id).toBe(id);
  });
});

describe('additional compatibility boundaries', () => {
  it('keeps rent state independent across months and toggles existing legacy IDs', () => {
    const d = createDemoData('2026-01-22');
    d.rentPayments = [
      { id: '2026_1_apt-1', apartmentId: 'apt-1', year: 2026, month: 1, paid: true },
    ];
    const next = setRentPaid(d, 'apt-1', '2026-01');
    expect(rentIsPaid(next, 'apt-1', '2026-01')).toBe(false);
    expect(next.rentPayments).toHaveLength(1);
    expect(rentIsPaid(setRentPaid(next, 'apt-1', '2026-02'), 'apt-1', '2026-02')).toBe(true);
  });
  it('handles weekly/yearly schedules and ignores disabled and out-of-month occurrences', () => {
    const d = createDemoData('2026-10-22');
    d.recurringTasks = [
      {
        id: 'weekly',
        taskText: 'Weekly',
        type: 'weekly',
        dayOfWeek: 4,
        dayOfMonth: 1,
        month: 1,
        mang: 'kh',
        priority: 'normal',
        active: true,
      },
      {
        id: 'yearly',
        taskText: 'Yearly',
        type: 'yearly',
        dayOfWeek: 1,
        dayOfMonth: 22,
        month: 10,
        mang: 'kh',
        priority: 'normal',
        active: true,
      },
      {
        id: 'disabled',
        taskText: 'Off',
        type: 'monthly',
        dayOfWeek: 1,
        dayOfMonth: 22,
        month: 10,
        mang: 'kh',
        priority: 'normal',
        active: false,
      },
      {
        id: 'month31',
        taskText: 'Day31',
        type: 'monthly',
        dayOfWeek: 1,
        dayOfMonth: 31,
        month: 10,
        mang: 'kh',
        priority: 'normal',
        active: true,
      },
    ];
    const next = materializeRecurring(d, '2026-10-22');
    expect(next.recurringRuns.map((r) => r.recurringTaskId)).toEqual(['weekly', 'yearly']);
    expect(materializeRecurring(d, '2026-11-30').recurringRuns).toEqual([]);
  });
  it('blocks undo from overwriting a subsequent edit to the same record', () => {
    const d = createDemoData('2026-10-22');
    const first = applyChange(d, 'deals', d.deals[0].id, { ...d.deals[0], ten: 'First edit' });
    const second = applyChange(first.data, 'deals', d.deals[0].id, {
      ...first.data.deals[0],
      ten: 'Newer edit',
    });
    expect(() => undoChange(second.data, first.change)).toThrow(/đã thay đổi/);
  });
  it('rejects duplicate IDs and prototype keys in imported data', () => {
    const d = createDemoData('2026-10-22');
    d.deals.push({ ...d.deals[0] });
    expect(() => validateData(d)).toThrow(/ID trùng/);
    expect(() =>
      importBackup('{"appName":"Business Hub","version":3,"data":{"__proto__":{}}}'),
    ).toThrow(/Tên trường/);
  });
  it('parses mock voice units and resets both sides of the transaction', () => {
    expect(parseMockVoice('chi 1.5 triệu thuê căn hộ', '2026-10-22')).toMatchObject({
      thu: 0,
      chi: 1500000,
      mang: 'apt',
    });
    expect(parseMockVoice('thu 200 nghìn chữ ký số', '2026-10-22')).toMatchObject({
      thu: 200000,
      chi: 0,
      mang: 'cks',
    });
    expect(() => parseMockVoice('không có số')).toThrow();
  });
  it('searches the six active business collections without evaluating HTML-like queries', () => {
    const d = createDemoData('2026-10-22');
    expect(searchData(d, 'An Bình').some((r) => r.collection === 'deals')).toBe(true);
    expect(searchData(d, '<script>')).toEqual([]);
    expect(searchData(d, '')).toEqual([]);
  });
});
