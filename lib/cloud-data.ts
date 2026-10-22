import { COLLECTION_LABELS, dataSchema, type AppData, type CollectionName } from './types';

export const OWNER_EMAIL = 'aidatnq6@gmail.com';
export const COLLECTIONS = Object.keys(COLLECTION_LABELS) as CollectionName[];
export const emptyData = () => dataSchema.parse({});

// Only normalize the snapshot for display. No migration is written during reads.
export function cloudRecord<C extends CollectionName>(
  collection: C,
  id: string,
  value: Record<string, unknown>,
): AppData[C][number] {
  const row: Record<string, unknown> = { ...value, id };
  if (collection === 'apartments') {
    for (const key of ['price', 'deposit']) {
      const v = row[key];
      if (typeof v === 'string') {
        const text = v.trim();
        // Legacy forms accepted both raw numbers and Vietnamese grouped money.
        row[key] = /^\d{1,3}(\.\d{3})+(\s*đ)?$/.test(text)
          ? Number(text.replace(/[^0-9]/g, ''))
          : text;
      }
    }
    for (const key of [
      'payDay',
      'rooms',
      'area',
      'startDate',
      'expire',
      'link',
      'phone',
      'note',
      'tenant',
    ]) {
      if (row[key] == null || (key === 'payDay' && row[key] === '')) delete row[key];
    }
  }
  const parsed = dataSchema.shape[collection].safeParse([row]);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.slice(1).join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`${COLLECTION_LABELS[collection]} / ${id}: ${detail}`);
  }
  return parsed.data[0] as AppData[C][number];
}

export function sameRecord(a: unknown, b: unknown): boolean {
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, v]) => [key, canonical(v)]),
      );
    }
    return value;
  }
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function firebaseError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
    'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
    'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
    'auth/too-many-requests': 'Có quá nhiều lần thử. Vui lòng đợi rồi đăng nhập lại.',
    'auth/network-request-failed': 'Không kết nối được Firebase. Kiểm tra mạng và thử lại.',
    'auth/user-disabled': 'Tài khoản này đã bị vô hiệu hóa.',
    'auth/operation-not-allowed': 'Firebase chưa bật đăng nhập Email/Password.',
    'auth/unauthorized-domain':
      'Tên miền hiện tại chưa được cho phép trong Firebase Authentication.',
    'permission-denied':
      'Firebase từ chối quyền truy cập. Hãy đăng nhập đúng tài khoản chủ sở hữu và kiểm tra Firestore Rules.',
    unavailable: 'Mất kết nối Firestore. Vui lòng kiểm tra mạng và thử lại.',
    unauthenticated: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  };
  return messages[code] ?? (error instanceof Error ? error.message : 'Không thể kết nối Firebase.');
}
