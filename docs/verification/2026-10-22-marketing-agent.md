# Xác minh Marketing Studio ngày 22/10/2026

## Mã đã triển khai cục bộ

- Route `/marketing` và mục điều hướng trong Business Hub. Hồ sơ thương hiệu, lịch 90 mục/45 video, duyệt toàn bộ hoặc từng mục, biến thể bốn kênh, sửa bài/kịch bản, kiểm chứng nguồn, upload bản ghi và xuất gói sau duyệt.
- API chỉ chủ sở hữu Firebase, expectedRevision, dấu phiên bản thương hiệu/kế hoạch, nhật ký duyệt. Thay đổi nội dung không giữ duyệt cũ; kết quả worker lỗi thời không ghi đè bản mới. Client không ghi thẳng được namespace Marketing.
- Agent pipeline hữu hạn: kế hoạch → bài → ảnh → chờ duyệt script → audio theo đoạn → MP4/SRT → duyệt thành phẩm → ZIP. Không có runtime mock, không tự đăng mạng xã hội.
- Adapter Gemini/TTS, reservation trước yêu cầu trả phí, sổ chi phí theo tháng Việt Nam, xử lý request không rõ kết quả, chống vượt hạn mức khi đồng thời và chuyển reservation chưa dùng ở thời điểm rollover.
- Outbox/Cloud Tasks, worker Cloud Run có FFmpeg, Scheduler OIDC 20:00/08:00, Telegram có journal riêng và chống gửi lặp/tuân thủ retry-after. Chưa thay cron báo cáo 07:00, token hoặc webhook bot.
- Bucket tài sản riêng tư, URL ngắn hạn, kiểm tra media/hash, ZIP chứa ảnh/video/phụ đề thật theo manifest đã duyệt. Input không truyền vào shell và không được dùng làm đường dẫn tùy ý.

## Đã chạy

- Bộ kiểm thử Vitest hiện có và Marketing mới: **126/126 đạt, 14 test files**. Emulator chạy bằng cấu hình riêng, không được tính như test bị bỏ qua trong suite thường.
- `npm run lint`, `npm run typecheck`, `npm run build` và `npm run marketing:worker:build`.
- `npm run test:marketing-rules`: **3/3 đạt**, project demo `demo-business-hub-marketing`, Java21 portable, localhost8088. Không truy cập dữ liệu Firebase thật. Kiểm tra quyền owner read, cấm write namespace Marketing, cấm truy cập của user khác và giữ quyền ghi collection nghiệp vụ cũ, kể cả nested path.
- Worker smoke: `/health` trả200; POST thiếu OIDC trả401, không gọi Firebase/provider. Worker bundle chạy với `--conditions=react-server`.
- Dev server đã chạy tại localhost3000. Kiểm tra HTTP thực: `/marketing` trả200, `/api/marketing/status` và `/api/marketing/dashboard` trả401 khi không có token. Log máy chủ xác nhận các request này, không lỗi runtime. Chưa chứng minh luồng sau đăng nhập với Firebase thật.
- Renderer smoke: MP4 từ ảnh và âm thanh tổng hợp cục bộ, **1080×1920, H.264, AAC, khoảng32,022giây**; SRT có chữ Việt và timestamp dựa độ dài audio đo bằng ffprobe. Đã xem một frame, chữ có dấu hiển thị đúng. Audio là tone thử, không phải giọng đọc AI thật.
- Đã chạy thêm bước dựng ảnh vuông gắn tên thương hiệu và tiêu đề bằng FFmpeg trong smoke test. Ảnh/video kiểm thử ở `.firebase/marketing-render-check/`, không đưa vào dữ liệu thật hoặc Git.
- `marketing:estimate` tái lập300.720 VND cơ sở /451.080 VND với dự phòng50%, chỉ là giả định. `marketing:check` xác nhận các cờ local đều tắt và nhiều cấu hình vận hành còn thiếu; không in giá trị bí mật.
- Terraform1.17.0 portable, provider Google7.46.1: `init -backend=false`, `validate` thành công. Có lockfile provider. Chưa `plan` dùng tài khoản cloud hoặc `apply`.
- `npm audit --omit=dev`: không có advisory production ở lần kiểm tra này. Dev tooling vẫn có advisory từ chuỗi công cụ; không dùng audit fix --force hoặc nâng major không liên quan.

## Chưa kiểm chứng hoặc chưa kích hoạt

Cập nhật sau khi người dùng cung cấp file ngày 22/10/2026: file `.secrets/firebase-service-account.json` đã tồn tại đúng tên và bị Git bỏ qua. Đã chạy `telegram:prepare`: xác minh danh tính máy chủ/chủ sở hữu và cập nhật đường dẫn/UID/project trong `.env.local`, không gửi tin hay bật lịch. Đã kiểm tra chỉ đọc Firestore thành công với hồ sơ, kế hoạch và query bộ nội dung Marketing; hồ sơ thương hiệu chưa tồn tại, chưa ghi dữ liệu mới. Đã khởi động lại dev server để nạp credential. Kết quả này chỉ cho máy local, không đồng nghĩa Vercel đã có Admin credential.

- Chưa cấp Firebase Admin cho Marketing trên production. Local đã xác minh ở cập nhật phía trên; Firebase Web config không thay thế quyền máy chủ.
- Chưa có Gemini key Marketing, model/voice access được kiểm tra, chưa benchmark AI/TTS trả phí, chưa người dùng nghe và duyệt giọng. Không xác nhận chất lượng và định mức90/45 thực tế từ bộ test giả lập.
- Chưa tạo bucket, queue, worker, Scheduler job hay liên kết billing. Chưa kiểm tra giá SKU/region/billing/free quota và mức sử dụng egress thực của tài khoản.
- Chưa gửi tin Telegram thật hoặc quan sát lần chạy08:00. Lịch nhắm phút08:00 không phải bảo đảm giao đúng giây.
- Chưa triển khai thay đổi này lên Vercel/GitHub, chưa deploy Firestore rules lên production và chưa đăng nhập trình duyệt để kiểm tra data thật trên production. Xác nhận HTTP local không thay được E2E sau đăng nhập.
- Docker image chưa được build/chạy bằng Docker tại máy này; đã build và chạy Node worker bundle, kiểm tra FFmpeg local. Terraform validate không thay thế review plan/IAM và smoke cloud.

## Cách chạy tiếp

`docs/marketing-setup.md` mô tả lệnh và env; `docs/marketing-costs.md` mô tả dự toán còn phải xác minh; `infra/marketing/README.md` mô tả thứ tự cấp hạ tầng. Hoàn tất cấu hình, trình chi phí cụ thể và lấy chấp thuận kích hoạt trước khi bật bất kỳ tài nguyên trả phí/lịch thật nào. Không lấy việc phê duyệt thiết kế làm quyền tự đăng ký billing.
