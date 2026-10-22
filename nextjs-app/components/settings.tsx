'use client';
import { useEffect, useState } from 'react';
import { useHub } from './demo-provider';
import { Button, Modal, Section } from './ui';
import { TelegramPreview } from './telegram-preview';
import { MODEL_OPTIONS } from '@/lib/models';
const models = MODEL_OPTIONS.map((m) => m.id);
export function Settings() {
  const hub = useHub();
  const [model, setModel] = useState(models[0]);
  const [key, setKey] = useState('');
  const [telegram, setTelegram] = useState(false);
  const [reset, setReset] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = sessionStorage.getItem('business-hub:next:demo-model');
        if (saved && models.includes(saved)) setModel(saved);
      } catch {
        /* Keep the in-memory default if browser storage is unavailable. */
      }
    });
  }, []);
  return (
    <div className="settings-grid">
      <div className="page-heading">
        <div>
          <h1>⚙️ Cài đặt</h1>
          <p>Cấu hình bản dùng thử Business Hub</p>
        </div>
      </div>
      <Section title="🤖 Cài đặt AI">
        <p className="demo-note">
          Các thao tác AI đang mô phỏng, không gọi OpenRouter hoặc dùng khóa thật.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              sessionStorage.setItem('business-hub:next:demo-model', model);
            } catch {
              hub.notify(
                'Trình duyệt đang chặn lưu cài đặt. Lựa chọn model chỉ giữ trong màn hình này.',
              );
              setKey('');
              return;
            }
            hub.notify(
              'Đã lưu lựa chọn model cho phiên dùng thử. Khóa nhập thử không được gửi hoặc lưu.',
            );
            setKey('');
          }}
        >
          <label className="field">
            Model AI
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {models.map((m) => (
                <option key={m} value={m}>
                  {MODEL_OPTIONS.find((x) => x.id === m)?.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            OpenRouter API key (nhập thử)
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Không cần nhập khóa thật"
            />
          </label>
          <Button type="submit">Lưu cài đặt AI</Button>
        </form>
      </Section>
      <Section title="📨 Báo cáo Telegram">
        <p>
          Lịch đã chốt: <strong>07:00 mỗi ngày — giờ Việt Nam</strong>.
        </p>
        <p className="muted">
          Việc hôm nay, việc quá hạn, công nợ 7 ngày tới và tổng thu/chi/lợi nhuận tháng hiện tại.
        </p>
        <p className="demo-note">
          Chưa kết nối bot và chưa kích hoạt lịch gửi. Cấu hình bí mật không được nạp vào bản dùng
          thử.
        </p>
        <Button onClick={() => setTelegram(true)}>Xem trước báo cáo</Button>
      </Section>
      <Section title="🔔 Thông báo trình duyệt">
        <p className="muted">
          Xem nhắc việc bằng nút 🔔 trên thanh tiêu đề. Bản mẫu không đăng ký thông báo nền.
        </p>
        <Button
          secondary
          onClick={() =>
            hub.notify('Nhắc việc đang hiển thị trong ứng dụng. Chưa đăng ký thông báo hệ thống.')
          }
        >
          Thử nhắc việc trong ứng dụng
        </Button>
      </Section>
      <Section title="🧪 Dữ liệu mẫu">
        <p>
          Thay đổi được lưu riêng trong trình duyệt này. Firebase và dữ liệu của phần mềm kia không
          bị tác động.
        </p>
        <Button secondary onClick={() => setReset(true)}>
          Khôi phục dữ liệu mẫu ban đầu
        </Button>
      </Section>
      {telegram && <TelegramPreview onClose={() => setTelegram(false)} />}{' '}
      {reset && (
        <Modal title="Khôi phục dữ liệu mẫu?" onClose={() => setReset(false)}>
          <p>
            Các thay đổi mẫu trên trình duyệt này sẽ được thay bằng bộ dữ liệu ban đầu. Hãy xuất
            backup nếu muốn giữ lại.
          </p>
          <div className="modal-actions">
            <Button secondary onClick={() => setReset(false)}>
              Hủy
            </Button>
            <Button
              danger
              onClick={() => {
                hub.reset();
                setReset(false);
              }}
            >
              Khôi phục dữ liệu mẫu
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
