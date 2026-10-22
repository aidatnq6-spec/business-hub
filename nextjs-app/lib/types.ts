import { z } from 'zod';

export const AREAS = {
  cks: { label: 'Chữ Ký Số', short: 'CKS', icon: '🔑', color: '#2563EB', bg: '#EBF2FD' },
  hd: { label: 'Hóa Đơn ĐT', short: 'HĐ ĐT', icon: '🧾', color: '#0D9488', bg: '#ECFDF5' },
  apt: { label: 'Căn Hộ', short: 'Căn hộ', icon: '🏠', color: '#15803D', bg: '#F0FDF4' },
  ck: { label: 'Môi Giới CK', short: 'CK', icon: '📈', color: '#7C3AED', bg: '#F5F3FF' },
  kh: { label: 'Khác', short: 'Khác', icon: '📦', color: '#D97706', bg: '#FFFBEB' },
} as const;
export const STAGES = {
  new: 'Mới',
  contact: 'Liên hệ',
  nego: 'Thương lượng',
  won: 'Đã chốt',
  lost: 'Không chốt',
} as const;
export const COLLECTION_LABELS = {
  deals: 'Khách/deal',
  transactions: 'Giao dịch',
  debts: 'Công nợ',
  todos: 'Việc cần làm',
  followups: 'Follow-up',
  apartments: 'Căn hộ',
  recurringTasks: 'Nhắc định kỳ',
  rentPayments: 'Thu tiền thuê',
  recurringRuns: 'Lịch sử tạo việc',
  cksCustomers: 'Khách CKS',
  itCustomErrors: 'IT tùy chỉnh',
} as const;
export type Area = keyof typeof AREAS;
export type Stage = keyof typeof STAGES;
export const isoDateSchema = z
  .string()
  .refine(
    (s) =>
      !s ||
      (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
        !Number.isNaN(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s),
    'Ngày không hợp lệ',
  );
const requiredDate = isoDateSchema.refine(Boolean, 'Chọn ngày');
const money = z.coerce
  .number()
  .finite()
  .min(0, 'Số tiền không được âm')
  .max(Number.MAX_SAFE_INTEGER, 'Số tiền quá lớn');
const id = z.string().regex(/^[A-Za-z0-9_-]{1,500}$/, 'ID không hợp lệ');
const area = z.enum(['cks', 'hd', 'apt', 'ck', 'kh']).default('kh');
const timestamp = z.union([z.string(), z.object({ seconds: z.number(), nanoseconds: z.number() })]);
const base = { id, createdAt: timestamp.optional() };
const priority = z.enum(['high', 'normal', 'low']).default('normal');
export const dealSchema = z.looseObject({
  ...base,
  ten: z.string().trim().min(1, 'Nhập tên khách'),
  phone: z.string().default(''),
  mang: area,
  stage: z.enum(['new', 'contact', 'nego', 'won', 'lost']).default('new'),
  channel: z.enum(['zalo', 'fb', 'phone', 'ref']).default('zalo'),
  product: z.string().default(''),
  value: money.default(0),
  note: z.string().default(''),
  nextdate: isoDateSchema.default(''),
  priority: z.enum(['hot', 'warm', 'cold']).default('warm'),
});
export const transactionSchema = z
  .looseObject({
    ...base,
    date: requiredDate,
    mang: area,
    desc: z.string().trim().min(1, 'Nhập mô tả'),
    thu: money.optional(),
    chi: money.optional(),
    type: z.enum(['THU', 'CHI']).optional(),
    amount: money.optional(),
  })
  .refine(
    (r) =>
      (r.thu ?? (r.type === 'THU' ? r.amount : 0) ?? 0) > 0 ||
      (r.chi ?? (r.type === 'CHI' ? r.amount : 0) ?? 0) > 0,
    'Nhập ít nhất một khoản thu hoặc chi lớn hơn 0',
  );
export const debtSchema = z
  .looseObject({
    ...base,
    name: z.string().trim().min(1, 'Nhập tên khách'),
    mang: area,
    amount: money.refine((n) => n > 0, 'Số nợ phải lớn hơn 0'),
    paid: money.default(0),
    date: isoDateSchema.default(''),
    dueDate: isoDateSchema.default(''),
  })
  .refine((d) => d.paid <= d.amount, 'Số đã thu không được lớn hơn tổng nợ');
export const todoSchema = z.looseObject({
  ...base,
  text: z.string().trim().min(1, 'Nhập công việc'),
  mang: area,
  dueDate: isoDateSchema.default(''),
  priority,
  repeat: z.string().default('none'),
  status: z.enum(['open', 'doing', 'done']).default('open'),
  done: z.boolean().default(false),
  recurringTaskId: z.string().optional(),
});
export const followupSchema = z.looseObject({
  ...base,
  name: z.string().trim().min(1, 'Nhập tên khách'),
  phone: z.string().default(''),
  mang: area,
  note: z.string().default(''),
  urgency: z.enum(['urgent', 'today', 'normal']).default('normal'),
});
const rentMoney = z.preprocess((v) => (v === '' || v == null ? 0 : v), money);
export const apartmentSchema = z.looseObject({
  ...base,
  address: z.string().trim().min(1, 'Nhập địa chỉ'),
  status: z.enum(['occupied', 'finding', 'empty']).default('empty'),
  tenant: z.string().default(''),
  phone: z.string().default(''),
  price: rentMoney.default(0),
  deposit: rentMoney.default(0),
  startDate: isoDateSchema.default(''),
  expire: isoDateSchema.default(''),
  rooms: z.coerce.string().default(''),
  area: z.coerce.string().default(''),
  payDay: z.coerce.number().int().min(1).max(31).default(1),
  link: z
    .string()
    .default('')
    .refine(
      (s) => !s || /^https?:\/\//i.test(s),
      'Link hợp đồng phải bắt đầu bằng http:// hoặc https://',
    ),
  note: z.string().default(''),
});
export const recurringSchema = z.looseObject({
  ...base,
  taskText: z.string().trim().min(1, 'Nhập nội dung việc'),
  type: z.enum(['monthly', 'weekly', 'yearly']),
  dayOfMonth: z.coerce.number().int().min(1).max(31).default(1),
  dayOfWeek: z.coerce.number().int().min(0).max(6).default(1),
  month: z.coerce.number().int().min(1).max(12).default(1),
  mang: area,
  priority,
  active: z.boolean().default(true),
});
export const rentPaymentSchema = z.looseObject({
  ...base,
  apartmentId: id,
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1900).max(9999),
  paid: z.boolean(),
});
export const recurringRunSchema = z.looseObject({
  ...base,
  recurringTaskId: id,
  date: requiredDate,
});
const legacy = z.looseObject({ ...base });
export const dataSchema = z
  .object({
    deals: z.array(dealSchema).default([]),
    transactions: z.array(transactionSchema).default([]),
    debts: z.array(debtSchema).default([]),
    todos: z.array(todoSchema).default([]),
    followups: z.array(followupSchema).default([]),
    apartments: z.array(apartmentSchema).default([]),
    recurringTasks: z.array(recurringSchema).default([]),
    rentPayments: z.array(rentPaymentSchema).default([]),
    recurringRuns: z.array(recurringRunSchema).default([]),
    cksCustomers: z.array(legacy).default([]),
    itCustomErrors: z.array(legacy).default([]),
  })
  .strict();
export type AppData = z.infer<typeof dataSchema>;
export type CollectionName = keyof AppData;
export type Deal = AppData['deals'][number];
export type Transaction = AppData['transactions'][number];
export type Debt = AppData['debts'][number];
export type Todo = AppData['todos'][number];
export type Apartment = AppData['apartments'][number];
export type RecurringTask = AppData['recurringTasks'][number];
export type Entity = AppData[CollectionName][number];
export type EditableCollection = Exclude<
  CollectionName,
  'recurringRuns' | 'rentPayments' | 'cksCustomers' | 'itCustomErrors'
>;
export interface Change {
  collection: CollectionName;
  id: string;
  before: Entity | null;
  after: Entity | null;
  at: string;
}
