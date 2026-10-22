# Thiết kế Marketing Studio — Đạt Nguyễn

Trạng thái: người dùng đã duyệt toàn bộ bản thiết kế và yêu cầu thực hiện ngay trong phiên ngày 22/10/2026. Đã triển khai mã Marketing Studio và kiểm thử cục bộ; chưa triển khai cloud hoặc kích hoạt dịch vụ/tài nguyên trả phí. Kết quả và giới hạn: `docs/verification/2026-10-22-marketing-agent.md`.
Ngày: 22/10/2026. Múi giờ nghiệp vụ: Asia/Ho_Chi_Minh.

## Mục tiêu và quyết định đã xác nhận

Phát triển Business Hub thành không gian làm việc có trợ lý Marketing, thư ký Chủ tịch, Bán hàng, Kế toán và Nhân sự. Giai đoạn đầu chỉ triển khai Marketing, giúp giảm thời gian nghĩ ý tưởng, tìm/tạo ảnh và tạo video. Các trợ lý còn lại là định hướng tương lai, không phải phần phải xây trong bản này.

Thương hiệu chung: Đạt Nguyễn. Một người dùng là chủ sở hữu hiện tại, cũng là người duyệt. Chưa có tài liệu thương hiệu, logo, ảnh, bảng giá hoặc bản ghi màn hình hướng dẫn được cung cấp.

| Nhóm dịch vụ | Đối tượng | Bộ nội dung/tháng | Bộ có video/tháng |
| --- | --- | ---: | ---: |
| Chữ ký số | Kế toán, chủ doanh nghiệp | 30 | 15 |
| Tư vấn, đào tạo AI | Kế toán, chủ doanh nghiệp, nhân viên văn phòng | 30 | 15 |
| Tư vấn, đào tạo đầu tư tài chính | Nhà đầu tư | 30 | 15 |
| Tổng | | 90 | 45 |

Một bộ là một chủ đề gốc có bài viết và ảnh, được điều chỉnh cho Zalo, Facebook, TikTok và YouTube. 90 bộ không có nghĩa là 360 ý tưởng độc lập. Dùng chung tư liệu khi phù hợp; chỉnh lời mở đầu, nội dung, tiêu đề, mô tả và lời kêu gọi hành động theo kênh. Những bộ không có video chỉ có văn bản/ảnh và kịch bản đề xuất cho kênh video; không đánh dấu là có thể đăng video ngay.

Video hoàn chỉnh tải được dưới dạng MP4, hướng chính là chia sẻ kiến thức ngắn kết hợp hướng dẫn thao tác thực tế. Bản đầu tiên cho tải nội dung về đăng thủ công, không kết nối quyền đăng bài lên mạng xã hội.

Ngân sách dịch vụ AI: 1.000.000 VND/tháng, không tính hosting. Người dùng đồng ý AI tự chuẩn bị nội dung hằng ngày theo kế hoạch đã duyệt. Mốc mong muốn để duyệt là 08:00 giờ Việt Nam, gửi thông báo đến nhóm Telegram đã cấu hình cho Business Hub. Video chỉ dựng sau khi kịch bản được duyệt; không hứa video chưa duyệt kịch bản sẽ có sẵn lúc 08:00.

## Giao diện đã được xem và đồng ý

Người dùng đã đồng ý bố cục bản mẫu Marketing Studio ngày 22/10/2026: thanh điều hướng bên trái, khu vực làm việc cùng AI ở giữa, xem trước và duyệt bên phải; màn hình hẹp xếp theo chiều dọc. Bản mẫu nằm ở `.superpowers/brainstorm/2107-1792645775/content/marketing-studio.html`, là tư liệu phác thảo cục bộ, không phải mã sản phẩm.

Các khu vực: Marketing Studio, lịch nội dung, hộp chờ duyệt và thư viện thương hiệu. Hiển thị sản lượng thực tế, trạng thái tác vụ và mức sử dụng ngân sách. Chuyển nhóm dịch vụ, kênh và định dạng; chỉnh sửa bản nháp; duyệt phiên bản cụ thể; tải tệp. Các trợ lý tương lai không được giả hoạt động. Số liệu mẫu không được chuyển vào dữ liệu production.

## Phân quyền và ranh giới tự động

AI được lập kế hoạch nháp, đề xuất ý tưởng, soạn bài/ảnh/kịch bản trong hạn mức và tự chuẩn bị công việc đến hạn trong kế hoạch đã duyệt. Chủ sở hữu duyệt kế hoạch tháng, kịch bản video và bộ thành phẩm. Không tự tăng ngân sách, xuất bản hoặc cam kết giá/dịch vụ thay người dùng.

Phê duyệt gắn với mã phiên bản và nội dung thực tế. Sửa nội dung/ảnh/video liên quan làm mất hiệu lực duyệt của phiên bản đó. Sửa kịch bản khiến video đã dựng không còn hợp lệ; sửa caption riêng không bắt buộc dựng lại video nếu nội dung video không đổi. Hệ thống lưu lịch sử duyệt và chi phí; bấm nhiều lần không tạo nhiều công việc hoặc nhiều lần tính phí.

Chỉ người dùng đã xác thực và đúng UID chủ sở hữu được truy cập dữ liệu Marketing, gọi AI trả phí, duyệt và tải tài sản. Các công việc máy chủ chạy theo UID được cấu hình, không nhận UID hoặc chat đích tùy ý từ request. Không gửi dữ liệu khách hàng, tài chính nội bộ hoặc nhân sự từ các phân hệ khác vào Marketing mặc định.

## Hồ sơ thương hiệu và thông tin dịch vụ

Có bước thiết lập hồ sơ ban đầu ngay trong app. Có thể bắt đầu bằng tên Đạt Nguyễn, màu và logo chữ đề xuất, giọng văn rõ ràng/gần gũi; đây là mặc định do người xây đề xuất, không phải tài sản nhận diện chính thức đã được người dùng cung cấp.

Lưu riêng mô tả ba dịch vụ, đối tượng, lợi ích đã xác nhận, thông tin liên hệ, mức giá/ưu đãi nếu có, nội dung không được nói và tài liệu nguồn. Trường chưa có phải để thiếu; không bịa bảng giá, thành tích, giấy phép, phản hồi khách hàng hoặc cam kết lợi nhuận. Chủ sở hữu duyệt hồ sơ trước khi dùng để tạo nội dung tự động; khi thiếu thông tin vẫn cho chuẩn bị nội dung giáo dục chung, dùng lời mời trao đổi chung.

Mỗi bài lưu nguồn của khẳng định có thể kiểm chứng. Nội dung cần thông tin pháp luật, giá, số liệu tài chính hoặc công cụ mới phải lấy nguồn còn phù hợp; khi không kiểm chứng được thì đánh dấu cần kiểm tra và chặn duyệt cuối cho khẳng định đó hoặc loại bỏ nó. Không tự động biến bài giáo dục đầu tư thành khuyến nghị mua/bán cá nhân hóa.

## Kế hoạch tháng và chu trình hằng ngày

1. AI tạo lịch nháp 30 chủ đề/dịch vụ/tháng, có mục tiêu, đối tượng, ngày dự kiến và cờ video cho 15 chủ đề. Chủ sở hữu chỉnh, duyệt toàn bộ hoặc duyệt từng mục. Chỉ phần đã duyệt mới chạy tự động.
2. Mặc định do người xây đề xuất: mỗi ngày tối đa một bộ/dịch vụ, chuẩn bị từ hôm trước, tránh lặp chủ đề và dùng lại ảnh phù hợp. Tháng 31 ngày có một ngày dự phòng; tháng dưới 30 ngày phân bổ thêm mục vào một số ngày để đủ mục tiêu tháng. Không tự vượt 90 bộ hoặc 45 video. Khi bắt đầu giữa tháng chỉ tự chạy phần lịch còn lại đã duyệt, không tự tạo bù toàn bộ ngày quá khứ.
3. Tạo bài theo kênh, một ảnh gốc dùng chung và các bản cắt/đặt chữ cần thiết; chủ đề có video tạo thêm kịch bản, phân cảnh và lời đọc dự kiến. Gửi vào chờ duyệt, không coi là thành phẩm đã duyệt.
4. Lúc mốc thông báo, Telegram gửi tóm tắt số bộ chờ duyệt, lỗi/thiếu tư liệu/hết ngân sách và đường dẫn đến app. Không gửi toàn bộ nội dung hoặc tài liệu nội bộ. Nếu không có kế hoạch đã duyệt phải báo rõ chưa có nội dung, không tạo nội dung ngoài kế hoạch.
5. Sau khi người dùng duyệt kịch bản, đưa vào hàng đợi dựng MP4; hoàn tất thì chuyển về chờ duyệt thành phẩm. Lỗi dựng có trạng thái và cách thử lại, không giả video thành công.
6. Người dùng kiểm tra, sửa và duyệt bộ/kênh/tài sản cụ thể rồi tải phiên bản đã duyệt. Có thể lấy bản nháp để xem riêng nếu gắn nhãn rõ; gói dùng để đăng chỉ chứa tài sản được duyệt.

Nếu sửa kế hoạch khi tác vụ đang chạy: khóa phiên bản đầu vào, không ghi đè phiên bản mới bằng kết quả cũ. Tác vụ cũ có thể hoàn thành nhưng bị đánh dấu lỗi thời và không tự duyệt. Các tác vụ chưa bắt đầu của mục đã thu hồi duyệt không được chạy tiếp.

## Video và gói tải

Mặc định đề xuất: dọc 9:16, MP4 H.264/AAC, 1080×1920; kiến thức khoảng 30–60 giây, hướng dẫn khoảng 45–90 giây; có lời đọc tiếng Việt, phụ đề, logo chữ, hình minh họa và màn kết. Chọn giọng đọc tiếng Việt có quyền sử dụng cho nội dung thương mại; người dùng nghe thử trước khi chốt giọng.

Để phù hợp ngân sách, dùng dựng theo mẫu từ ảnh, chuyển động nhẹ, bản ghi màn hình, giọng đọc và phụ đề; không mặc định dùng mô hình tạo cảnh video tốn phí theo giây. Không giả bản ghi màn hình bằng ảnh AI. Khi thiếu bản ghi được kiểm chứng, chuyển chủ đề đó sang video kiến thức nếu chủ sở hữu duyệt thay đổi; nếu không thì để chờ tư liệu. Không tự tải ảnh tùy ý từ web khi chưa xác định quyền dùng. Nhạc nền là tùy chọn, mặc định không dùng nếu chưa có nguồn được phép.

Gói tải theo bộ có văn bản UTF-8 riêng cho từng kênh, ảnh PNG/JPEG, MP4 nếu đã có, phụ đề SRT nếu có, thông tin phiên bản và nguồn cần thiết. Bộ không có video không có MP4 rỗng hoặc video giả. Có thể tải riêng từng tệp. Lưu tài sản trong kho đối tượng, không lưu ảnh/video base64 trong Firestore; quyền tải được kiểm tra ở máy chủ.

## Ngân sách và khả năng đáp ứng

1.000.000 VND là trần dịch vụ AI/tháng, không phải lời hứa 90 ảnh và 45 video bất kể số lượt sửa. Chưa có API/provider trả phí được chọn hoặc tài khoản thanh toán được cấp cho tính năng này. Không dùng thử khóa bí mật đang có hoặc tự đăng ký trả phí.

Trước triển khai vận hành phải lập dự toán có model ID đang hỗ trợ, giá hiện hành, độ dài lời đọc, số ảnh gốc/cảnh, token văn bản cho 4 kênh, số lượt sửa, dự phòng, tỷ giá bảo thủ và thuế/phụ phí có thể phát sinh. Chọn provider/model là quyết định kỹ thuật của người xây sau benchmark; tách adapter văn bản, ảnh, giọng đọc và renderer để thay thế được. Không đặt cược vào quota miễn phí hoặc model đã ngừng hỗ trợ.

Giữ chỗ chi phí tối đa trước mỗi yêu cầu trả phí bằng transaction, tính cả tác vụ đang chạy và yêu cầu chưa rõ kết quả. Khi không đủ dự toán thì dừng tác vụ mới, báo người dùng, không tự tăng ngân sách. Chi phí chưa biết phải giữ chỗ đến khi đối soát. Cảnh báo mức 80% là mặc định đề xuất; trần 100% chặn yêu cầu mới. Tạo lại nội dung cũng tính vào cùng trần. Đặt hạn mức provider tương ứng khi có thể; số trong app là số đo/dự toán có nhãn, không tuyên bố thay được hóa đơn provider.

Chi phí scheduler, lưu trữ, băng thông và dựng video phải tách khỏi phí AI, công bố dự toán hạ tầng trước khi bật tài nguyên trả phí. Đạt số lượng trong ngân sách là mục tiêu cần benchmark xác minh, không phải tiêu chí đã được chứng minh. Nếu không đạt phải báo phương án điều chỉnh trước, không âm thầm hạ chất lượng, thay đổi số lượng hoặc dùng ảnh lặp ngoài kế hoạch.

## Kiến trúc đề xuất của người xây

Tiếp tục repo Next.js/TypeScript hiện tại, thêm phân hệ `/marketing` và các route/API liên quan; giữ các phân hệ Business Hub khác. Dùng Firebase Auth/Firestore hiện tại, dữ liệu mới dưới namespace riêng của `users/{uid}`. Không tự chuyển sang Realtime Database chỉ vì config có databaseURL.

Các thực thể tối thiểu: hồ sơ thương hiệu/dịch vụ, phiên bản kế hoạch và từng mục, bộ nội dung và biến thể theo kênh, tài sản, tác vụ, lần duyệt, sổ dự toán/chi phí và lần gửi thông báo. Tên collection, schema chi tiết, SDK và thư viện dựng do người lập kế hoạch chọn; không trộn nội dung Marketing mới vào collection cũ khi chưa kiểm tra tương thích. Firestore rules và kho tài sản giới hạn đúng chủ sở hữu; không mở public write/read để khắc phục quyền truy cập.

Agent điều phối chuỗi công cụ hữu hạn: đọc hồ sơ được phép → lập/đọc kế hoạch → tạo bản nháp → tạo tài sản → yêu cầu duyệt → xuất gói. Đầu ra theo schema và validation. Không vòng lặp tự chạy không giới hạn, không tự thực thi mã tùy ý từ prompt/tài liệu và không tự cấp quyền hoặc công bố nội dung. Chỉ dẫn trong tài liệu nguồn là dữ liệu, không thay thế quy tắc hệ thống.

Tác vụ nền phải có hàng đợi bền vững, khóa có thời hạn, giới hạn số lần thử, mã chống trùng và điểm tiếp tục. Không dùng timer trình duyệt hoặc tiến trình chạy tiếp sau khi response đã kết thúc mà không có bảo đảm nền tảng. Renderer chạy trên môi trường hỗ trợ xử lý media, không mặc định Vercel Hobby đủ CPU/thời gian/FFmpeg. Nhà cung cấp renderer/worker và chi phí cần chốt trong kế hoạch trước khi provisioning; công việc dài lưu trạng thái và tài sản ngoài filesystem tạm.

Khóa AI, bot token và danh tính Firebase Admin ở máy chủ; không dùng NEXT_PUBLIC cho bí mật. Kích hoạt tự động cần đầy đủ credential, kho tài sản, worker, scheduler và cờ bật riêng. Tính năng chưa cấu hình phải hiện thiếu gì, không hiển thị sản lượng mẫu như dữ liệu thật.

## Lịch và Telegram

Người dùng đã chọn bộ lập lịch ngoài Vercel Hobby để nhắm phút 08:00 và yêu cầu trình chi phí trước khi bật. Đề xuất kỹ thuật của người xây: Google Cloud Scheduler; không cần nâng Vercel Pro chỉ cho lịch Marketing. Không hứa giao tin đúng tuyệt đối phút/giây khi scheduler, ứng dụng, mạng hoặc Telegram gặp sự cố.

Thiết kế ban đầu dùng hai job trong project Google Cloud đã được xác minh quyền quản lý, múi giờ `Asia/Ho_Chi_Minh`:

| Job | Cron | Chức năng |
| --- | --- | --- |
| Chuẩn bị Marketing | `0 20 * * *` | Mốc 20:00 hôm trước là mặc định đề xuất; đưa nội dung ngày kế tiếp trong kế hoạch đã duyệt vào hàng đợi bền vững |
| Thông báo Marketing | `0 8 * * *` | Nhắm 08:00, gửi trạng thái thực tế và liên kết đến hộp chờ duyệt |

Giá chính thức kiểm tra ngày 22/10/2026: 0,10 USD/job/31 ngày; ba job đầu miễn phí trên toàn billing account, không phải riêng từng project. Hai job này có thể 0 USD nếu còn đủ hạn mức miễn phí; dự toán bảo thủ nếu không còn miễn phí là 0,20 USD/31 ngày cho riêng Scheduler, chưa thuế/phí. Tạm quy đổi lập ngân sách bằng tỷ giá giả định 30.000 VND/USD là 6.000 VND; đây không phải tỷ giá thị trường được xác nhận. Job tạm dừng vẫn tính phí, nên không tạo job paused để thử trước khi người dùng duyệt bật.

Google Cloud yêu cầu billing được bật; chưa kiểm tra billing account hiện tại, quota miễn phí còn lại hoặc quyền tạo job. Đây không phải báo giá trọn gói. Worker/renderer, lưu trữ, băng thông, tác vụ Cloud/Firestore và phí AI được dự toán riêng trong kế hoạch trước khi cấp tài nguyên hoặc bật tự động. Không tự chuyển Firebase sang gói trả phí hay liên kết billing account. Phê duyệt bản thiết kế không thay thế yêu cầu trình tổng chi phí trước khi kích hoạt.

Giữ báo cáo nghiệp vụ 07:00 và thông báo Marketing 08:00 là hai nghiệp vụ riêng, journal riêng. Chỉ thêm luồng gửi Bot API vào nhóm hiện tại; không đổi webhook, không getUpdates, không thay token, không sửa bot của phần mềm khác. Nội dung thông báo liên kết về trang yêu cầu đăng nhập. Chống gửi trùng theo UID/ngày/loại; khi kết quả gửi không chắc chắn không retry mù. Không gửi tin nhắn thật trong quá trình xem thiết kế.

Cloud Scheduler gọi HTTPS endpoint Marketing chuyên biệt, không dùng handler Vercel Cron cũ khi nó chỉ chấp nhận CRON_SECRET. Dùng service account chuyên biệt với OIDC token; ứng dụng ngoài Google Cloud phải tự kiểm tra chữ ký, issuer, audience cố định, hạn token và đúng service account được cho phép. Header tên job/thời điểm lịch chỉ dùng sau bước xác thực, không dùng chúng như bằng chứng danh tính. Chống trùng theo tên job và thời điểm lịch gốc, quy đổi ngày Việt Nam; retry không tạo lại tài sản hoặc gửi trùng. Bỏ qua lần chạy quá hạn có thể phát sinh sau khi bật lại API; ghi nhật ký và báo thiếu, không tạo bù hàng loạt. Chi tiết thời hạn chấp nhận và số lần thử do kế hoạch kỹ thuật quy định. Handler chuẩn bị chỉ xác nhận đã lưu vào hàng đợi, không chạy ngầm không bền vững sau response. Mốc sẵn sàng có thể bị trễ khi lỗi; tin nhắn vẫn báo trạng thái thực, không giả rằng đủ ba bộ.

## Tiêu chí nghiệm thu

- Chủ sở hữu đăng nhập mới xem, duyệt, gọi AI và tải tài sản; request không được phép không gây chi phí.
- Lập được lịch 30 bộ/15 video cho từng dịch vụ; không tự chạy mục chưa duyệt hoặc vượt định mức, xử lý rõ tháng ngắn và khởi động giữa tháng.
- Tác vụ nền vẫn chạy khi đóng trình duyệt; kết quả đúng ngày Việt Nam và đúng phiên bản kế hoạch, không tạo trùng khi scheduler gọi lại.
- Một bộ có bốn biến thể kênh; bộ chưa có video hiển thị đúng thiếu MP4. Chỉnh sửa làm mất hiệu lực duyệt liên quan.
- Bài có ảnh thật và video đã dựng là MP4 phát được, lời đọc tiếng Việt khớp phụ đề, không nhầm hình giả với bản ghi thao tác thật.
- Telegram báo trạng thái vào lịch được chọn và không ảnh hưởng báo cáo 07:00 hoặc bot của phần mềm kia.
- Đạt trần ngân sách, hết quota, lỗi provider, lỗi renderer, lỗi Telegram và thiếu tư liệu có trạng thái rõ, không hiển thị thành công giả; retry không tự nhân chi phí hoặc trùng tài sản.
- Kiểm tra gói tải chỉ chứa phiên bản được duyệt và link/tệp đúng chủ sở hữu. Kiểm thử tích hợp dùng provider giả lập rõ ràng; xác minh trả phí nhỏ và gửi thật chỉ khi có cấu hình/ủy quyền tương ứng trước khi bật tự động.
- Các chức năng Sale, Kế toán, Công nợ, Vận hành và báo cáo hiện có tiếp tục qua kiểm thử phù hợp. Không triển khai 4 trợ lý tương lai trong phạm vi này.

## Nguồn tham khảo kiểm tra ngày 22/10/2026

- Vercel Cron usage/pricing: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel Cron management: https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Cloud Scheduler pricing: https://cloud.google.com/scheduler/pricing
- Cloud Scheduler cron/timezone: https://docs.cloud.google.com/scheduler/docs/configuring/cron-job-schedules
- Cloud Scheduler delivery/retry: https://docs.cloud.google.com/scheduler/docs/overview
- Cloud Scheduler HTTP authentication: https://docs.cloud.google.com/scheduler/docs/http-target-auth
- Cloud Scheduler setup/billing: https://docs.cloud.google.com/scheduler/docs/setup
- Gemini pricing (nguồn để khảo sát, chưa lựa chọn provider/model): https://ai.google.dev/gemini-api/docs/pricing
- YouTube Shorts: https://support.google.com/youtube/answer/15424877
- TikTok creative structure: https://ads.tiktok.com/business/en/blog/creative-best-practices-top-performing-ads

## Bước tiếp theo

Đã có một lượt rà soát độc lập; câu hỏi quan trọng duy nhất về cửa sổ giờ gửi đã được người dùng trả lời bằng việc chọn scheduler ngoài Vercel Hobby. Người dùng đã duyệt bản thiết kế đầy đủ. Kế hoạch thực hiện nằm ở `docs/plans/2026-10-22-marketing-agent-implementation.md`, bao gồm khảo sát giá và dự toán để benchmark xác minh trước khi bật. Sự phê duyệt này không cho phép tự liên kết billing hoặc bật tài nguyên trả phí; vẫn phải trình chi phí và cấu hình vận hành cụ thể trước khi kích hoạt.
