'use client';
import { useHub } from './hub-provider';
import { businessDate, telegramReport } from '@/lib/domain';
import { Button, Modal, copyText } from './ui';
import { TelegramDeliveryStatus } from './telegram-delivery-status';
export function TelegramPreview({ onClose }: { onClose: () => void }) {
  const { data, notify } = useHub();
  const chunks = telegramReport(data, businessDate());
  return (
    <Modal title="📨 Báo cáo Telegram hằng ngày" onClose={onClose} wide>
      <TelegramDeliveryStatus />
      <p className="muted">
        Nội dung bên dưới là bản xem trước từ dữ liệu Firebase đang hiển thị. Tác vụ 07:00 đọc dữ
        liệu mới trực tiếp từ máy chủ.
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
