import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, isAbsolute } from 'node:path';
import { createSrt, wrapCaption } from '../../lib/marketing/media.ts';

function command(binary, args, cwd) {
  return new Promise((done, reject) => {
    const executable =
      binary === 'ffmpeg'
        ? process.env.MARKETING_FFMPEG_PATH || binary
        : process.env.MARKETING_FFPROBE_PATH || binary;
    const child = spawn(executable, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '',
      size = 0;
    const timer = setTimeout(() => child.kill(), 780000);
    child.stdout.on('data', (b) => {
      size += b.length;
      if (size < 200000) output += b;
    });
    child.stderr.on('data', () => {});
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('marketing_media_tool_unavailable'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) done(output);
      else reject(new Error('marketing_media_process_failed'));
    });
  });
}
async function inspect(file, cwd) {
  const json = await command(
    'ffprobe',
    [
      '-v',
      'error',
      '-protocol_whitelist',
      'file,pipe',
      '-show_format',
      '-show_streams',
      '-of',
      'json',
      file,
    ],
    cwd,
  );
  return JSON.parse(json);
}
async function workspace(fn) {
  const base = resolve(tmpdir()),
    dir = await mkdtemp(join(base, 'business-hub-mkt-'));
  try {
    return await fn(dir);
  } finally {
    const absolute = resolve(dir);
    if (!absolute.startsWith(base + sep) || !absolute.includes('business-hub-mkt-'))
      throw new Error('marketing_temp_path_invalid');
    await rm(absolute, { recursive: true, force: true });
  }
}
export async function probeMedia(bytes, contentType) {
  return workspace(async (dir) => {
    const file = join(dir, 'input');
    await writeFile(file, bytes);
    const value = await inspect(file, dir),
      stream = value.streams?.find((s) => s.codec_type === 'video');
    if (!stream || !stream.width || !stream.height || stream.width > 7680 || stream.height > 7680)
      throw new Error('marketing_material_invalid');
    if (contentType === 'video/mp4') {
      if (!value.format?.format_name?.includes('mp4') || Number(value.format.duration) > 600)
        throw new Error('marketing_material_invalid');
    } else if (!['png', 'mjpeg'].includes(stream.codec_name))
      throw new Error('marketing_material_invalid');
  });
}
export async function renderVideo(input) {
  return workspace(async (dir) => {
    if (!input.audio.length || input.audio.length > 12) throw new Error('marketing_script_invalid');
    await writeFile(join(dir, 'image'), input.image);
    await writeFile(join(dir, 'brand.txt'), input.brandName || 'Đạt Nguyễn');
    const scenes = [];
    let elapsed = 0;
    for (let i = 0; i < input.audio.length; i++) {
      await writeFile(join(dir, `audio-${i}.wav`), input.audio[i].data);
      const info = await inspect(`audio-${i}.wav`, dir),
        duration = Number(info.format?.duration);
      if (!Number.isFinite(duration) || duration < 0.1)
        throw new Error('marketing_duration_invalid');
      scenes.push({ text: input.audio[i].text, duration });
      await writeFile(join(dir, `caption-${i}.txt`), wrapCaption(input.audio[i].text));
    }
    const total = scenes.reduce((sum, s) => sum + s.duration, 0);
    const minimum = input.bundle.style === 'tutorial' ? 45 : 30,
      maximum = input.bundle.style === 'tutorial' ? 90 : 60;
    if (total > maximum || total < minimum) throw new Error('marketing_duration_invalid');
    if (input.bundle.style === 'tutorial') {
      if (!input.recording) throw new Error('marketing_material_missing');
      await writeFile(join(dir, 'recording.mp4'), input.recording);
      const info = await inspect('recording.mp4', dir);
      if (Number(info.format?.duration) < total) throw new Error('marketing_recording_too_short');
    }
    const font =
      process.env.MARKETING_FONT_FILE || '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
    // Font path is deployment config; request content only goes in text files, expansion disabled.
    if (!isAbsolute(font)) throw new Error('marketing_font_invalid');
    await copyFile(font, join(dir, 'font.ttf'));
    for (let i = 0; i < scenes.length; i++) {
      const source =
        input.bundle.style === 'tutorial'
          ? ['-ss', String(elapsed), '-i', 'recording.mp4']
          : ['-loop', '1', '-i', 'image'];
      const filter = `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x182956,setsar=1,drawbox=x=0:y=0:w=iw:h=150:color=0x11133e@0.85:t=fill,drawtext=fontfile=font.ttf:textfile=brand.txt:expansion=none:fontcolor=white:fontsize=44:x=48:y=48,drawbox=x=24:y=1420:w=1032:h=470:color=black@0.75:t=fill,drawtext=fontfile=font.ttf:textfile=caption-${i}.txt:expansion=none:fontcolor=white:fontsize=38:line_spacing=10:x=(w-text_w)/2:y=1460`;
      await command(
        'ffmpeg',
        [
          '-nostdin',
          '-y',
          ...source,
          '-i',
          `audio-${i}.wav`,
          '-t',
          String(scenes[i].duration),
          '-vf',
          filter,
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-r',
          '30',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-ar',
          '48000',
          '-ac',
          '2',
          '-b:a',
          '128k',
          `part-${i}.mp4`,
        ],
        dir,
      );
      elapsed += scenes[i].duration;
    }
    await writeFile(
      join(dir, 'concat.txt'),
      scenes.map((_, i) => `file 'part-${i}.mp4'`).join('\n'),
    );
    await command(
      'ffmpeg',
      [
        '-nostdin',
        '-y',
        '-f',
        'concat',
        '-safe',
        '1',
        '-i',
        'concat.txt',
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        'output.mp4',
      ],
      dir,
    );
    const info = await inspect('output.mp4', dir),
      v = info.streams.find((s) => s.codec_type === 'video'),
      a = info.streams.find((s) => s.codec_type === 'audio');
    if (
      v?.codec_name !== 'h264' ||
      a?.codec_name !== 'aac' ||
      v.width !== 1080 ||
      v.height !== 1920
    )
      throw new Error('marketing_render_invalid');
    const video = await readFile(join(dir, 'output.mp4'));
    if (video.length > 150000000) throw new Error('marketing_asset_too_large');
    return { video, srt: createSrt(scenes) };
  });
}
export async function composeImage(bytes, title, brandName) {
  return workspace(async (dir) => {
    await writeFile(join(dir, 'image'), bytes);
    await writeFile(join(dir, 'brand.txt'), brandName);
    await writeFile(join(dir, 'title.txt'), wrapCaption(title, 38));
    const font =
      process.env.MARKETING_FONT_FILE || '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
    if (!isAbsolute(font)) throw new Error('marketing_font_invalid');
    await copyFile(font, join(dir, 'font.ttf'));
    const vf =
      'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,drawbox=x=0:y=0:w=iw:h=100:color=0x11133e@0.9:t=fill,drawtext=fontfile=font.ttf:textfile=brand.txt:expansion=none:fontcolor=white:fontsize=32:x=40:y=30,drawbox=x=0:y=730:w=iw:h=350:color=0x11133e@0.9:t=fill,drawtext=fontfile=font.ttf:textfile=title.txt:expansion=none:fontcolor=white:fontsize=42:line_spacing=12:x=40:y=765';
    await command(
      'ffmpeg',
      ['-nostdin', '-y', '-i', 'image', '-vf', vf, '-frames:v', '1', 'branded.png'],
      dir,
    );
    return readFile(join(dir, 'branded.png'));
  });
}
