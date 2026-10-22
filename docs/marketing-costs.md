# Dự toán Marketing — chưa kích hoạt trả phí

Thiết kế mục tiêu 90 bộ bài/ảnh, 45 video mỗi tháng; ba dịch vụ và bốn kênh. Video dựng từ ảnh và bản ghi thật, không tạo cảnh video AI theo giây.

Phép tính tái lập được bằng `npm run marketing:estimate`, chi tiết trong kế hoạch triển khai đã duyệt. Giá tham khảo kiểm tra 22/10/2026: [Gemini](https://ai.google.dev/gemini-api/docs/pricing), [Cloud TTS](https://cloud.google.com/text-to-speech/pricing), [Scheduler](https://cloud.google.com/scheduler/pricing), [Cloud Tasks](https://cloud.google.com/tasks/pricing), [Cloud Run](https://cloud.google.com/run/pricing), [Storage](https://cloud.google.com/storage/pricing).

| Phần | Dự toán và giới hạn |
| --- | --- |
| AI cơ sở theo giả định | 300.720 VND/tháng |
| AI với dự phòng 50% | 451.080 VND, đề xuất phong bì khoảng 500.000 VND |
| Trần nghiệp vụ AI | 1.000.000 VND/tháng gồm khoản giữ chỗ và số ghi nhận |
| Scheduler 2 job | 0,20 USD/31 ngày nếu không còn miễn phí, tương đương giả định 6.000 VND |
| Hạ tầng toàn bộ | Phong bì 100.000–200.000 VND/tháng, chưa phải báo giá đã xác minh |

Tỷ giá 30.000 VND/USD chỉ dùng lập dự toán. Chưa biết thuế/phí ngân hàng, bill account/free quota, SKU region, chi phí build/registry, egress và lưu thành phẩm dài hạn. Không nói tổng chi phí chắc chắn bằng 0 hoặc đủ ngân sách trước khi benchmark. Lượt tạo lại, audio nhiều đoạn, tác vụ bị lỗi/không rõ kết quả đều cần dự phòng.

Hiện chưa thực hiện benchmark AI trả phí, chưa kiểm tra tài khoản billing và chưa tạo tài nguyên cloud. Khoản benchmark đề xuất tối đa 50.000 VND chỉ được dùng sau khi người dùng đồng ý, tính trong trần tháng đó.

Trong mã, reservation cap mỗi job: plan/draft 15.000đ, image/speech 10.000đ, render/export/probe 0đ phí AI. Caps là số giữ chỗ bảo thủ, KHÔNG phải đơn giá mỗi bài. Ghi nhận từ usage khi có, input ảnh/text dùng giá bảo thủ; kết quả thiếu usage hoặc thất bại không chắc chắn giữ reservation để đối soát. Chi phí render/storage vẫn phát sinh riêng dù cap AI của render bằng 0. Cảnh báo 80% và trần mới được UI phản ánh qua progress/giá trị; cloud budgets là cảnh báo, không hard cutoff hóa đơn.

Trước khi kích hoạt phải cập nhật tài liệu này bằng: model/voice đã xác minh, usage và chất lượng mẫu, các giá SKU khu vực, dự toán số lượt tải/retention, hạn mức provider, phụ phí và bảng tổng được chủ sở hữu duyệt. Không đổi ngân sách, model giá cao hơn hoặc mở quyền billing thay người dùng.
