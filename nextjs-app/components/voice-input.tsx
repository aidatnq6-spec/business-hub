'use client';
import { useEffect, useRef, useState } from 'react';
import { parseMockVoice } from '@/lib/mock-ai';
import { errorText } from '@/lib/domain';
import { Button } from './ui';
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    ((e: { results: { [n: number]: { [n: number]: { transcript: string } } } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function VoiceInput({ onParsed }: { onParsed: (value: Record<string, unknown>) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  useEffect(
    () => () => {
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.onend = null;
        recognition.current.abort();
        recognition.current = null;
      }
    },
    [],
  );
  function parse(value: string) {
    try {
      const result = parseMockVoice(value);
      onParsed(result);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }
  function toggle() {
    if (recognition.current) {
      recognition.current.stop();
      recognition.current = null;
      setListening(false);
      return;
    }
    const w = window as SpeechWindow;
    const Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Constructor) {
      setError('Trình duyệt chưa hỗ trợ nhận giọng nói. Bạn có thể nhập câu giao dịch bên dưới.');
      return;
    }
    const r = new Constructor();
    recognition.current = r;
    r.lang = 'vi-VN';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      if (recognition.current !== r) return;
      const transcript = e.results[0][0].transcript;
      setText(transcript);
      parse(transcript);
    };
    r.onerror = (e) => {
      if (recognition.current !== r) return;
      setError('Không nhận được giọng nói: ' + e.error);
      setListening(false);
      recognition.current = null;
    };
    r.onend = () => {
      if (recognition.current === r) {
        recognition.current = null;
        setListening(false);
      }
    };
    try {
      r.start();
      setListening(true);
      setError('');
    } catch (e) {
      recognition.current = null;
      setError(errorText(e));
    }
  }
  return (
    <div className="voice-panel">
      <h3>🎙️ Nói để nhập thu chi</h3>
      <p className="muted">
        Phân tích mẫu bằng quy tắc, chưa gọi AI. Ví dụ: “thu 1.5 triệu bán chữ ký số”. Kiểm tra form
        trước khi lưu.
      </p>
      <div className="form-inline">
        <input
          aria-label="Câu giao dịch để thử"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập câu giao dịch hoặc dùng micro…"
        />
        <Button secondary onClick={toggle}>
          {listening ? '⏹ Dừng nghe' : '🎙 Bắt đầu nghe'}
        </Button>
        <Button onClick={() => parse(text)} disabled={!text.trim()}>
          Điền vào form
        </Button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
