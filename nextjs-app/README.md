# Business Hub — Next.js, dữ liệu mẫu

Bản giao diện và nghiệp vụ React/Next.js độc lập trong `nextjs-app/`. Sáu phần chính đã được chuyển sang component React, dùng stylesheet, bảng màu, font và thư viện script Zalo của bản HTML làm nền. Bản HTML chuẩn được giữ tại `../public/index.html`; Firebase Hosting hiện tại vẫn dùng thư mục `public/`. Các bản chụp cũ, ZIP triển khai cũ và bản HTML trùng ở gốc đã được xóa theo xác nhận của người dùng. Xem [kết quả rà soát file dư thừa](../docs/cleanup-2026-10-22.md).

## Chạy ứng dụng

Yêu cầu Node.js từ 22.13 trở lên; đã kiểm tra trên Node 25.9.0, npm 11.12.1.

```powershell
Set-Location D:\GitHub\business-hub\nextjs-app
npm.cmd ci
npm.cmd run dev
```

Mở http://localhost:3000. Mặc định vào ngay phiên dùng thử. Trang `/login` cho phép vào lại sau khi đăng xuất, không cần tài khoản hoặc mật khẩu thật.

Chạy bản production:

```powershell
npm.cmd run build
npm.cmd start -- --hostname 127.0.0.1 --port 3100
```

## Các màn hình và thao tác

| Trang | Chức năng với dữ liệu mẫu |
|---|---|
| `/` | Thu/chi/lợi nhuận, công nợ, sức khỏe kinh doanh, việc ưu tiên, briefing, xem trước AI/Telegram |
| `/sale` | Kanban 5 giai đoạn, lọc/tìm khách, thêm/sửa/xóa, chuyển giai đoạn, Customer 360, script theo mảng/giai đoạn, mẫu nhanh, sao chép nội dung |
| `/accounting` | Giao dịch thu/chi, sửa/xóa, chi ứng, lọc tháng/mảng, biểu đồ 6 tháng, tỷ trọng mảng, dự báo công thức, nhập câu giao dịch/giọng nói |
| `/debts` | Thêm/sửa/xóa công nợ, cập nhật đã thu, lọc còn nợ/quá hạn/7 ngày tới/đã thu đủ, kiểm tra số tiền |
| `/operations` | Todo, lọc ngày/ưu tiên/trạng thái, follow-up, căn hộ/hợp đồng, trạng thái thu tiền thuê từng tháng, lịch định kỳ, nhật ký và hoàn tác |
| `/reports` | Báo cáo tháng, so sánh tháng trước, tổng hợp mảng, top giao dịch, hiệu suất sale, in/PDF, xem trước Telegram |
| `/settings` | Model AI như danh sách cũ, ô nhập khóa thử không lưu/gửi, xem trước Telegram, khôi phục dữ liệu mẫu |
| `/login` | Phiên đăng nhập mô phỏng, không xác thực Firebase |

Thanh tiêu đề có tìm kiếm toàn cục, nhắc việc và Backup/Restore. Tìm kiếm hỗ trợ Ctrl/Cmd+K, phím mũi tên, Enter và Escape. Các hộp thoại có nhãn, quản lý focus và hỗ trợ Escape. Có thanh điều hướng dưới trên màn hình nhỏ.

## Dữ liệu mẫu và cách lưu

- `lib/demo.ts` tạo dữ liệu tổng hợp theo ngày hiện tại tại Việt Nam; tất cả tên khách đều là dữ liệu mẫu.
- Khóa lưu riêng: `business-hub:next:mock:v1`. Không đọc/ghi các khóa của bản HTML hoặc dữ liệu Firebase thật.
- Lịch sử export: `business-hub:next:demo-backup-history`. Model thử lưu trong sessionStorage. Undo giữ thao tác gần nhất trong phiên; nhật ký thao tác trong phiên có tối đa 60 mục.
- Refresh giữ các thay đổi mẫu. Có thể dùng Cài đặt → Khôi phục dữ liệu mẫu để quay về bộ ban đầu.
- JSON backup tương thích định dạng Business Hub v1/v2/v3; xuất đủ 11 collection, kể cả nhóm lưu trữ không còn trang riêng. Import kiểm tra trước khi ghi, gộp theo ID và giữ `createdAt`, không xóa bản ghi ngoài backup.
- Luồng todo cũ có `done`, `status` hoặc cả hai; giao dịch cũ có `type/amount` được đọc cùng giao dịch `thu/chi`.

## AI, Zalo, Telegram và giọng nói trong giai đoạn này

**Không có kết nối Firebase, OpenRouter hoặc Telegram thật.** Ứng dụng không đọc các file trong `.secrets/`, không chứa token bot/chat đích, không dùng khóa thật và không tạo scheduler.

- AI trả kết quả mô phỏng có nhãn rõ ràng. Model và ô API key giữ luồng thao tác để thử giao diện; khóa nhập thử được xóa sau khi bấm lưu, không gửi hoặc lưu trữ.
- Zalo chỉ chuẩn bị/sao chép script, không mở cuộc trò chuyện với khách mẫu hoặc gửi tin.
- Telegram hiển thị báo cáo từ dữ liệu mẫu với lịch dự kiến 07:00 hằng ngày, timezone `Asia/Ho_Chi_Minh`. Nội dung gồm việc hôm nay, việc quá hạn, nợ đến hạn từ hôm nay đến ngày thứ sáu tiếp theo và thu/chi/lợi nhuận tháng hiện tại. Việc định kỳ đến hạn được tạo trước khi tổng hợp, chống trùng bằng ID và lịch sử chạy.
- Nhập giọng nói có nút dùng Web Speech của trình duyệt nếu được hỗ trợ, cùng ô nhập transcript thay thế. Phân tích transcript chạy bằng quy tắc cục bộ, nhận số viết bằng chữ số và đơn vị nghìn/triệu; chưa thay thế khả năng hiểu ngôn ngữ đầy đủ của AI. Chỉ điền form, người dùng kiểm tra rồi bấm lưu.
- Lịch định kỳ giữ quy tắc bản hiện tại: chỉ tạo khi ngày/thứ/tháng khớp; không tự bù ngày 31 vào tháng thiếu ngày và không tự sinh việc của các ngày đã bỏ lỡ. Nhãn lặp của todo được bảo toàn; tạo việc tự động nằm ở phần Nhắc việc định kỳ.

## Kiểm tra

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Đã đạt **37 kiểm thử** gồm logic nghiệp vụ và tương tác React bằng Vitest/Testing Library/jsdom. Có các ca tạo/sửa/xóa/undo, giữ dữ liệu khi remount, hoàn thành todo, thu tiền thuê, định kỳ không trùng, nhập giọng nói mẫu, backup preview/import/export, HTML không tin cậy, tìm kiếm bàn phím, phiên demo và bảo đảm AI/Telegram không gọi mạng.

Các route được kiểm tra HTTP trên production server local: 8 trang trả 200, icon trả 200, đường dẫn không tồn tại trả 404. Đây không phải kiểm thử browser E2E. Môi trường không có trình duyệt kết nối nên chưa kiểm tra ảnh chụp, canvas thật, micro thật, in thực tế hoặc độ trùng giao diện theo pixel trên desktop/mobile.

Kiểm thử bản HTML cũ: từ thư mục gốc chạy `node --test tests/business-hub.test.cjs`; 22 ca vẫn đạt.

## Cấu trúc mã

```text
app/                  Routes, layout, CSS gốc và phần bổ sung cho React
components/           Sáu màn hình, editor, modal, provider và tiện ích
lib/types.ts          Kiểu dữ liệu và schema Zod
lib/domain.ts         Tính toán, validation, mutation/undo, backup, báo cáo
lib/demo.ts           Dữ liệu tổng hợp
lib/mock-ai.ts        AI và parser transcript mô phỏng
lib/scripts.ts        Script Zalo/mẫu nhanh được chuyển từ bản HTML
lib/models.ts         Danh sách model để giữ giao diện cài đặt
tests/                Regression nghiệp vụ và kiểm thử tương tác React
```

Font được đóng gói cục bộ bằng Fontsource; không cần tải Google Fonts lúc build. Chart.js chỉ được tải ở trang cần biểu đồ. Không nhúng HTML cũ bằng iframe hoặc `dangerouslySetInnerHTML`.

## Phần tích hợp thật còn lại

Giai đoạn tiếp theo sẽ thay kho dữ liệu mẫu bằng Firebase adapter, cấu hình danh tính máy chủ/UID, API AI có xác thực, kiểm tra quyền gửi Telegram, lịch chạy 07:00 và nền tảng hosting. Cần đối chiếu Security Rules/dữ liệu dùng chung trước khi triển khai; chưa thay đổi project hoặc bot đang phục vụ phần mềm kia. Khi chuyển cùng origin bản HTML, cần kế hoạch thay/ngừng service worker cũ.

Xem [kết quả kiểm tra](../docs/verification/2026-10-22-nextjs-mock.md) và [thiết kế](../docs/superpowers/specs/2026-10-22-nextjs-migration-design.md).
