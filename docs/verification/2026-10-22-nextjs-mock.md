# Kết quả kiểm tra Business Hub Next.js — dữ liệu mẫu

Ngày 22/10/2026. Phạm vi được cho phép: giao diện, nghiệp vụ và kiểm thử bằng dữ liệu giả; không tích hợp dịch vụ thật.

## Luồng được kiểm tra

Người dùng mở một trang Next.js → component React đọc dữ liệu mẫu → thao tác form/checkbox → hàm nghiệp vụ kiểm tra và cập nhật dữ liệu → provider ghi localStorage riêng → giao diện, báo cáo và backup phản ánh dữ liệu mới. Các thao tác AI, Zalo và Telegram kết thúc ở kết quả mô phỏng hoặc bản xem trước.

## Bằng chứng

| Kiểm tra | Kết quả |
|---|---|
| `npm.cmd run test -- --reporter=dot` | 2 file, 37/37 ca đạt |
| `npm.cmd run typecheck` | Exit 0 |
| `npm.cmd run lint` | Exit 0, không lỗi/cảnh báo |
| `npm.cmd run build` | Next.js 16.4.2, compile/typecheck/prerender thành công |
| HTTP `/`, `/sale`, `/accounting`, `/debts`, `/operations`, `/reports`, `/settings`, `/login` | Tất cả trả 200 trên production server local |
| HTTP `/icon.svg` | 200, `image/svg+xml` |
| HTTP `/route-not-found` | 404 |
| Header `X-Powered-By` | Không có |
| Quét 121 file nguồn/static bundle với giá trị cấu hình Firebase/Telegram đã cung cấp | Không có giá trị cấu hình nào được sao chép vào bản demo |
| `node --test tests/business-hub.test.cjs` của bản HTML | 22/22 ca đạt |
| `index.html` gốc so với `public/index.html` gốc | Vẫn trùng nhau; không bị thay bởi bản Next.js |
| `npm.cmd audit --omit=dev` | 0 advisory với dependency production |

Kiểm thử tương tác dùng các component thực tế với jsdom. Bao gồm validation trước lưu, thu/chi theo schema cũ và mới, các mốc tháng/ngày Việt Nam, todo hoàn thành theo `done/status`, công nợ hôm nay đến sáu ngày tiếp, định kỳ tuần/tháng/năm và chạy trùng, thu tiền thuê theo tháng, undo chống đè sửa mới, merge backup giữ timestamp, tên chứa HTML được render như văn bản, bàn phím tìm kiếm/modal, đăng nhập/đăng xuất mô phỏng và không gọi fetch từ AI/Telegram.

## Giới hạn đã ghi nhận

- Browser inventory không có trình duyệt kết nối. Chưa xác minh screenshot, responsive bằng ảnh, hydration/charts trên trình duyệt thật, micro hoặc in/PDF thực tế. HTTP thành công không thay thế browser E2E.
- Chưa có API/backend Firebase hoặc scheduler Telegram hoạt động trong bản này. Báo cáo 07:00 chỉ là preview và quy tắc đã được kiểm thử. Không có tin nhắn thật được gửi.
- Full `npm audit` còn 5 advisory mức high trong chuỗi công cụ lint `eslint-config-next` → `fast-glob` → `micromatch` → `braces`. Phiên bản `braces` được registry trả về là 3.0.3, cũng thuộc advisory `GHSA-vfj7-8cjw-p6xm`; bản được npm đề xuất là hạ major `eslint-config-next`. Không chạy `audit fix --force` để tránh phá cấu hình Next.js. Các dependency này chỉ dùng cho phát triển; audit production riêng đạt 0. Cần rà lại khi có bản vá và trước khi xử lý pattern/file không tin cậy trong CI.
- Dữ liệu mẫu lưu trên trình duyệt theo key riêng, không đồng bộ giữa các thiết bị. Undo giữ một thao tác trong phiên, không phải hệ thống lịch sử đa người dùng.

Môi trường kiểm tra: Windows, Node 25.9.0, npm 11.12.1. Thư viện được khóa trong `nextjs-app/package-lock.json`.
