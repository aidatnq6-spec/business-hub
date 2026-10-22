# Bật báo cáo Telegram lúc 07:00 trên Vercel

## Trạng thái hiện tại

Đã có bộ gửi phía máy chủ, cấu hình Vercel Cron lúc `0 0 * * *` (00:00 UTC = 07:00 Việt Nam), chống chạy trùng và trạng thái giao nhận từng ngày. Đã xác minh bot hợp lệ, đúng chat nhóm được cung cấp và bot là thành viên nhóm bằng `getMe`, `getChat`, `getChatMember`. Không gửi tin thử, không thay webhook/polling.

**Chưa bật lịch thật:** chưa có credential Firebase Admin và chưa triển khai Business Hub production lên Vercel. File `.env.local` đã có token/chat và cron secret phía máy chủ; `TELEGRAM_REPORT_ENABLED=false` cho đến khi hoàn tất cấu hình. Firebase Web API key không thể thay cho danh tính máy chủ.

## 1. Chuẩn bị quyền Firebase máy chủ

Trong Firebase Console của đúng project Business Hub, vào **Project settings → Service accounts → Firebase Admin SDK → Generate new private key**. Đặt file JSON tải về tại:

```text
D:\GitHub\business-hub\.secrets\firebase-service-account.json
```

File này chứa khóa riêng: lưu tại đường dẫn trên đã được Git bỏ qua; không dán nội dung vào chat hoặc mã nguồn. Credential cần quyền đọc Firebase Auth để xác minh chủ sở hữu và quyền Firestore cho dữ liệu/bản ghi chạy. Không cần sửa Security Rules để cấp quyền client rộng hơn.

Từ thư mục gốc chạy:

```sh
npm run telegram:prepare
npm run telegram:check
```

Lệnh prepare kiểm tra project, tìm UID tài khoản chủ sở hữu hiện có và chuẩn bị đường dẫn credential local. Lệnh check chỉ kiểm tra bot/nhóm, không gửi tin. Nếu bị chặn mạng, chạy lại trong terminal có quyền mạng. Khởi động lại dev server sau khi cập nhật môi trường.

## 2. Cấu hình Vercel Production

Tạo/chọn project Business Hub, đặt **Root Directory = `.` (thư mục gốc repository)**, framework Next.js. Không chọn/ghi đè các project phần mềm khác đang có.

Trong Settings → Environment Variables, cấu hình cho **Production**:

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Cấu hình Web hiện có, giống `.env.local` |
| `FIREBASE_PROJECT_ID` | Project Firebase Business Hub hiện tại |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Toàn bộ JSON service account, lưu dạng biến máy chủ nhạy cảm |
| `FIREBASE_OWNER_UID` | Tùy chọn; UID do lệnh prepare xác minh. Nếu bỏ trống, máy chủ tìm chủ sở hữu theo email cố định của ứng dụng |
| `TELEGRAM_BOT_TOKEN` | Token đã cung cấp, lấy từ `.env.local` |
| `TELEGRAM_CHAT_ID` | Chat nhóm đã cung cấp, lấy từ `.env.local` |
| `CRON_SECRET` | Giá trị ngẫu nhiên đã chuẩn bị trong `.env.local`, ít nhất 32 ký tự |
| `TELEGRAM_REPORT_ENABLED` | `true` khi đã sẵn sàng kích hoạt |

Không dùng `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới ổ D: trên Vercel; đó chỉ là đường dẫn local. Không gắn tiền tố `NEXT_PUBLIC_` cho các credential máy chủ, cron secret hoặc token bot. Cập nhật biến môi trường phải đi kèm deployment mới.

Deploy production sau khi test/build đạt. Cấu hình cron nằm trong `vercel.json`. Trong Vercel → Settings → Cron Jobs, kiểm tra `/api/cron/telegram` có lịch `0 0 * * *` và đang bật. Preview deployment và `npm run dev` không tự chạy cron.

## 3. Độ chính xác giờ gửi

Vercel Hobby chạy trong khoảng **07:00–07:59** cho lịch này. Pro hỗ trợ chạy trong phút **07:00**. Chưa xác minh gói tài khoản hiện tại; không tự nâng gói hoặc phát sinh phí. Chỉ cam kết theo độ chính xác scheduler thực tế; không bảo đảm tin đã đến điện thoại đúng giây 07:00:00.

Tài liệu chính thức: [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [quản lý và xác thực Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Firebase Admin setup](https://firebase.google.com/docs/admin/setup).

## 4. Xác minh vận hành

- Trạng thái trong ứng dụng chỉ xác nhận cấu hình bộ gửi; kiểm tra lịch thực tế trong Vercel Dashboard. Không hiện “đã chạy lịch” chỉ vì có token.
- Endpoint `/api/cron/telegram` nhận Bearer `CRON_SECRET`, chỉ lấy UID/chat từ cấu hình máy chủ. HEAD/health check không gửi tin. Chạy trước 07:00 sẽ bỏ qua.
- Mỗi ngày lưu journal tại `users/{uid}/telegramReports/{YYYY-MM-DD}`: khóa chạy, nội dung các đoạn, chỉ số đoạn tiếp theo, message IDs, trạng thái và mã lỗi an toàn. Không lưu token trong journal.
- Đã gửi thành công (`sent`) sẽ không gửi lại cùng ngày. Các đoạn đã xác nhận không được gửi lại khi tiếp tục báo cáo dài. Lỗi từ chối chắc chắn như 429 lưu thời gian được thử lại. Vercel không tự retry cron lỗi; sau khi khắc phục có thể chạy lại từ Dashboard, bộ gửi sẽ tiếp tục phần chưa gửi.
- Timeout/mất mạng sau khi gửi hoặc tiến trình chết giữa gửi và ghi nhận có thể để lại trạng thái `uncertain`. Phải đối chiếu tin trong Telegram trước khi sửa journal để thử lại; không xóa journal tùy tiện vì có thể gửi trùng. Không hứa gửi đúng một lần tuyệt đối khi Telegram không có idempotency key cho sendMessage.
- Bật thông báo Telegram cho nhóm trên điện thoại nếu muốn thấy banner/âm thanh. Bot gửi với thông báo bật nhưng không thể ghi đè chế độ im lặng của điện thoại hoặc nhóm.

Nội dung dùng dữ liệu Firebase thật: việc hôm nay, việc quá hạn, công nợ trong 7 ngày tính cả hôm nay và thu/chi/lợi nhuận tháng hiện tại. Tác vụ tạo việc định kỳ đến hạn bằng transaction/ID tương thích bản cũ trước khi tổng hợp, kể cả khi không mở ứng dụng.
