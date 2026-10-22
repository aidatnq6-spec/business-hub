# Next.js tại thư mục gốc — 22/10/2026

## Thay đổi

- Toàn bộ ứng dụng hiện ở `D:\GitHub\business-hub`: `app/`, `components/`, `lib/`, `public/`, `scripts/`, `tests/`, package/lockfile, cấu hình Next.js/Vercel và các file môi trường. Không còn thư mục ứng dụng con.
- `package.json` ở gốc là package chính; `npm run dev`, build, test, lint và các lệnh Telegram chạy trực tiếp, không qua wrapper.
- Đã xóa HTML/PWA cũ (`index.html`, service worker, manifest), bộ kiểm thử HTML, hai script deploy HTML, tài liệu Word deploy HTML, báo cáo audit/sửa lỗi và biên bản dọn HTML đã lỗi thời. `public/` hiện chỉ chứa asset của Next.js.
- Giữ `.firebaserc` và `firestore.rules` vì vẫn dùng cho project Firebase/Firestore của Next.js. `firebase.json` chỉ còn cấu hình Firestore, đã bỏ phần Firebase Hosting HTML. Không thay đổi tài nguyên hoặc dữ liệu trên cloud.
- Dừng hai server theo vị trí cũ, xóa cache build cũ và build lại từ gốc. Đã khởi động lại dev server tại http://localhost:3000.
- Cập nhật đường dẫn `.secrets` trong script Telegram, thông báo Firebase, tài liệu và Vercel Root Directory thành thư mục gốc (`.`).
- Đối chiếu SHA-256 trước/sau khi chuyển: `.env.local` và toàn bộ file `.secrets/` giữ nguyên nội dung; các file này vẫn được Git bỏ qua. Không ghi credential vào báo cáo.

## Kiểm chứng

| Kiểm tra từ thư mục gốc | Kết quả |
|---|---|
| `npm test` | 97/97 đạt, 8 file kiểm thử Next.js |
| `npm run typecheck` | Đạt |
| `npm run lint` | Không lỗi/cảnh báo |
| `npm run build` | Đạt |
| `npm run dev` | Ready tại localhost:3000, project directory là thư mục gốc |
| HTTP 8 trang ứng dụng và `/icon.svg` | 200 |
| HTTP `/index.html`, `/sw.js`, `/manifest.webmanifest` | 404 |
| HTTP `/api/telegram/status` | 200 |
| HTTP `/api/cron/telegram` không xác thực | 401 |
| Quét 24 bundle client | Không chứa token Telegram, cron secret hoặc JSON service account đã cấu hình |
| Mã HTML/PWA, script deploy HTML và tham chiếu runtime đến thư mục con | Không còn |

22 kiểm thử chỉ dành cho HTML đã được xóa cùng mã cũ theo yêu cầu; 97 kiểm thử Next.js được giữ và chạy thành công. Không gửi tin Telegram hoặc ghi fixture lên Firebase trong đợt chuyển thư mục này.

Tích hợp Telegram vẫn chờ credential Firebase Admin và triển khai production như đã ghi trong [hướng dẫn bật lịch](../telegram-setup.md); việc chuyển thư mục không tự kích hoạt scheduler.
