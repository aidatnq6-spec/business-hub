# Firebase Live Implementation Plan

> Thực hiện trực tiếp trong phiên hiện tại theo yêu cầu dùng dữ liệu Firebase thật; không tạo commit hoặc triển khai cloud.

**Goal:** Thay dữ liệu mẫu bằng dữ liệu Firestore của tài khoản chủ sở hữu hiện có.

**Architecture:** Firebase Web SDK dùng cấu hình công khai từ `.env.local`, Firebase Auth email/password và listener theo `users/{uid}/{collection}`. Không seed, không fallback mock, không sửa rules hoặc truy cập namespace phần mềm khác. Dữ liệu mẫu chỉ còn làm fixture kiểm thử.

**Tech Stack:** Next.js App Router, React, TypeScript, Firebase Auth/Firestore, Vitest.

### 1. Firebase adapter và cấu hình

- Tạo `nextjs-app/lib/hub-gateway.ts`, `firebase-client.ts`, `firebase-store.ts`, `cloud-data.ts`.
- Cài Firebase SDK; cập nhật `.env.example`; chuyển riêng các trường Firebase Web từ `.secrets/firebase.env` sang `.env.local`, không đưa khóa Telegram/OpenRouter vào client.
- Adapter chuẩn hóa Timestamp, số tiền cũ, ID tài liệu và các trường tùy chọn; báo lỗi dữ liệu thay vì âm thầm bỏ bản ghi. Listener không lọc theo createdAt để tránh mất bản ghi cũ.
- Kiểm thử bằng gateway giả/Firestore mock, không ghi fixture lên cloud.

### 2. Provider và đăng nhập

- Thay `components/demo-provider.tsx` bằng `hub-provider.tsx`, cập nhật toàn bộ import.
- Dọn listener và dữ liệu khi đổi phiên, từ chối tài khoản ngoài chủ sở hữu, hiển thị trạng thái tải/lỗi/offline và cho thử lại.
- Không đọc localStorage chứa mock, không tạo tài khoản mới. Đăng nhập/đăng xuất dùng Firebase Auth thật.

### 3. Các thao tác ghi

- Save/delete/undo dùng transaction, phát hiện bản ghi đã bị sửa từ client khác, chỉ thông báo thành công sau khi commit.
- Giữ ID định kỳ `recur_{id}_{date}` và thu tiền thuê `year_month_apartmentId` tương thích bản cũ; transaction chống trùng.
- Import xác thực toàn bộ trước khi merge theo ID, batch có báo tiến độ/thất bại một phần. Không tự nhập dữ liệu mẫu.
- Form chờ kết quả save/delete/import; không đóng khi thất bại. Bỏ reset mẫu; backup dùng email thật.

### 4. Kiểm chứng và tài liệu

- Bổ sung kiểm thử auth, listener cleanup, lỗi/quyền, rỗng, không seed mock, ghi thất bại, transaction và dữ liệu cũ.
- Chạy `npm test`, `npm run test:legacy`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Kiểm tra HTTP login và route chính. Việc đọc dữ liệu cloud thực tế cần người dùng đăng nhập trong trình duyệt; ghi rõ giới hạn nếu môi trường không có phiên đó.
- Cập nhật README và thiết kế: Firebase thật được bật; AI/Telegram vẫn chưa gọi dịch vụ thật.
