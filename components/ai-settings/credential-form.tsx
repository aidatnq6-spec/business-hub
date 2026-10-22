'use client';
import { useId, useState } from 'react';
import { Modal } from '../ui';
import s from './panel.module.css';

export function CredentialForm({
  replacing,
  busy,
  blocked,
  error,
  onSave,
  onClose,
}: {
  replacing: boolean;
  busy: boolean;
  blocked: boolean;
  error: string;
  onSave: (key: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [key, setKey] = useState('');
  const id = useId();
  const close = () => {
    if (!busy) {
      setKey('');
      onClose();
    }
  };
  return (
    <Modal title={replacing ? 'Thay API key Gemini' : 'Thêm API key Gemini'} onClose={close}>
      <form
        className={s.form}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || blocked || !key.trim()) return;
          if (await onSave(key.trim())) {
            setKey('');
            onClose();
          }
        }}
      >
        <p>
          Khóa được mã hóa trên máy chủ. Sau khi lưu chỉ hiển thị vài ký tự cuối, không thể xem lại
          toàn bộ khóa.
        </p>
        <label htmlFor={id}>API key Gemini</label>
        <input
          id={id}
          type="password"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          required
          maxLength={512}
          disabled={busy}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        />
        <p id={`${id}-help`} className={s.muted}>
          Không nhập khóa OpenRouter. Lưu khóa không gọi AI và không bật lịch chạy.
        </p>
        {error ? (
          <p id={`${id}-error`} role="alert" className={s.error}>
            {error}
          </p>
        ) : null}
        <div className={s.actions}>
          <button type="button" onClick={close} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className={s.primary} disabled={busy || blocked || !key.trim()}>
            {busy ? 'Đang lưu khóa…' : 'Lưu khóa'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
