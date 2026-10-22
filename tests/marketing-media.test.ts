import { describe, it, expect } from 'vitest';
import { createSrt, scriptScenes, subtitleTime } from '@/lib/marketing/media';
import { zipFiles } from '@/lib/marketing/zip';
describe('media and export contracts', () => {
  it('aligns subtitles with measured audio durations', () => {
    const srt = createSrt([
      { text: 'Đạt Nguyễn', duration: 1.25 },
      { text: 'Học AI thực tế', duration: 2 },
    ]);
    expect(srt).toContain('00:00:00,000 --> 00:00:01,250');
    expect(srt).toContain('00:00:01,250 --> 00:00:03,250');
    expect(srt).toContain('Đạt Nguyễn');
    expect(() => subtitleTime(-1)).toThrow();
  });
  it('splits long scripts into readable captions without losing words', () => {
    const text = Array(150).fill('kiến thức').join(' '),
      scenes = scriptScenes(text);
    expect(scenes.every((x) => x.text.length <= 180)).toBe(true);
    expect(scenes.map((x) => x.text).join(' ')).toBe(text);
  });
  it('rejects path traversal in export names and preserves UTF-8', () => {
    expect(() => zipFiles([{ name: '../secret', data: Buffer.from('x') }])).toThrow();
    const zip = zipFiles([{ name: 'facebook.txt', data: Buffer.from('Đạt Nguyễn') }]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.includes(Buffer.from('Đạt Nguyễn'))).toBe(true);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  });
});
