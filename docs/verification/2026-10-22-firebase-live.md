# Kiểm chứng Firebase client — 22/10/2026

## Đã thực hiện

- Thay provider dữ liệu mẫu bằng Firebase Auth/Firestore client; giữ project và đường dẫn tài khoản của bản cũ. Cấu hình Firebase Web đã chuẩn bị trong `.env.local` ngoài Git.
- Tải đủ 11 collection bằng listener, không lọc theo createdAt, không seed hoặc đọc kho mock localStorage. Fixture chỉ nằm trong `tests/fixtures/`.
- Ghi/hoàn tác bằng transaction, phát hiện thay đổi đồng thời; giữ Timestamp và trường bổ sung. Thu tiền thuê dùng ID tháng không đệm giống bản cũ; việc định kỳ dùng ID/dấu chạy tương thích bản cũ.
- Form chờ xác nhận Firebase; lỗi ghi không đóng editor. Import xác thực/encode toàn bộ trước ghi, merge theo ID và báo số bản ghi đã ghi nếu batch sau thất bại.
- Không thay đổi/deploy Firestore Rules, hosting, tài khoản hoặc webhook Telegram. Không ghi dữ liệu thử lên cloud.

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| Vitest/Testing Library, Firebase gateway giả và Firestore mock | 57/57 đạt |
| Hồi quy HTML cũ | 22/22 đạt |
| TypeScript | Đạt |
| ESLint | Không lỗi/cảnh báo |
| Production build | Đạt; đọc `.env.local` |
| HTTP dev 8 trang | 200 |
| Bundle production chứa bộ dữ liệu mẫu | Không tìm thấy các tên/mã fixture đã kiểm tra |
| `.env.local` và `.secrets/*.env` | Được Git bỏ qua |
| `npm audit --omit=dev` | 0 lỗ hổng |

Firebase SDK cài ở phiên bản 13.1.0. Đã override `@grpc/grpc-js` sang `^1.14.6` để xử lý cảnh báo phụ thuộc mới; không force hạ Firebase. Full audit còn 5 cảnh báo high thuộc chuỗi công cụ lint đã có từ giai đoạn trước, không thuộc phụ thuộc production.

## Giới hạn xác minh

Không có trình duyệt kết nối với môi trường agent (inventory trả danh sách rỗng), và không có phiên Firebase của người dùng để đọc dữ liệu thật. Chưa xác nhận số lượng bản ghi, schema thực tế hoặc các quyền đang triển khai trên cloud sau đăng nhập. Không coi kiểm thử mock/HTTP là E2E production. Người dùng mở `/login`, đăng nhập bằng tài khoản chủ sở hữu hiện có; chỉ báo “Firebase · Đã đồng bộ” sau khi nhận đủ snapshot từ server. Lỗi quyền, cấu hình hoặc dữ liệu được hiển thị để xử lý, không fallback mock.

AI vẫn mô phỏng trên số liệu hiện tại; Telegram vẫn chỉ xem trước, chưa gửi thật hoặc kích hoạt lịch 07:00.
