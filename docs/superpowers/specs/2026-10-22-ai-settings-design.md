# Thiết kế Cài đặt AI — Business Hub

Ngày: 22/10/2026. Múi giờ nghiệp vụ: Asia/Ho_Chi_Minh.

Trạng thái: người dùng đã duyệt toàn bộ tài liệu trong hội thoại ngày 22/10/2026 và trước đó đã duyệt bố cục, cách thao tác, nguyên tắc quản lý khóa. Được phép lập kế hoạch triển khai. Chưa cho phép bật AI trả phí hoặc lịch tự động.

## Mục tiêu và phạm vi

Thay phần Cài đặt AI mô phỏng bằng cấu hình thật cho trợ lý Marketing. Người dùng chọn công việc; hệ thống chọn model từ cấu hình đã được kiểm tra, trong ngân sách cho phép. Hiển thị tình trạng kết nối và lỗi theo từng năng lực, tránh thông báo lưu thành công khi chưa lưu thật.

Giữ Next.js, Firebase Auth, Firestore, Vercel và luồng Marketing hiện có. Không viết lại hệ thống. Thư ký, Bán hàng, Kế toán và Nhân sự chỉ là mục giới thiệu chưa kích hoạt. Không thêm đăng bài mạng xã hội tự động, không tạo model tùy ý, không thay đổi báo cáo Telegram kinh doanh 07:00.

## Những quyết định người dùng đã xác nhận

- Bố cục và thao tác bản mẫu Cài đặt AI thuận tiện. Tham chiếu cục bộ: `.superpowers/brainstorm/2375-1792675345/content/ai-settings-preview-v2.html`; cần mang phần nhập khóa mới được chốt vào thiết kế này. Bản mẫu là minh họa, không chứng minh kết nối thật.
- Hệ thống tự chọn model theo công việc, không yêu cầu chọn mỗi lần tạo nội dung.
- Người dùng bổ sung API key sau, nhập trực tiếp trong màn hình Cài đặt AI.
- Chỉ chủ sở hữu được nhập, thay và xóa khóa. Lưu khóa mã hóa ở máy chủ; không lưu trong trình duyệt hoặc mã nguồn. Sau khi lưu chỉ thấy trạng thái và một vài ký tự cuối; không có chức năng xem lại toàn bộ khóa.
- Kiểm tra kết nối phải báo rõ kết quả. Phép thử có phí phải được thông báo và duyệt trước.
- Lưu khóa không tự bật tạo nội dung hoặc lịch chạy. Khi chưa có khóa, các chức năng cần khóa giữ tắt.
- Ngân sách AI Marketing đã chốt trong thiết kế Marketing là 1.000.000 đồng/tháng. Nội dung theo kế hoạch đã duyệt; duyệt kịch bản trước dựng video và duyệt thành phẩm trước tải để đăng thủ công. Thông báo Marketing mong muốn lúc 08:00; bộ lập lịch và chi phí phải được duyệt trước khi bật.

## Hiện trạng cần thay thế

`components/settings.tsx` chỉ lưu lựa chọn model trong sessionStorage; ô OpenRouter API key hiện không gửi hoặc lưu khóa. Marketing thật dùng cấu hình máy chủ trong `lib/server/marketing/config.ts` và adapter Gemini trong `providers.ts`. Giọng đọc, hàng đợi, kho tài sản và worker có danh tính/cấu hình riêng; một API key không cấu hình được mọi năng lực.

Giới hạn ngân sách đang có giá trị mặc định trong `lib/marketing/pricing.ts`, có giữ chỗ/đối soát trong store. Phải nối Cài đặt vào chính các nơi thực thi này; không tạo cấu hình giao diện độc lập. Các giá/model trong mã hiện tại là ứng viên, không coi là danh mục đã được xác minh cho bản mới.

## Quyết định kỹ thuật đề xuất của người viết

Những lựa chọn trong mục này chưa phải lựa chọn riêng do người dùng chỉ định; được đưa ra để tài liệu có thể lập kế hoạch thực hiện.

1. Giai đoạn đầu cấu hình khóa Gemini, phù hợp adapter Marketing hiện có. Ghi rõ tên nhà cung cấp trên form. Không coi khóa OpenRouter là khóa Gemini; OpenRouter và nhà cung cấp khác nằm ngoài đợt này. Nếu cần đổi nhà cung cấp, phải bổ sung adapter và bảng giá tương ứng trước khi sử dụng.
2. Mã hóa AES-256-GCM bằng khóa chủ 32 byte trong biến bí mật máy chủ `AI_SETTINGS_ENCRYPTION_KEY`; không dùng tiền tố NEXT_PUBLIC. Nonce ngẫu nhiên 12 byte mỗi lần mã hóa; có auth tag, phiên bản thuật toán/khóa, và AAD gắn UID, nhà cung cấp, phiên bản credential. Dùng thư viện crypto chuẩn của Node.js. Không tự tạo khóa chủ khi thiếu cấu hình.
3. Lưu ciphertext ở đường dẫn Firestore riêng cấp gốc `privateAiCredentials/{uid}/providers/{provider}`. Không đặt bên dưới `users/{uid}` vì rules hiện cho chủ sở hữu đọc đệ quy ở nhánh đó. Rules từ chối mọi đọc/ghi trực tiếp của client vào nhánh bí mật; server Admin có quyền truy cập. Chỉ API được xác thực và worker nội bộ được phép giải mã theo nhu cầu tác vụ.
4. API chỉ trả DTO được chọn trường rõ ràng: nhà cung cấp, configured, suffix tối đa 4 ký tự, revision, updatedAt, trạng thái kiểm tra và thời điểm. Không trả ciphertext, nonce, tag hoặc credential đã giải mã. Khóa quá ngắn thì không hiện suffix. Không đưa khóa vào log, lỗi, audit, URL hoặc thông báo Telegram.
5. Thiết lập này chỉ cấu hình Marketing trong bản đầu. Khóa chủ cần có ở cả Vercel và worker trước khi chạy tác vụ dùng khóa; việc phân phối bí mật và triển khai worker là bước riêng, không tự bật dịch vụ hạ tầng/chi phí.

## Bố cục và thao tác

Giữ màu navy, font Be Vietnam Pro và thanh bên Business Hub. Responsive không tràn ngang, nhãn và thông báo bằng tiếng Việt. Các lựa chọn bố cục trong bản mẫu chỉ phục vụ góp ý, không phải tính năng bắt buộc của bản thật.

### Kết nối dịch vụ

Mỗi năng lực có trạng thái riêng: chưa cấu hình, chưa kiểm tra, đang kiểm tra, hợp lệ hoặc có lỗi. Viết bài/tạo ảnh có thể dùng cùng credential nhưng kết quả khả dụng khác nhau. Giọng đọc và dựng video hiển thị điều kiện riêng; không có ô API key chung hứa hẹn kết nối mọi dịch vụ.

Ở Gemini, khi chưa có khóa: nút “Thêm API key” mở ô nhập password, cho dán khóa và nút “Lưu khóa”. Khi đã có: hiện suffix và nút “Thay khóa”, “Xóa khóa”, “Kiểm tra kết nối”. Xóa phải xác nhận trong hộp thoại nêu ảnh hưởng. Ô thay khóa luôn rỗng, không điền lại khóa cũ. Khóa chỉ ở bộ nhớ form trong lúc nhập/gửi và được xóa khi lưu thành công, đóng form hoặc rời trang; lỗi lưu giữ khả năng thử lại, không in khóa ra lỗi. Không dùng localStorage/sessionStorage cho khóa.

“Đã cấu hình” chỉ có nghĩa lưu thành công. “Kết nối hợp lệ” cần kết quả kiểm tra riêng. Mọi thao tác có trạng thái đang xử lý, chặn bấm lặp, có thời hạn chờ và thông báo Việt hóa cho JSON rỗng, lỗi máy chủ, mất phiên và xung đột phiên bản. Khi kết quả lưu chưa xác định, yêu cầu tải lại metadata để kiểm tra, không tự gửi lặp.

### AI theo công việc

- Ý tưởng/bài viết: model văn bản trong danh sách cho phép, ưu tiên tiết kiệm trong mức chất lượng đã xác định.
- Ảnh: model có năng lực tạo ảnh, dùng lại ảnh/tư liệu khi phù hợp.
- Giọng đọc: chỉ dùng giọng tiếng Việt đã được người dùng duyệt.
- Video: dựng theo mẫu từ tư liệu, giọng đọc và phụ đề; không tự chuyển sang dịch vụ tạo cảnh video tính phí theo giây.

Phần Nâng cao hiển thị nhà cung cấp, model hiện được chọn cho mỗi việc, ngày kiểm tra cấu hình và bảng giá. Không cho nhập model ID/địa chỉ API tùy ý. Người thực hiện phải kiểm tra tài liệu chính thức về model, năng lực, đơn giá và phương pháp kiểm tra trước khi chốt danh mục; ghi nguồn/ngày xác minh trong tài liệu vận hành. Chưa xác minh hoặc giá hết hiệu lực thì chặn phát sinh phí với lý do cụ thể.

Trong đợt đầu mỗi năng lực có tối đa một model chính được xác minh. Cấu trúc hỗ trợ danh sách dự phòng nhưng mặc định để trống. Chỉ thêm model dự phòng sau khi năng lực và giá được duyệt, không tự dò/tự chọn model mới trên thị trường. Model/cấu hình được khóa theo phiên bản ở đầu tác vụ để có thể truy vết.

### Ngân sách

Hiển thị đã chi, đang giữ chỗ, còn khả dụng của tháng hiện tại từ ledger thật. Mặc định 1.000.000 đồng/tháng cho Marketing, không gộp hosting/hạ tầng vào hạn mức AI.

Cho chủ sở hữu thay hạn mức với xác nhận. Thay đổi có hiệu lực tháng hiện tại và là mặc định cho tháng sau. Không cho hạ dưới tổng đã chi + đang giữ chỗ. Dùng transaction, optimistic revision và cùng cơ chế giữ chỗ ở tất cả đường gọi provider, kể cả kiểm tra có phí và thử dự phòng. Mỗi tác vụ dùng mức hiện hành lúc giữ chỗ; thay hạn mức không xóa hoặc làm lại lịch sử chi phí.

Cảnh báo khi tổng đã chi + giữ chỗ đạt 80% hạn mức; không khởi chạy khi không đủ chỗ cho chi phí tối đa của tác vụ. Hạn mức 0 có nghĩa không được phát sinh phí. Chi phí không xác định phải giữ khoản dự phòng để đối soát, không ghi 0 hoặc tự thử lại. Không cam kết tuyệt đối hóa đơn ngoài nhà cung cấp bằng ledger ước tính; nêu rõ số đã ghi nhận và trạng thái chờ đối soát.

### Quyền tự động và lịch

Hiển thị cài đặt chủ sở hữu mong muốn và trạng thái hiệu lực thực tế riêng biệt. Chỉ được bật sau khi các điều kiện kết nối, worker, bảng giá, ngân sách và phê duyệt chi phí đều đủ. Trong đợt này không kích hoạt trả phí/lịch; nút bật bị chặn với danh sách điều kiện còn thiếu. Việc lưu cài đặt khác không thể vô tình đổi cờ kích hoạt.

Tiếp tục trình bày chuẩn bị 20:00 hôm trước, thông báo chờ duyệt 08:00 giờ Việt Nam như luồng Marketing đã thiết kế. Không hứa gửi đúng giây. Không chỉnh hay kích hoạt báo cáo kinh doanh 07:00 từ màn hình này.

## Luồng máy chủ và vòng đời khóa

- Các API settings dùng cùng xác minh Firebase ID token, email chủ sở hữu và UID như Marketing hiện có; không có API cập nhật ẩn danh. Kiểm tra Origin với các thao tác ghi; giới hạn kích thước body, tần suất thao tác ghi/kiểm tra và không log body.
- Lưu/thay khóa kiểm tra cấu trúc, provider cho phép, revision và mã hóa; không gọi model hay kiểm tra trả phí khi lưu. Cập nhật ciphertext và metadata cùng transaction; tăng credential revision, vô hiệu kết quả kiểm tra cũ.
- Kiểm tra kết nối dùng phép kiểm tra metadata không tạo nội dung nếu nhà cung cấp hỗ trợ và được xác minh không tính phí. Chỉ kiểm tra được phạm vi thực tế: truy cập danh mục không chứng minh tạo ảnh thành công. Nếu cần phép thử có phí, trước tiên trả dự toán, công việc và dữ liệu sẽ gửi; chỉ chạy sau hành động xác nhận riêng và giữ chỗ ngân sách. Chưa có khóa thì không gửi request ra ngoài.
- Xóa khóa xóa credential ứng dụng, không tự thu hồi khóa tại nhà cung cấp. Tác vụ chưa bắt đầu bị chặn; tác vụ đã gửi ra nhà cung cấp có thể hoàn tất và vẫn cần đối soát. Không tự khôi phục qua khóa môi trường cũ sau khi người dùng xóa.
- Credential resolver được dùng thống nhất ở UI status, API nội dung và worker. Có record ứng dụng thì nó là nguồn chính; không âm thầm dùng khóa env khác. Khi chưa từng có record mới có thể nhận diện khóa env cũ là “Quản lý qua máy chủ”; không xuất khóa đó ra trình duyệt. Xóa lưu tombstone để ngăn fallback. Không migrate plaintext qua client.
- Tác vụ chỉ lưu credential revision, không lưu plaintext vào job. Trước gửi provider kiểm tra revision còn hiệu lực. Nếu khóa vừa thay/xóa và job chưa gửi, dừng/chờ retry có kiểm soát theo phiên bản mới; không dùng credential cũ từ cache để gửi tiếp. Request đã phát đi trước thay/xóa không thể thu hồi bằng transaction ứng dụng.
- Worker chỉ đọc khóa cho người sở hữu và tác vụ được xác thực; không thêm endpoint giải mã. Audit chỉ gồm hành động, thời điểm, UID, provider, revision, kết quả và mã lỗi được làm sạch.
- Khi thiếu/sai khóa chủ, chặn thao tác cần giải mã/mã hóa, không ghi đè credential và không trả plaintext. Khóa chủ không nằm trong database hoặc bản sao lưu database; mất khóa chủ phải báo nhập lại API key. Đợt đầu chưa có UI xoay khóa chủ; tài liệu vận hành nêu quy trình bảo quản và phương án nhập lại, không hứa tự phục hồi.

## Tiêu chí kiểm chứng

1. Không có API key: xem/sửa ngân sách và hồ sơ thủ công được; AI không chạy, không hiển thị thành công giả.
2. Lưu/thay/xóa khóa: kiểm thử xác thực, quyền sở hữu, xung đột revision, mã hóa/giải mã/AAD, metadata được lọc và client bị rules chặn đọc credential. Không có khóa trong phản hồi, log, storage trình duyệt hoặc job.
3. Kiểm tra kết nối: phân biệt thiếu khóa, bị từ chối, timeout, lỗi mạng, nhà cung cấp lỗi và thành công đúng phạm vi. Không vô tình phát sinh phí; thử trả phí có xác nhận và giữ chỗ.
4. Ngân sách: UI/API/worker thống nhất; test cạnh tranh giữ chỗ và sửa hạn mức, hạ dưới số đã chi/giữ chỗ, hạn mức 0, mốc 80%, đổi tháng và usage chưa xác định.
5. Thay/xóa khóa không khiến job chờ dùng khóa cũ hoặc fallback env; request đã phát đi được theo dõi/đối soát. Không gọi lại provider khi kết quả chưa xác định.
6. Lưu cài đặt không bật lịch/tạo nội dung, không thay dữ liệu kinh doanh hoặc cấu hình Telegram 07:00.
7. Kiểm tra giao diện desktop/mobile, bàn phím, thông báo đang lưu/lỗi/timeout, API rỗng hoặc sai JSON. Kiểm tra tích hợp thực tế cần phiên người dùng hợp lệ; không kết luận chỉ từ trang trả HTTP 200.

Kiểm thử tự động dùng fake provider; không lấy mock làm dữ liệu sản phẩm. Chạy lint, typecheck, test và production build. Trước khi người dùng có khóa và duyệt chi phí, không gọi AI trả phí, không bật scheduler, không apply hạ tầng mới.

## Bàn giao

Sau khi tài liệu tổng thể được duyệt: lập kế hoạch triển khai theo kỹ năng writing-plans, rồi thực hiện theo phạm vi đã duyệt. Người thực hiện quyết định chi tiết module, schema validation, endpoints, bố trí dialog và thư viện kiểm thử theo cấu trúc dự án; không được thay các ranh giới bảo vệ khóa, ngân sách và kích hoạt đã nêu.
