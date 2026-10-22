'use client';
import { useState } from 'react';
import { useHub } from './hub-provider';
import { Button, Modal } from './ui';
import { exportBackup, importBackup, errorText, businessDate } from '@/lib/domain';
import { COLLECTION_LABELS, type AppData, type CollectionName } from '@/lib/types';
const HISTORY_KEY = 'business-hub:next:backup-history';
interface BackupHistory {
  filename: string;
  date: string;
  count: number;
  size: number;
}
function loadHistory(): BackupHistory[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(rows)
      ? rows.filter(
          (r): r is BackupHistory =>
            !!r &&
            typeof r === 'object' &&
            typeof r.filename === 'string' &&
            typeof r.date === 'string' &&
            typeof r.count === 'number' &&
            typeof r.size === 'number',
        )
      : [];
  } catch {
    return [];
  }
}
export function BackupDialog({ onClose }: { onClose: () => void }) {
  const hub = useHub();
  const [incoming, setIncoming] = useState<AppData | null>(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [history, setHistory] = useState(loadHistory);
  const [importing, setImporting] = useState(false);
  function download() {
    try {
      const blob = new Blob([exportBackup(hub.data, hub.user?.email ?? '')], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `business-hub-${businessDate()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const next = [
        {
          filename: a.download,
          date: new Date().toISOString(),
          count: Object.values(hub.data).reduce((s, rows) => s + rows.length, 0),
          size: blob.size,
        },
        ...history,
      ].slice(0, 10);
      setHistory(next);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        hub.notify('Đã xuất backup; không lưu được lịch sử trên trình duyệt.');
        return;
      }
      hub.notify('Đã xuất backup dữ liệu Firebase.');
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function read(file?: File) {
    if (!file) return;
    setError('');
    setIncoming(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Chọn file nhỏ hơn 20 MB.');
      const parsed = importBackup(await file.text());
      setIncoming(parsed);
      setFileName(file.name);
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <Modal title="💾 Backup & Restore dữ liệu" onClose={onClose}>
      <p className="demo-note">
        Backup từ tài khoản {hub.user?.email}. Khi xác nhận nhập, dữ liệu sẽ được gộp lên Firebase
        của tài khoản này.
      </p>
      <div className="section">
        <h3>📥 Xuất Backup</h3>
        <p className="muted">Tải JSON gồm toàn bộ nhóm dữ liệu, ID và thời điểm tạo.</p>
        <Button onClick={download}>📥 Xuất backup ngay</Button>
      </div>
      <div className="section">
        <h3>📤 Khôi phục từ Backup</h3>
        <p className="muted">
          Cập nhật bản ghi trùng ID, thêm bản ghi mới và giữ các bản ghi khác.
        </p>
        <label className="field">
          Chọn file JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {incoming && (
        <div className="import-preview">
          <h3>Xác nhận gộp: {fileName}</h3>
          <ul>
            {(Object.keys(incoming) as CollectionName[]).map((k) => (
              <li key={k}>
                {COLLECTION_LABELS[k]}: {incoming[k].length} bản ghi
              </li>
            ))}
          </ul>
          <p>Gộp backup cập nhật các bản ghi trùng ID trên Firebase. Nên xuất backup trước.</p>
          <Button
            disabled={importing || hub.busy || hub.syncStatus !== 'live'}
            onClick={async () => {
              setImporting(true);
              try {
                if (await hub.importData(incoming)) {
                  setIncoming(null);
                  onClose();
                } else
                  setError(
                    'Chưa hoàn tất nhập backup. Xem thông báo số bản ghi đã ghi và thử lại.',
                  );
              } finally {
                setImporting(false);
              }
            }}
          >
            {importing ? 'Đang gộp…' : 'Xác nhận gộp lên Firebase'}
          </Button>
        </div>
      )}
      <section className="section">
        <h3>Lịch sử backup trên trình duyệt</h3>
        {history.length ? (
          history.map((h, i) => (
            <div key={h.date + i} className="summary-line">
              <div>
                <strong>{h.filename}</strong>
                <p className="muted">
                  {new Date(h.date).toLocaleString('vi-VN')} · {h.count} bản ghi ·{' '}
                  {(h.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">Chưa xuất backup nào trên trình duyệt này.</p>
        )}
      </section>
    </Modal>
  );
}
