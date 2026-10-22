# Cài đặt AI thật cho Business Hub

Màn hình `/settings` quản lý kết nối Gemini, model tự chọn theo công việc và ngân sách Marketing. Khóa người dùng nhập được mã hóa AES-256-GCM ở máy chủ; chỉ trả metadata/suffix, không có API xem lại khóa. Firebase Admin của dự án phải được cấu hình như hướng dẫn Marketing.

## Chuẩn bị cục bộ

Chạy `npm run ai-settings:prepare` một lần rồi khởi động lại dev server. Lệnh operator này tạo khóa chủ 32 byte trong `.env.local` nếu chưa có; giữ nguyên khóa hợp lệ đã có và không in giá trị ra terminal. Runtime/build không tự sinh khóa chủ. `.env.local` và `.secrets` tiếp tục bị Git/Vercel upload bỏ qua.

Giữ an toàn bản sao khóa chủ ở nơi quản lý bí mật phù hợp. Khóa chủ mã hóa khác API key Gemini: người dùng nhập API key Gemini tại Cài đặt AI sau này, không dán khóa chủ vào ô API key.

## Trên Vercel và worker

Thiết lập `AI_SETTINGS_ENCRYPTION_KEY` dưới dạng Secret server, base64 của đúng 32 byte ngẫu nhiên; cùng giá trị trên Vercel và worker. Không prefix NEXT_PUBLIC, không lưu trong Firestore hoặc Terraform state. Chỉ chuyển bí mật tới dịch vụ đã được chủ sở hữu cho phép. Chưa thực hiện cấu hình production này trong đợt code.

`AI_SETTINGS_ORIGIN` là origin chính xác của app, ví dụ `https://business-hub-by3w.vercel.app`. Có thể dùng biến hệ thống `VERCEL_PROJECT_PRODUCTION_URL` khi Vercel cung cấp. Không lấy Host header của request làm allowlist. Local development chấp nhận localhost/127.0.0.1 cổng 3000; môi trường production cần allowlist cấu hình.

Firestore credential ở root `privateAiCredentials/{uid}/providers/gemini`; rules chặn hoàn toàn client SDK, kể cả chủ sở hữu. Audit/rate limit cũng nằm root riêng. Admin server/worker được phép đọc theo quyền dịch vụ; không thêm recursive owner allow vào các root này. Settings công khai nằm `users/{uid}/marketingSettings/ai`, chỉ server ghi.

## Sử dụng

1. Đăng nhập bằng chủ sở hữu, vào Cài đặt AI, chọn Thêm API key Gemini. Chưa có khóa thì AI vẫn bị chặn. Không dùng khóa OpenRouter ở ô Gemini.
2. Lưu/thay khóa không gọi AI và không bật cờ. Sau lưu chỉ thấy vài ký tự cuối. Xóa cần xác nhận; xóa credential ứng dụng không thu hồi khóa ở Google. Tombstone ngăn tự dùng lại khóa env cũ.
3. Kiểm tra kết nối mặc định bị chặn tới khi phép GET metadata được xác minh phù hợp điều kiện tính phí. Xem `docs/ai-settings-provider-validation.md`; chỉ bật `AI_SETTINGS_METADATA_CHECK_VERIFIED=true` sau bước đó. Kiểm tra metadata không chứng minh toàn bộ quá trình tạo nội dung thành công.
4. Cập nhật hạn mức có xác nhận; hiệu lực tháng hiện tại và mặc định tháng sau, không cho thấp hơn đã chi + giữ chỗ. 0 đồng chặn tác vụ có phí. Mốc 80% dùng tổng đã ghi nhận và giữ chỗ; tháng theo giờ Việt Nam. Khoản chưa rõ chi phí giữ nguyên chờ đối soát.
5. `AI_SETTINGS_ACTIVATION_APPROVED`, `MARKETING_ENABLED`, `MARKETING_GENERATION_ENABLED`, `MARKETING_SCHEDULE_ENABLED`, `MARKETING_TELEGRAM_ENABLED` giữ false. Thêm khóa không tự đổi chúng. Bảng giá còn hiệu lực, phê duyệt chi phí `MARKETING_PRICES_VALID_UNTIL`, kho, queue/worker, giọng và `MARKETING_TTS_VOICE_APPROVED` là điều kiện riêng.

Màn hình hiển thị desired/effective từ cùng guard mà worker/API dùng. Chưa có phê duyệt mới thì không chạy thử trả phí, không bật lịch 20:00/08:00. Báo cáo kinh doanh 07:00 có cấu hình riêng và không bị đổi.

## Đổi khóa, mất khóa chủ và tác vụ lỗi

- Thay API key tăng revision và xóa kết quả kiểm tra cũ. Tác vụ khóa model/giá/credential revision khi bắt đầu chạy. Guard kiểm tra lại trước khi gửi provider; không cache plaintext giữa job.
- Tác vụ chưa gửi: failure và giải phóng reservation được ghi nguyên tử, sau đó có thể Retry có kiểm soát và lấy snapshot mới. Tác vụ đã có khả năng gửi/bị tính phí không tự retry. Một scene speech đã thành công khiến các lỗi scene sau giữ chi phí uncertain, không hoàn nguyên cả khoản giữ chỗ.
- Mất/sai master key: runtime báo không giải mã được, không overwrite ciphertext. Không có UI rotate master. Khôi phục từ bản sao secret hợp lệ, hoặc cấu hình master mới rồi yêu cầu người dùng nhập lại API key; backup Firestore một mình không đủ. Khóa master cũ không được đưa cho trình duyệt.
- Đã gửi request ra nhà cung cấp thì đổi/xóa key trong app không thu hồi request đó hoặc tự hoàn phí; cần đối soát ledger/hóa đơn. Giá hết hạn chặn tác vụ mới. Usage thiếu không được coi là miễn phí.

## Kiểm chứng

`npm run test`, `npm run test:marketing-rules`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run marketing:worker:build`, `npm run marketing:worker:check`.

Các test tự động dùng fake provider hoặc Firebase Emulator project demo, không dùng API key thật. Kiểm tra browser thật với tài khoản chủ cần người dùng đăng nhập; không mint token để giả danh. Trước deploy, kiểm tra `.vercelignore` và cấu hình master ở cả API/worker; chưa deploy chỉ vì unit test đạt. Không gửi tin Telegram thật để test nếu chưa được yêu cầu.
