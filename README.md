# Business Hub — Next.js và Firebase

Bản Next.js tại thư mục gốc `D:\GitHub\business-hub` gồm sáu phần chính: tổng quan, sale pipeline, kế toán, công nợ, vận hành và báo cáo. Dữ liệu nghiệp vụ được đồng bộ trực tiếp với Firebase hiện có; không nạp dữ liệu mẫu. Mã HTML/PWA và công cụ triển khai HTML đã được loại bỏ khỏi repository.

## Chạy ứng dụng

Yêu cầu Node.js >=22.13. Từ thư mục gốc repository:

```sh
npm ci
npm run dev
```

Mở http://localhost:3000. Trong PowerShell nếu `npm.ps1` bị chặn, dùng `npm.cmd`.

Cấu hình Firebase Web được đọc từ `.env.local`. File này đã được chuẩn bị từ cấu hình người dùng cung cấp và được Git bỏ qua. Khi chuyển sang máy khác, sao chép `.env.example` thành `.env.local`, điền cấu hình Firebase Web rồi khởi động lại dev server. Các biến `NEXT_PUBLIC_FIREBASE_*` là cấu hình client công khai; không đặt Telegram token, OpenRouter key hoặc service-account private key trong các biến công khai này.

Đăng nhập ở `/login` bằng email/mật khẩu Firebase của tài khoản chủ sở hữu đang dùng ở bản cũ. Không tạo tài khoản mới. Phiên đăng nhập trên domain bản cũ không tự chuyển sang localhost; dùng cùng tài khoản sẽ có cùng UID và cùng dữ liệu.

```sh
npm run build
npm start
```

Toàn bộ lệnh chạy tại thư mục gốc repository.

## Đồng bộ dữ liệu

- Firebase Auth dùng Email/Password; chỉ nhận tài khoản chủ sở hữu hiện có. Security Rules trên cloud vẫn quyết định quyền đọc/ghi; không tự triển khai hoặc nới rules.
- Firestore listener đọc đủ 11 collection tại `users/{uid}/{collection}`: deals, transactions, debts, todos, followups, apartments, recurringTasks, rentPayments, recurringRuns, cksCustomers và itCustomErrors.
- Không lọc theo `createdAt`, giữ ID tài liệu thật và các trường bổ sung. Chuẩn hóa Timestamp, định dạng thu/chi cũ và số tiền thuê cũ cho giao diện; không tự viết lại toàn bộ dữ liệu khi đọc.
- Chờ tải đầy đủ dữ liệu từ server trước khi hiển thị số liệu. Có trạng thái tải, mất kết nối, lỗi quyền/dữ liệu và nút Thử lại. Không fallback sang dữ liệu mẫu khi lỗi. Khi mất kết nối, các thao tác ghi bị chặn cho đến khi kết nối trở lại.
- Thêm/sửa/xóa/hoàn tác ghi lên Firebase bằng transaction và chỉ báo thành công sau khi Firebase xác nhận. Nếu bản ghi đã đổi từ client khác, yêu cầu cập nhật dữ liệu trước khi ghi đè.
- Thu tiền thuê giữ ID `year_month_apartmentId` với tháng không đệm số 0, giống bản HTML. Việc định kỳ dùng ID `recur_{taskId}_{date}` và transaction với `recurringRuns` để chống tạo trùng. Lịch được kiểm tra khi mở app, đổi ngày hoặc cập nhật lịch; chưa có tác vụ nền khi đóng app.
- Đăng xuất/đổi phiên dọn listener, dữ liệu và lịch sử hoàn tác trong bộ nhớ; bỏ qua callback muộn của phiên trước.
- Kho localStorage mẫu cũ không được đọc hoặc tự nhập lên Firebase. Fixture nằm trong `tests/fixtures/`, không được ứng dụng import. Không còn nút reset dữ liệu mẫu.

Các thay đổi nghiệp vụ trong bản Next.js cũng xuất hiện ở bản cũ dùng cùng project và UID. Không có thay đổi tới namespace khác, hosting, Authentication provider hoặc Security Rules của phần mềm kia.

## Chức năng

| Trang | Chức năng |
|---|---|
| `/` | Thu/chi/lợi nhuận, công nợ, sức khỏe kinh doanh, việc ưu tiên, xem trước báo cáo |
| `/sale` | Pipeline, lọc/tìm khách, thêm/sửa/xóa, chuyển giai đoạn, Customer 360, script Zalo |
| `/accounting` | Giao dịch, lọc tháng/mảng, chi ứng, biểu đồ, phân tích công thức, điền form từ câu giao dịch/giọng nói |
| `/debts` | Công nợ, đã thu, lọc quá hạn/7 ngày tới/đã thu đủ |
| `/operations` | Todo, follow-up, căn hộ, hợp đồng, thu tiền thuê, lịch định kỳ, nhật ký/hoàn tác |
| `/reports` | Báo cáo tháng, so sánh, tổng hợp theo mảng, in/PDF, xem trước Telegram |
| `/settings` | Trạng thái/tải lại Firebase, cài đặt AI thử nghiệm, xem trước Telegram |
| `/login` | Đăng nhập Firebase Auth thật |

Backup JSON tương thích Business Hub v1/v2/v3, xuất đủ 11 collection và email tài khoản hiện tại. Import xác thực trước khi ghi, có bước xác nhận, gộp theo ID và giữ các bản ghi không có trong backup. Import nhiều batch báo số bản ghi đã ghi nếu có lỗi một phần; không tuyên bố đã hoàn tất khi Firebase từ chối. Lịch sử file xuất lưu trong trình duyệt, undo giữ tối đa thao tác gần nhất trong phiên.

## Tích hợp chưa bật

AI vẫn trả diễn giải mô phỏng có nhãn, dựa trên số liệu hiện tại; chưa gọi OpenRouter. Ô khóa AI thử không lưu/gửi khóa. Zalo chuẩn bị và sao chép script; chưa tự gửi tin. Web Speech và parser quy tắc có thể điền form để người dùng kiểm tra trước khi lưu.

Telegram đã có bộ gửi máy chủ và cấu hình Vercel Cron 07:00 giờ Việt Nam. Nội dung gồm việc hôm nay, việc quá hạn, nợ đến hạn trong 7 ngày tính cả hôm nay và thu/chi/lợi nhuận tháng hiện tại. Đã xác minh bot/nhóm chỉ đọc; chưa gửi tin hoặc kích hoạt lịch production vì thiếu Firebase Admin credential và deployment Business Hub trên Vercel. Không nạp token bot vào client hoặc thay webhook của bot đang dùng ở phần mềm kia. Xem [hướng dẫn bật lịch](docs/telegram-setup.md).

Máy chủ AI chưa bật. Telegram dùng `/api/cron/telegram` được bảo vệ bằng `CRON_SECRET`, journal chống trùng tại `users/{uid}/telegramReports/{date}` và Firebase Admin xác minh chủ sở hữu. Bật `TELEGRAM_REPORT_ENABLED=true` ở Vercel Production sau khi cấu hình credential; root directory là thư mục gốc (`.`). Vercel Hobby có thể gửi trong khoảng 07:00–07:59; Pro hỗ trợ trong phút 07:00. Khi triển khai cùng domain bản HTML, cần xử lý service worker cũ trước khi chuyển.

## Kiểm tra

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Kiểm thử dùng Firebase gateway giả và Firestore mock, không ghi fixture lên cloud. Bao gồm nghiệp vụ, tương tác, auth, listener cleanup, không nạp mẫu, lỗi/quyền, transaction, ID dữ liệu tương thích, import, hoàn tác và báo cáo Telegram. Bộ kiểm thử HTML cũ đã được loại bỏ.

Đọc dữ liệu cloud thật cần người dùng đăng nhập trong trình duyệt. Kết quả kiểm thử giả lập và HTTP không thay thế xác minh phiên đăng nhập/dữ liệu production thực tế.

## Cấu trúc

- `app/`: routes, layout, CSS.
- `components/hub-provider.tsx`: phiên đăng nhập, trạng thái đồng bộ và thao tác dữ liệu.
- `lib/firebase-client.ts`: cấu hình Firebase Web và SDK instance.
- `lib/firebase-store.ts`: auth, listener và transaction Firestore.
- `lib/cloud-data.ts`: adapter dữ liệu cũ và thông báo lỗi.
- `lib/domain.ts`, `lib/types.ts`: tính toán, validation và kiểu dữ liệu.
- `tests/fixtures/`: dữ liệu giả chỉ dành cho kiểm thử.

Xem [thiết kế](docs/superpowers/specs/2026-10-22-nextjs-migration-design.md), [kế hoạch Firebase](docs/plans/2026-10-22-firebase-live.md) và [kiểm tra cấu trúc thư mục gốc](docs/verification/2026-10-22-root-layout.md).
