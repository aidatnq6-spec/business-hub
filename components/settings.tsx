'use client';
import { useState } from 'react';
import { useHub } from './hub-provider';
import { Button, Section } from './ui';
import { TelegramPreview } from './telegram-preview';
import { TelegramDeliveryStatus } from './telegram-delivery-status';
import { AiSettingsPanel } from './ai-settings/panel';
export function Settings() {
  const hub = useHub();
  const [telegram, setTelegram] = useState(false);
  return (
    <div className="settings-grid">
      <div className="page-heading">
        <div>
          <h1>⚙️ Cài đặt</h1>
          <p>Cấu hình Business Hub</p>
        </div>
      </div>
      <AiSettingsPanel />
      <Section title="📨 Báo cáo Telegram">
        <p>
          Lịch đã chốt: <strong>07:00 mỗi ngày — giờ Việt Nam</strong>.
        </p>
        <p className="muted">
          Việc hôm nay, việc quá hạn, công nợ 7 ngày tới và tổng thu/chi/lợi nhuận tháng hiện tại.
        </p>
        <TelegramDeliveryStatus />
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
      <Section title="☁️ Dữ liệu Firebase">
        <p>
          Tài khoản: <strong>{hub.user?.email}</strong>
        </p>
        <p>
          Dữ liệu được đồng bộ trực tiếp với Firebase của Business Hub. Các thay đổi cũng xuất hiện
          ở bản cũ dùng chung tài khoản.
        </p>
        <p className="muted">Không nạp hoặc tự nhập dữ liệu mẫu lên Firebase.</p>
        <Button secondary disabled={hub.busy} onClick={hub.retry}>
          Tải lại dữ liệu Firebase
        </Button>
      </Section>
      {telegram && <TelegramPreview onClose={() => setTelegram(false)} />}
    </div>
  );
}
