export function subtitleTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('marketing_duration_invalid');
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}
export function wrapCaption(text: string, width = 34) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > width && line) {
      lines.push(line);
      line = '';
    }
    line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}
export function createSrt(scenes: { text: string; duration: number }[]) {
  let elapsed = 0;
  return scenes
    .map((s, i) => {
      const start = elapsed;
      elapsed += s.duration;
      return `${i + 1}\n${subtitleTime(start)} --> ${subtitleTime(elapsed)}\n${wrapCaption(s.text)}\n`;
    })
    .join('\n');
}
export function scriptScenes(script: string) {
  const chunks: string[] = [];
  let chunk = '';
  for (const word of script.split(/\s+/)) {
    if (word.length > 180) throw new Error('marketing_script_invalid');
    if ((chunk + ' ' + word).trim().length > 180) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += (chunk ? ' ' : '') + word;
  }
  if (chunk) chunks.push(chunk);
  if (!chunks.length || chunks.length > 12) throw new Error('marketing_script_invalid');
  return chunks.map((text) => ({ text }));
}
