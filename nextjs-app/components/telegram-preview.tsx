'use client';
import { useHub } from './demo-provider';
import { businessDate, telegramReport } from '@/lib/domain';
import { Button, Modal, copyText } from './ui';
export function TelegramPreview({ onClose }: { onClose: () => void }) {
  const { data, notify } = useHub();
  const chunks = telegramReport(data, businessDate());
  return (
    <Modal title="📨 Báo cáo Telegram hằng ngày" onClose={onClose} wide>
      <p className="demo-note">
        Lịch dự kiến: 07:00 mỗi ngày (giờ Việt Nam). Đây là bản xem trước từ dữ liệu mẫu; chưa gửi
        tin và chưa bật lịch thật.
      </p>
      {chunks.map((text, i) => (
        <div key={i}>
          <div className="preview-label">
            Tin {i + 1}/{chunks.length}
          </div>
          <pre className="text-preview">{text}</pre>
        </div>
      ))}
      <div className="modal-actions">
        <Button secondary onClick={() => void copyText(chunks.join('\n\n'), notify)}>
          📋 Copy báo cáo
        </Button>
        <Button onClick={onClose}>Đóng xem trước</Button>
      </div>
    </Modal>
  );
}
