# Cài đặt Marketing Studio Đạt Nguyễn

Phần Cài đặt AI thật (nhập khóa Gemini mã hóa, tự chọn model và hạn mức Marketing) được hướng dẫn tại [ai-settings-setup.md](ai-settings-setup.md). Cấu hình khóa trong ứng dụng thay thế env khi đã lưu; xóa có tombstone, không tự khôi phục qua khóa env cũ. Các cờ tạo nội dung/lịch tiếp tục giữ tắt.

Marketing được bổ sung ở `/marketing`, sử dụng Firebase Auth chủ sở hữu hiện tại. Dữ liệu Marketing nằm riêng dưới `users/{uid}/marketing*`. Không dùng dữ liệu mẫu khi API hoặc Firebase chưa sẵn sàng.

## Khi màn hình báo thiếu Firebase Admin

Thanh tiêu đề Firebase đã đồng bộ chỉ xác nhận kết nối của trình duyệt. API Marketing cần danh tính Firebase Admin ở máy chủ để xác minh đăng nhập và truy cập dữ liệu; cấu hình Web apiKey/appId không thay thế danh tính này.

Trên máy Windows hiện tại, file `.secrets/firebase-service-account.json` chưa có và `marketing:check` báo thiếu danh tính Admin. Cách bổ sung:

1. Firebase Console → đúng project Business Hub → Cài đặt dự án → Tài khoản dịch vụ → Firebase Admin SDK → tạo khóa riêng, tải JSON. Chỉ thực hiện bằng tài khoản có quyền quản lý phù hợp. [Hướng dẫn chính thức](https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments).
2. Đặt file JSON tại `D:/GitHub/business-hub/.secrets/firebase-service-account.json`; thư mục `.secrets` đã được Git bỏ qua. Không dán nội dung private key qua chat hoặc đưa vào mã trình duyệt.
3. Thêm dòng dưới vào `.env.local` ở thư mục gốc (nếu đang dùng một phương thức Admin hợp lệ khác thì kiểm tra phương thức đó, không cần cấu hình trùng):

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=D:/GitHub/business-hub/.secrets/firebase-service-account.json
```

4. Khởi động lại `npm run dev`, chạy `npm run marketing:check` và tải lại `/marketing`. Chưa cần bật các cờ AI/lịch tự động để dùng hồ sơ/kế hoạch thủ công. Việc kết nối thật chỉ được xác nhận sau khi app đăng nhập và API đọc được dữ liệu.

Trên Vercel dùng credential máy chủ theo hướng dẫn triển khai, thường là `FIREBASE_SERVICE_ACCOUNT_JSON`; đường dẫn ổ D của máy cá nhân không dùng được trên Vercel. Không cần sửa Firebase rules thành public để khắc phục lỗi này.

## Chạy và kiểm tra cục bộ

```powershell
npm install
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
npm run marketing:worker:build
npm run marketing:estimate
npm run marketing:check
```

`marketing:check` chỉ kiểm tra sự hiện diện biến môi trường, không đọc/in giá trị khóa, không chứng minh API có quyền sử dụng và không tạo nội dung. `marketing:estimate` là tính toán offline theo giả định, không phải hóa đơn.

Kiểm tra MP4 thật bằng audio/hình tổng hợp cục bộ: `node scripts/check-marketing-render.mjs`. Kết quả ở `.firebase/marketing-render-check/`, bị Git bỏ qua. Đây là tư liệu kiểm thử, không phải nội dung AI hay sản phẩm Marketing thật. Script dùng dev dependencies `ffmpeg-static`, `ffprobe-static`; worker production dùng FFmpeg/font trong Docker image.

Kiểm tra rules bằng `npm run test:marketing-rules`; cần Java 21 trở lên, emulator local 127.0.0.1:8088, project demo. Máy phát triển đã dùng Java portable ở `.firebase/tools/java21`, không thay Java hệ thống. Nếu sandbox không cho đọc config Firebase CLI, dùng XDG_CONFIG_HOME riêng trong `.firebase/emulator-config`; không cần đăng nhập Firebase để chạy project demo. Không thay project demo bằng project production.

## Các phần phải cấu hình trước khi gọi AI thật

- Firebase Admin đúng project/owner, không phải Firebase Web API key. Không đưa service account hoặc bot token vào NEXT_PUBLIC.
- Gemini API key riêng cho tác vụ Marketing, model ứng viên đã kiểm tra quyền truy cập. Bảng giá hard-coded hiện chỉ chấp nhận `gemini-3.1-flash-lite` và `gemini-3.1-flash-lite-image`; thay model phải cập nhật và kiểm thử giá trước, không chỉ đổi env.
- `MARKETING_PRICES_VALID_UNTIL` phải là ngày tương lai sau khi đã rà giá và phụ phí. Tham số quy đổi 30.000 VND/USD và hệ số 1,2 trong adapter chỉ là giả định bảo thủ, không đồng nghĩa thuế/phí thực tế của tài khoản. Kiểm tra trước khi bật.
- Giọng `vi-VN-Neural2-*` thực sự có trong voices.list, được nghe và duyệt; không tự suy ra tên giọng hợp lệ từ pattern. Giọng không đúng loại không được gọi.
- Kho riêng tư, Cloud Tasks queue và Cloud Run worker đã triển khai với IAM riêng, secret và audience chính xác. Worker root là `services/marketing-worker/`; bundle bằng esbuild từ mã dùng chung, không chạy Next.js trong worker.
- Scheduler SA, full job IDs, origin HTTPS production. Bot Telegram dùng nhóm đã cấu hình, không cần thay webhook. Báo cáo 07:00 là luồng độc lập.

Mẫu biến môi trường không chứa bí mật ở `.env.example`. Các cờ `MARKETING_ENABLED`, `MARKETING_GENERATION_ENABLED`, `MARKETING_SCHEDULE_ENABLED`, `MARKETING_TELEGRAM_ENABLED` mặc định false. Env hiện có của phần mềm khác không bị chỉnh sửa.

## Triển khai có kiểm soát

Hạ tầng chưa được áp dụng; xem `infra/marketing/README.md` và `docs/marketing-costs.md`. Không chạy terraform apply/deploy cloud hay bật billing chỉ vì build local đã thành công. Terraform cần được validate và review plan trước khi áp dụng; chỉ sửa rules đã được kiểm tra, không thay toàn bộ project hoặc dữ liệu Firebase.

Vercel không cần cron Marketing trong `vercel.json`: Google Scheduler gọi `POST /api/marketing/schedule/prepare` và `/notify` bằng Google OIDC. Root Directory tiếp tục là thư mục gốc repo. Deploy worker bằng Docker context repo root, tránh đưa secrets vào image nhờ `.dockerignore`. Production worker dùng ADC service identity, không cần file khóa trên container.

Chỉ khi đầy đủ cấu hình và chi phí đã được duyệt: deploy API/rules/UI với cờ tắt → worker/queue/bucket/IAM → kiểm tra identity → benchmark có giới hạn → duyệt giọng/chi phí thực đo → bật generation → tạo/bật lịch. Không cam kết tin đến đúng giây 08:00; kiểm tra thời điểm gửi thực tế bằng journal.

## Bắt đầu sử dụng

1. Đăng nhập, vào Marketing Studio → Hồ sơ thương hiệu, nhập thông tin thật và duyệt hồ sơ.
2. Tạo lịch tháng, tự nhập tiêu đề hoặc dùng AI đề xuất khi đã kích hoạt. Chọn duyệt từng mục hoặc cả tháng; không tạo bài cho mục chưa duyệt.
3. Khi đủ cấu hình, lịch 20:00 chuẩn bị ngày hôm sau. Nút chuẩn bị hôm nay là hành động thủ công rõ ràng cho ngày hiện tại, không tạo bù tháng quá khứ.
4. Xem bài theo Facebook/Zalo/TikTok/YouTube, kiểm tra nguồn, sửa và lưu. Những sửa chưa lưu phải được lưu trước khi duyệt/tải.
5. Với video: xem/sửa kịch bản, gắn bản ghi thật nếu là hướng dẫn, duyệt kịch bản để tạo audio/MP4. Bản ghi upload chỉ được dùng sau bước kiểm tra media; bạn phải xác nhận quyền sử dụng và nội dung thao tác.
6. Duyệt thành phẩm rồi chuẩn bị gói ZIP, tải khi tác vụ xuất xong. ZIP chứa văn bản từng kênh, ảnh, MP4/SRT khi có và manifest. Bộ không video không được giả có tệp MP4.
