import { describe, expect, it } from 'vitest';
import {
  calendarSlots,
  businessDay,
  nextDay,
  canApprove,
  editBundle,
  initialBrand,
} from '@/lib/marketing/domain';
import { reserveAmount } from '@/lib/marketing/pricing';

describe('marketing invariants', () => {
  it.each(['2026-02', '2028-02', '2026-04', '2026-10'])(
    'allocates exactly 90 topics and 45 videos in %s',
    (month) => {
      const slots = calendarSlots(month);
      expect(slots).toHaveLength(90);
      expect(slots.filter((x) => x.video)).toHaveLength(45);
      expect(slots.every((x) => x.date.startsWith(month))).toBe(true);
      expect(new Set(slots.map((x) => x.id)).size).toBe(90);
    },
  );
  it('uses Vietnam dates at UTC midnight boundaries', () => {
    expect(businessDay(new Date('2026-10-21T18:00:00Z'))).toBe('2026-10-22');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
  it('does not invent commercial claims in the initial brand', () => {
    expect(initialBrand().name).toBe('Đạt Nguyễn');
    expect(initialBrand().approved).toBe(false);
    expect(initialBrand().contact).toBe('');
  });
  it('blocks incomplete final approval', () => {
    expect(canApprove({ claims: [{ verified: false }], imageId: 'img', video: false })).toBe(false);
    expect(canApprove({ claims: [], imageId: 'img', video: true })).toBe(false);
    expect(canApprove({ claims: [], imageId: 'img', video: false })).toBe(true);
  });
  it('editing captions invalidates final approval without invalidating rendered video', () => {
    const result = editBundle(
      { revision: 2, approvedRevision: 2, scriptApprovedRevision: 1, videoId: 'video' },
      'caption',
    );
    expect(result.revision).toBe(3);
    expect(result.approvedRevision).toBeNull();
    expect(result.videoId).toBe('video');
    expect(result.scriptApprovedRevision).toBe(1);
    expect(editBundle(result, 'script').videoId).toBeNull();
  });
  it('includes all pending reservations and rejects cost overruns', () => {
    expect(reserveAmount({ spent: 900000, reserved: 90000 }, 10000)).toBe(100000);
    expect(() => reserveAmount({ spent: 900000, reserved: 90000 }, 10001)).toThrow(
      'marketing_budget_exceeded',
    );
    expect(() => reserveAmount({ spent: 0, reserved: 0 }, NaN)).toThrow();
  });
});
