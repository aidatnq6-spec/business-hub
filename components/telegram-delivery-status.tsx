'use client';
import { useEffect, useState } from 'react';

interface DeliveryStatus {
  configured: boolean;
  sendsEnabled: boolean;
  missing: string[];
}
export function TelegramDeliveryStatus() {
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/telegram/status', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('status_failed');
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== 'object' ||
          !('configured' in body) ||
          typeof body.configured !== 'boolean' ||
          !('sendsEnabled' in body) ||
          typeof body.sendsEnabled !== 'boolean' ||
          !('missing' in body) ||
          !Array.isArray(body.missing) ||
          !body.missing.every((v) => typeof v === 'string')
        )
          throw new Error('invalid_status');
        if (active)
          setStatus({
            configured: body.configured,
            sendsEnabled: body.sendsEnabled,
            missing: body.missing,
          });
      } catch {
        if (active) setError(true);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);
  return (
    <div className="demo-note" role="status">
      <strong>Lịch gửi: 07:00 mỗi ngày (giờ Việt Nam).</strong>{' '}
      {error
        ? 'Chưa kiểm tra được cấu hình gửi tự động trên máy chủ.'
        : !status
          ? 'Đang kiểm tra cấu hình máy chủ…'
          : !status.configured
            ? `Chưa thể gửi tự động. Còn thiếu: ${status.missing.join(', ')}.`
            : !status.sendsEnabled
              ? 'Cấu hình đã đủ; bộ gửi tự động đang tắt.'
              : 'Bộ gửi phía máy chủ đã bật. Lịch do Vercel gọi khi triển khai production; xem lần chạy trong Vercel Cron Jobs.'}
    </div>
  );
}
