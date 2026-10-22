# Vận hành Marketing

## Quyền và lịch

Chỉ chủ sở hữu Firebase hiện tại sử dụng API. UI không phải ranh giới bảo mật: mỗi API xác minh ID token (bao gồm revoked), email và UID máy chủ. Firestore rules cấm client ghi mọi collection tiền tố marketing, kể cả đường dẫn lồng nhau. Worker Admin SDK được kiểm soát bằng repository UID/namespace; Firestore IAM không được giả là giới hạn collection.

Scheduler prepare 20:00 hôm trước; notify nhắm08:00, timezone Asia/Ho_Chi_Minh. OIDC phải đúng issuer, audience và SA. Full name job/time slot được kiểm tra sau xác thực. Invocation trễ hơn 60 phút không chạy bù; xem log và chủ động xử lý ngày phù hợp. Không đổi webhook/getUpdates hoặc thông báo 07:00 của Business Hub.

## Trạng thái và khôi phục

- `queued`: job/outbox tồn tại; outbox pending được đẩy lại khi chuẩn bị, thông báo hoặc bấm Tiếp tục xử lý. Lỗi queue không xóa job.
- `running`: lease 16 phút; worker timeout15phút. Không chạy đồng thời cùng job. Paid stage bị gián đoạn sau khi đánh dấu bắt đầu có thể chuyển uncertain; không retry trả phí mù.
- `failed`/`blocked_budget`/`waiting_material`: chỉ cho thử lại khi không có side effect trả phí chưa chắc chắn, tối đa3 attempts. Chỉnh kịch bản/tư liệu tạo revision khác và yêu cầu duyệt lại. Tác vụ plan thất bại có thể yêu cầu AI đề xuất lại bằng revision mới sau khi xác minh không uncertain.
- `uncertain`: có thể provider đã tính phí hoặc Telegram đã nhận tin. Không bấm tạo lại bằng cách sửa dữ liệu cloud. Đối chiếu request/provider invoice hoặc messageId/nhóm trước; giữ chỗ chi phí. Khôi phục thủ công cần nhật ký xác nhận, không có nút tự xóa dấu vết.
- `stale`: plan hoặc bundle thay đổi khi đang xử lý; không áp kết quả cũ, không tự duyệt. Chủ sở hữu có thể chọn Soạn lại theo kế hoạch đã thay đổi khi kế hoạch mới đã duyệt; thao tác tạo revision mới và giữ chi phí trong cùng trần. Không cho làm vậy khi tác vụ đang chạy hoặc uncertain; không tự ghi đè nội dung cũ.
- `review`: có bản nháp/ảnh hoặc MP4 cần chủ sở hữu duyệt. `approvedRevision` phải bằng current revision mới xuất gói; sửa nội dung khiến approval mất hiệu lực.

Outbox là bền vững nhưng không thay cho giám sát: nếu queue không truy cập được và không còn invocation nào, công việc vẫn chờ cho đến lần reconcile tiếp theo. Cloud Tasks giao ít nhất một lần; dedup/lease trong Firestore mới bảo vệ side effect. Không hứa exactly-once tuyệt đối cho nhà cung cấp không hỗ trợ.

## Đối soát tiền và an toàn tài sản

`marketingBudget/{YYYY-MM}` theo tháng Việt Nam, transaction giữ chỗ trước mỗi stage. `marketingCosts/{jobId}` ghi priceVersion và reservation. Không giải phóng uncertain khi chưa xác định phí; ngân sách có thể dừng trước sản lượng mục tiêu. Một reservation chưa sử dụng, chưa có side effect có thể được chuyển bằng transaction sang tháng thực sự gọi provider, chỉ khi tháng mới còn đủ hạn mức; có dấu vết previousMonth. Chi phí uncertain/đã sử dụng không chuyển để né trần.

Bucket riêng tư; object prefix theo UID/bundle; signed URL xem/tải5phút, upload10phút. URL đã phát vẫn có thể dùng đến hết TTL sau khi thu hồi approval; app không hứa revoke tức thì. Có CORS exact origin cho upload; dữ liệu đầu vào kiểm tra kích thước, MIME và ffprobe, không tin metadata client. Thành phẩm giữ lại, chưa áp lifecycle xóa tự động. Chỉ workdir tạm do worker tự tạo được dọn; không xóa file người dùng/bucket phần mềm kia.

Log chỉ code lỗi, job ID và thời điểm an toàn; không log API key, URL Bot chứa token, full prompt hoặc tài liệu khách hàng. Không gửi hồ sơ tài chính/nhân sự sang Marketing mặc định. Preview media không đưa signed URL vào bộ tối ưu ảnh công khai.

## Tạm dừng

Tắt cờ generation/schedule/send ở Vercel và worker; pause queue và scheduler đã triển khai. Không purge queue, xóa tài sản hoặc dữ liệu nghiệp vụ. Tác vụ đang gọi provider có thể đã tính phí; chờ/đối soát. Chi phí storage/registry có thể tiếp tục. Khi bật lại, xử lý backlog có chọn lọc, invocation quá hạn không được dùng để gửi hàng loạt.

## Giới hạn kiểm chứng hiện tại

API/worker/schema được kiểm thử bằng fake provider và emulator local. FFmpeg xuất được MP4 thật từ ảnh/audio tổng hợp. Chưa có xác minh paid Gemini/TTS hoặc vận hành Cloud Tasks/Run/Scheduler thật, chưa quan sát Telegram08:00, chưa kiểm tra app sau đăng nhập trên thiết bị thật. Xem báo cáo verification để biết chính xác các lệnh đã chạy.
