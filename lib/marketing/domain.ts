import { services, type Brand, type PlanItem } from './types';
export function businessDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function nextDay(day: string) {
  return new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
}
export function calendarSlots(month: string): PlanItem[] {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('marketing_month_invalid');
  const [y, m] = month.split('-').map(Number),
    days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return services.flatMap((service) =>
    Array.from({ length: 30 }, (_, i) => ({
      id: `${month}-${service}-${i + 1}`,
      date: `${month}-${String(Math.min(i + 1, days)).padStart(2, '0')}`,
      service,
      title: '',
      video: i % 2 === 0,
    })),
  );
}
export function initialBrand(): Brand {
  return {
    name: 'Đạt Nguyễn',
    contact: '',
    tone: 'Rõ ràng, gần gũi, thực tế.',
    description: '',
    approved: false,
    revision: 0,
  };
}
export function canApprove(b: {
  claims: { verified: boolean }[];
  imageId?: string | null;
  video: boolean;
  videoId?: string | null;
}) {
  return b.claims.every((x) => x.verified) && !!b.imageId && (!b.video || !!b.videoId);
}
type EditState = {
  revision: number;
  approvedRevision: number | null;
  scriptApprovedRevision: number | null;
  videoId: string | null;
};
export function editBundle<T extends EditState>(
  b: T,
  kind: 'caption' | 'script',
): Omit<T, keyof EditState> & EditState {
  return {
    ...b,
    revision: b.revision + 1,
    approvedRevision: null,
    ...(kind === 'script' ? { scriptApprovedRevision: null, videoId: null } : {}),
  };
}
export function canApplyCompletion({ expected, current }: { expected: number; current: number }) {
  return expected === current;
}
