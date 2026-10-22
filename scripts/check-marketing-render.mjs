import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { renderVideo, probeMedia, composeImage } from '../services/marketing-worker/render.mjs';
const require = createRequire(import.meta.url);
process.env.MARKETING_FFMPEG_PATH = require('ffmpeg-static');
process.env.MARKETING_FFPROBE_PATH = require('ffprobe-static').path;
process.env.MARKETING_FONT_FILE =
  process.env.MARKETING_FONT_FILE ||
  (process.platform === 'win32'
    ? 'C:\\Windows\\Fonts\\arial.ttf'
    : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
const output = resolve('.firebase/marketing-render-check');
await mkdir(output, { recursive: true });
const dir = await mkdtemp(join(output, 'fixtures-'));
function ff(args) {
  const result = spawnSync(process.env.MARKETING_FFMPEG_PATH, args, {
    cwd: dir,
    windowsHide: true,
    shell: false,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error('fixture_generation_failed');
}
try {
  ff([
    '-nostdin',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x182956:s=1080x1080',
    '-frames:v',
    '1',
    'image.png',
  ]);
  ff([
    '-nostdin',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=16',
    '-ar',
    '24000',
    'tone.wav',
  ]);
  const image = await readFile(join(dir, 'image.png')),
    audio = await readFile(join(dir, 'tone.wav'));
  await probeMedia(image, 'image/png');
  const branded = await composeImage(
    image,
    'Kiểm tra ảnh thương hiệu và chữ tiếng Việt',
    'Đạt Nguyễn',
  );
  await writeFile(join(output, 'branded-smoke.png'), branded);
  const result = await renderVideo({
    bundle: { style: 'knowledge' },
    image,
    audio: [
      { text: 'Đây là tư liệu kiểm thử dựng video, không phải nội dung AI thật.', data: audio },
      {
        text: 'Đạt Nguyễn — kiểm tra chữ có dấu và phụ đề đồng bộ theo thời lượng âm thanh.',
        data: audio,
      },
    ],
  });
  const file = join(output, 'render-smoke.mp4');
  await writeFile(file, result.video);
  await writeFile(join(output, 'render-smoke.srt'), result.srt);
  const info = spawnSync(
    process.env.MARKETING_FFPROBE_PATH,
    ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file],
    { encoding: 'utf8' },
  );
  if (info.status !== 0) throw new Error('ffprobe_failed');
  const data = JSON.parse(info.stdout);
  const video = data.streams.find((s) => s.codec_type === 'video');
  console.log(
    JSON.stringify(
      {
        file,
        paidApiCalled: false,
        syntheticTestAudio: true,
        duration: Number(data.format.duration),
        width: video.width,
        height: video.height,
        codec: video.codec_name,
        subtitleVietnamese: result.srt.includes('Đạt Nguyễn'),
      },
      null,
      2,
    ),
  );
} finally {
  if (!resolve(dir).startsWith(output + sep)) throw new Error('invalid_cleanup_path');
  await rm(dir, { recursive: true, force: true });
}
