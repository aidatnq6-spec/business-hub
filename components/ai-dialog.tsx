'use client';
import { useState } from 'react';
import { useHub } from './hub-provider';
import { Button, Modal, copyText } from './ui';
import { mockAI, type AIKind } from '@/lib/mock-ai';
import type { Deal } from '@/lib/types';
const titles: Record<AIKind, string> = {
  briefing: '🧠 Briefing thông minh',
  weekly: '🤖 AI Tóm tắt tuần',
  accounting: '🤖 AI Phân tích Kế toán',
  forecast: '📈 AI Dự báo dòng tiền',
  script: '✨ AI Script cá nhân hóa',
  it: '🤖 IT Chatbot',
};
export function AIDialog({
  kind,
  deal,
  onClose,
}: {
  kind: AIKind;
  deal?: Deal;
  onClose: () => void;
}) {
  const { data, notify } = useHub();
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  async function generate() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 150));
    setResult(mockAI(kind, data, input, deal));
    setBusy(false);
  }
  return (
    <Modal title={titles[kind]} onClose={onClose}>
      <p className="demo-note">
        Dữ liệu lấy từ Firebase; phần diễn giải AI vẫn mô phỏng, không gửi dữ liệu đến dịch vụ AI.
      </p>
      {kind === 'it' && (
        <label className="field">
          Mô tả lỗi
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            placeholder="Ví dụ: phần mềm không nhận USB Token"
          />
        </label>
      )}
      {deal && (
        <p>
          <strong>{deal.ten}</strong> · {deal.product}
        </p>
      )}
      {result && (
        <pre className="text-preview" aria-live="polite">
          {result}
        </pre>
      )}
      <div className="modal-actions">
        {result && (
          <Button secondary onClick={() => void copyText(result, notify)}>
            📋 Copy kết quả
          </Button>
        )}
        <Button disabled={busy || (kind === 'it' && !input.trim())} onClick={() => void generate()}>
          {busy ? 'Đang tạo…' : result ? 'Tạo lại' : '✨ Tạo với AI'}
        </Button>
      </div>
    </Modal>
  );
}
