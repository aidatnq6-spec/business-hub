# Telegram Daily Report Implementation Plan

**Goal:** Gửi báo cáo Firebase thật tới chat Telegram đã cấu hình lúc 07:00 giờ Việt Nam mỗi ngày, kể cả khi đóng trình duyệt.

**Architecture:** Tác vụ máy chủ được scheduler gọi bằng credential riêng; Firebase Admin chỉ đọc UID chủ sở hữu được xác minh theo email, xử lý định kỳ và ghi trạng thái giao nhận. Telegram Bot API chỉ dùng sendMessage, không thay webhook/polling của bot đang dùng chung. Client chỉ xem trước và đọc trạng thái cấu hình an toàn.

**Tech Stack:** Next.js Route Handler Node.js, Firebase Admin SDK, Telegram HTTPS API, scheduler của hosting được chọn; Vitest.

## 1. Core gửi báo cáo

- Tạo `nextjs-app/lib/telegram-job.ts` và `telegram-transport.ts`.
- Tính ngày Việt Nam, không gửi trước 07:00, không nhận UID/chat/token từ request.
- Transaction giữ khóa theo ngày, lưu cố định các đoạn báo cáo và tiến độ, không gửi lại đoạn đã xác nhận. API từ chối chắc chắn có thể thử lại; timeout/mất kết nối hoặc tiến trình chết giữa gửi và ghi nhận được đánh dấu chưa rõ giao nhận và không tự gửi lại để tránh trùng.
- Kiểm thử ngày/kỳ, rỗng/dài, 429, lỗi API, chạy trùng, lỗi mạng và resume.

## 2. Firebase Admin và API

- Tạo `lib/server/firebase-admin.ts`, `telegram-store.ts`, `telegram-config.ts` và route `/api/cron/telegram`.
- Credential máy chủ ngoài Git; Firebase Web API key không thay thế Admin credential. Xác minh UID chủ sở hữu bằng Firebase Auth Admin.
- Đọc dữ liệu và xử lý định kỳ cùng quy tắc/ID bản client trước khi tổng hợp; không ghi mock lên cloud.
- API dùng Bearer CRON_SECRET, không cache, không trả dữ liệu báo cáo/token. HEAD không gửi tin. Tắt gửi mặc định cho đến khi cấu hình đủ.

## 3. Cấu hình và giao diện

- Chuẩn bị bot token/chat ID thành biến môi trường máy chủ từ `.secrets/telegram.env`, không in hoặc bundle giá trị.
- Thêm endpoint trạng thái không trả secret; hiển thị đúng trạng thái chưa bật hoặc đã chuẩn bị cấu hình, không tự tuyên bố scheduler đang chạy.
- Tạo cấu hình cron ví dụ `0 0 * * *` (00:00 UTC = 07:00 Việt Nam), chỉ cài lịch thật sau khi xác định hosting. Không chọn gói phát sinh phí thay người dùng.

## 4. Xác minh/triển khai

- Kiểm tra getMe/getChat chỉ đọc nếu mạng cho phép, không gửi nội dung thử giả.
- Chạy test, lint, typecheck và build; kiểm tra route từ chối request không xác thực và không thực thi khi thiếu cấu hình.
- Khi có hosting và danh tính Firebase server, triển khai scheduler, xác minh cấu hình đích; nếu còn thiếu phải ghi rõ chưa bật lịch thật.
