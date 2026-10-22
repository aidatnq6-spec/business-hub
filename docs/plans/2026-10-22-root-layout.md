# Đưa Next.js lên thư mục gốc

**Goal:** Một ứng dụng Next.js duy nhất tại `D:\GitHub\business-hub`, bỏ mã HTML/PWA và công cụ triển khai HTML.

**Architecture:** Chuyển nguyên trạng mã nguồn, package/lockfile, node_modules, cấu hình và `.env.local` từ thư mục con lên gốc; xóa cache build theo đường dẫn cũ. Giữ `.git`, `.secrets`, Firebase project mapping và Firestore Rules dùng cho Next.js. Cấu hình Firebase CLI chỉ còn Firestore, không còn Hosting HTML.

## Các bước

1. Dừng hai dev/preview server của workspace để giải phóng file và build cache.
2. Xác minh đường dẫn tuyệt đối của từng mục xóa/chuyển đều nằm trong workspace. Xóa public HTML/PWA cũ, bộ kiểm thử HTML, hai script deploy HTML, tài liệu Word deploy HTML và tài liệu audit/sửa lỗi HTML đã lỗi thời. Không thay đổi dữ liệu Firebase hoặc tài nguyên đã deploy.
3. Chuyển các thư mục/files Next.js lên gốc. Thay package/README wrapper bằng bản chính, giữ đầy đủ sửa đổi hiện có. Xóa thư mục con rỗng, cache `.next` và tsbuildinfo theo đường dẫn cũ.
4. Sửa đường dẫn `.secrets` trong script Telegram, thông báo cấu hình Firebase, README/tài liệu và Vercel Root Directory (`.`). Giữ fixture kiểm thử trong `tests/fixtures`.
5. Chạy test, lint, typecheck và production build từ gốc; chạy dev tại localhost:3000. Kiểm tra login/API, không còn HTML/PWA cũ, không còn tham chiếu runtime đến thư mục con và không lộ secret ở bundle client.
