# Kiểm chứng Cài đặt AI — 22/10/2026

Thiết kế nguồn: `docs/superpowers/specs/2026-10-22-ai-settings-design.md`. Kế hoạch: `docs/plans/2026-10-22-ai-settings-implementation.md`.

## Đã thực hiện

- Thay phần demo/sessionStorage bằng giao diện quản lý khóa Gemini, hạn mức và readiness thật.
- Credential dùng AES-256-GCM với AAD theo UID/provider/revision, root Firestore riêng, DTO explicit, tombstone không fallback env, kiểm soát Origin/owner/body/rate limit. Không có API lấy lại plaintext.
- Model chọn từ catalog theo năng lực và hạn giá; fallback trống. API Marketing và worker lấy cùng resolver và runtime guards. Tác vụ lưu snapshot revision/model/giá, không lưu plaintext.
- Hạn mức tháng hiện tại + mặc định tháng sau dùng cùng ledger; transaction bảo vệ sửa hạn mức/reserve, không reset về giá trị mặc định.
- Đã sửa các vấn đề từ rà soát độc lập: effective UI thống nhất runtime; free stages không cần Gemini; retry snapshot cho lỗi chưa gửi; failure/release nguyên tử; lỗi scene speech sau không xóa chi phí scene trước.

## Bằng chứng

- Lint, TypeScript, toàn bộ Vitest suite **199/199 kiểm thử đạt trong 29 file**. Test thêm bao gồm guard, crypto/AAD/tamper, credential revisions/tombstone, malformed JSON/deadline, form save/delete, budget, provider routing, readiness và retry.
- Firestore Rules Emulator: **5/5 đạt**, project `demo-business-hub-marketing`, host `127.0.0.1:8088`; kiểm tra private roots deny cả owner và anonymous. Kiểm tra transaction Firestore thật: 8 reservations đồng thời trên cap30.000 đồng chỉ chấp nhận2 reservations15.000, không vượt cap; không cho giảm dưới khoản đã giữ chỗ.
- Production build đạt, bao gồm `/api/ai-settings/[[...path]]`. Worker build/check đạt: health200, unauthorized401, paidApiCalled=false, cloudAccessed=false.
- Browser Chrome thật với fixture cô lập render chính `AiSettingsPanel` và CSS/module thật. Desktop load thành công; viewport390×844 cho document.scrollWidth390, dialog nhập khóa mở được, không có Runtime.exceptionThrown. Ảnh QA nằm trong `.superpowers/ai-settings-qa/` bị Git/Vercel bỏ qua. Fixture thay client bằng dữ liệu kiểm thử, không ghi Firebase hoặc gọi provider; không phải dữ liệu trong sản phẩm.
- Kiểm tra local app: `/settings`200; `/api/ai-settings` và `/api/marketing/status` trả401 JSON khi thiếu đăng nhập. Không giả danh chủ sở hữu để kiểm thử API thật.
- `npm run ai-settings:prepare` đã chuẩn bị master key cục bộ trong `.env.local`, không in khóa, không overwrite khóa hợp lệ; chưa đưa master mới lên Vercel/worker. Kiểm tra git ignore xác nhận `.env.local`, `.secrets` và fixture không được stage.

## Giới hạn và trạng thái vận hành

Chưa có API key Gemini từ người dùng; chưa thử create text/image/speech/video thật hoặc một luồng đăng nhập owner đầy đủ trên browser. Kiểm thử provider dùng fake fetch. Không seed dữ liệu giả vào Firebase thật.

`AI_SETTINGS_METADATA_CHECK_VERIFIED` mặc định false: phép kiểm tra metadata đã có code và test, nhưng chưa gọi ra ngoài khi chưa xác minh điều kiện tính phí. Khi bật sau review, chỉ GET metadata, không generateContent, không nhận prompt. Thành công chỉ xác nhận metadata.

`AI_SETTINGS_ACTIVATION_APPROVED` và cờ Marketing trả phí/lịch tiếp tục tắt. Chưa deploy thay đổi mới lên Vercel, chưa chuyển master secret, chưa apply rules/IAM/Terraform lên cloud, chưa gửi Telegram thật. Hướng dẫn cấu hình và quản lý mất master key: `docs/ai-settings-setup.md`.

## Cập nhật triển khai production sau kiểm chứng cục bộ

Theo yêu cầu tiếp theo của người dùng, commit `8d1732f` đã được triển khai lên dự án Vercel `business-hub-by3w`, deployment `dpl_CRjfZvSEWhWBMzUag6LktFfeJqQB`, trạng thái READY, alias `https://business-hub-by3w.vercel.app`. Đã kiểm tra `/settings`200 và bundle có UI mới, không còn ô khóa demo; hai API settings/Marketing trả401 JSON khi chưa đăng nhập, không còn phản hồi rỗng500.

Đã thêm `AI_SETTINGS_ORIGIN` cho production. Người dùng chọn tự cấu hình khóa mã hóa; agent không đưa master key mới lên Vercel. File khóa production chuẩn bị cục bộ ở `.secrets/ai-settings-production-encryption-key.txt` bị Git/Vercel upload bỏ qua. Cần người dùng thêm `AI_SETTINGS_ENCRYPTION_KEY` dưới dạng Secret production rồi redeploy để lưu API key hoạt động. Không bật cờ trả phí/lịch, không gửi provider request hoặc Telegram thật, không áp dụng hạ tầng/rules mới.
