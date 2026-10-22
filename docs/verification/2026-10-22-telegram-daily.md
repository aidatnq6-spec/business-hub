# Kiểm chứng báo cáo Telegram — 22/10/2026

## Phạm vi đã hoàn tất

- Bộ gửi Node.js tại `/api/cron/telegram`, xác thực Bearer `CRON_SECRET`, dùng Firebase Admin để tìm/xác minh chủ sở hữu và đọc dữ liệu thật khi không mở ứng dụng.
- `vercel.json` cấu hình `0 0 * * *` UTC, tương ứng 07:00 Việt Nam; Root Directory khi deploy là thư mục gốc (`.`).
- Giữ nhóm Telegram người dùng đã xác nhận, không thay webhook/getUpdates của bot đang dùng chung.
- Transaction tạo việc định kỳ đến hạn trước khi lập báo cáo, journal chống gửi trùng/đánh dấu từng đoạn tại `users/{uid}/telegramReports/{date}`. Xử lý lỗi từ chối, retry-after, lease hết hạn và giao nhận không chắc chắn.
- Giao diện hiển thị readiness phía máy chủ thay cho thông báo cố định về bản mock; không tự nhận scheduler đã triển khai chỉ vì cấu hình đủ.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Next.js/Vitest | 97/97 đạt, 8 file kiểm thử |
| TypeScript (trong build) | Đạt |
| ESLint | Không lỗi/cảnh báo |
| Production build | Đạt; hai API routes dynamic |
| HTTP GET status | 200; configured=false, sendsEnabled=false |
| HTTP GET cron không xác thực | 401 |
| HTTP HEAD cron | 204; không thực thi gửi |
| HTTP login | 200 |
| Quét 24 bundle JavaScript client | Không chứa giá trị token Telegram hoặc CRON_SECRET đã cấu hình |
| npm audit --omit=dev | 0 lỗ hổng |

Kiểm tra Telegram thật chỉ đọc bằng getMe/getChat/getChatMember đã thành công: bot hợp lệ, chat đúng nhóm đã cung cấp, bot là member. Không gửi tin thử và không khẳng định đã xác minh giao nhận trên điện thoại. Lần kiểm tra đầu bị chặn mạng trong sandbox; kiểm tra lại với quyền mạng được cho phép đã thành công.

## Những việc chưa thể xác minh/kích hoạt

- `.secrets/firebase-service-account.json` chưa có; cũng chưa có Google Application Default Credentials hoặc GOOGLE_APPLICATION_CREDENTIALS. Lệnh `npm run telegram:prepare` trả mã `service_account_file_missing`; không sửa dữ liệu hoặc gửi tin.
- Bộ gửi được giữ `TELEGRAM_REPORT_ENABLED=false`. Chưa triển khai Business Hub production và chưa đăng ký lịch trên tài khoản Vercel thực tế. Danh sách project đọc được chưa có Business Hub.
- Không xác minh được gói Vercel: API đọc thông tin team trả 403 do connector thiếu quyền scope; công cụ authorize_team_access được đề xuất trong lỗi không có sẵn trong phiên. Không đổi project/gói của các ứng dụng khác.
- Chưa gửi báo cáo thực tế và chưa xác minh lần chạy lúc 07:00. Vercel Hobby cho phép chạy trong khoảng 07:00–07:59; cần Pro hoặc scheduler khác có độ chính xác phù hợp nếu yêu cầu trong phút 07:00. Không tự nâng gói.

Hướng dẫn hoàn tất và kiểm tra vận hành: [telegram-setup.md](../telegram-setup.md).
