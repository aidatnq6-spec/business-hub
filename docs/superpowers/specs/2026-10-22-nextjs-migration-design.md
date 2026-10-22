# Thiết kế chuyển Business Hub sang Next.js

Trạng thái: ngày 22/10/2026 người dùng yêu cầu chuyển từ dữ liệu giả sang dữ liệu Firebase đang có. Bản Next.js đã được kết nối Firebase Auth/Firestore client tại thư mục gốc `D:\GitHub\business-hub`, không nạp dữ liệu mẫu. Việc tải dữ liệu cloud thật cần người dùng đăng nhập bằng tài khoản hiện tại trong trình duyệt. AI, lịch gửi Telegram và triển khai production chưa kích hoạt.

## Cập nhật thư mục gốc

Theo yêu cầu mới ngày 22/10/2026, toàn bộ ứng dụng Next.js đã chuyển lên D:\GitHub\business-hub. Các đường dẫn trong tài liệu dùng cấu trúc thư mục gốc. Mã HTML/PWA, công cụ deploy HTML và kiểm thử HTML đã được xóa. Firebase CLI chỉ giữ cấu hình Firestore; Vercel Root Directory chọn thư mục gốc (.).

## Cập nhật tích hợp Firebase thật

Theo yêu cầu mới, dùng cấu hình Firebase Web đã cung cấp trong `.env.local` (ngoài Git), đăng nhập Email/Password với tài khoản chủ sở hữu và đọc/ghi đúng `users/{uid}/{collection}`. Không seed, không fallback mock, không sửa rules hoặc triển khai hosting. Fixture đã chuyển sang `tests/fixtures/`; kho localStorage mẫu cũ không được đọc hoặc tự nhập lên cloud. Các thao tác ghi thông báo thành công sau khi Firebase xác nhận; transaction phát hiện sửa đồng thời. Thu tiền thuê và việc định kỳ giữ ID tương thích bản HTML. Chi tiết thực hiện: `docs/plans/2026-10-22-firebase-live.md`. Các phần mô tả “chưa bật Firebase” bên dưới ghi lại trạng thái của giai đoạn mock trước yêu cầu này; cập nhật này là trạng thái hiện tại.

## Cập nhật báo cáo Telegram tự động

Người dùng xác nhận sẽ chạy Next.js trên Vercel và giữ chat nhóm đã cung cấp. Đã có API máy chủ `/api/cron/telegram`, Firebase Admin adapter, journal theo ngày và `vercel.json` với lịch `0 0 * * *` UTC, tương ứng 07:00 Việt Nam. Bot/nhóm được xác minh chỉ đọc, bot đang là thành viên; chưa gửi tin thử. Chưa kích hoạt lịch production vì chưa có Firebase Admin credential và chưa có deployment Business Hub trên Vercel. Credential và token chỉ ở máy chủ. Chưa xác định được gói Vercel: Hobby chạy trong giờ 07:00–07:59; Pro hỗ trợ trong phút 07:00; không tự nâng gói. Hướng dẫn hoàn tất: `docs/telegram-setup.md`.

## Mục tiêu

Viết lại ứng dụng Business Hub bằng Next.js, thay mã HTML/JavaScript nguyên khối bằng các trang và component React có TypeScript. Giữ nghiệp vụ đang hoạt động, các bản sửa lỗi đã kiểm thử và khả năng đọc dữ liệu Firebase hiện tại.

Người dùng đã yêu cầu chuyển sang Next.js và xác nhận “giữ nguyên giao diện và các chức năng đang có”. Các quyết định kỹ thuật bên dưới là đề xuất của người thực hiện; không phải yêu cầu bổ sung do người dùng tự đặt ra.

## Phạm vi chức năng

Chuyển đầy đủ sáu phần đang được cung cấp: tổng quan, sale pipeline, kế toán, công nợ, vận hành và báo cáo. Giữ đăng nhập một chủ sở hữu; Customer 360; script liên hệ và liên kết Zalo; biểu đồ; tìm kiếm; nhập giọng nói; nhắc việc khi mở ứng dụng; thu tiền thuê; nhật ký/hoàn tác; backup/import; các thao tác AI đang truy cập được, bao gồm IT chatbot.

Không tự khôi phục những trang Marketing, danh bạ CKS hoặc thư viện IT đã bị gỡ/ẩn trong bản hiện tại. Dữ liệu các nhóm này vẫn được bảo toàn khi backup/import. Không biến ứng dụng thành dịch vụ nhiều doanh nghiệp hoặc nhiều vai trò trong lần chuyển đổi này.

Theo yêu cầu đã xác nhận: giữ giao diện tiếng Việt, bố cục, màu sắc, nội dung, cách dùng và các chức năng của bản hiện tại; xây lại bằng React để dễ bảo trì. Các trạng thái loading/error được giữ phù hợp giao diện cũ. Không tự thiết kế lại.

Phạm vi bổ sung đã được người dùng yêu cầu: gửi báo cáo Business Hub qua Telegram, gồm việc hôm nay, việc quá hạn, công nợ cần thu trong 7 ngày sắp tới và thu/chi/lợi nhuận tháng hiện tại. Người dùng xác nhận bot đang dùng ở phần mềm khác hiện chỉ gửi thông báo khi khách nhập form đăng ký.

## Kiến trúc

- Ứng dụng Next.js chạy trực tiếp ở thư mục gốc. Mã HTML/PWA, bộ kiểm thử và công cụ triển khai HTML đã được xóa theo yêu cầu mới. Không dùng iframe hoặc `dangerouslySetInnerHTML` để giả lập chuyển đổi.
- Dùng Next.js App Router, TypeScript strict và phiên bản package ổn định được kiểm tra khi cài. Commit lockfile trong phần bàn giao mã; không tự tạo Git commit khi chưa được yêu cầu.
- Routes chính: `/`, `/sale`, `/accounting`, `/debts`, `/operations`, `/reports`, cùng `/login` và `/settings`.
- Layout chung chứa điều hướng desktop/mobile. Component tương tác dùng client boundary rõ ràng; logic định dạng, tính toán và validation nằm trong thư viện độc lập.
- Firebase SDK được cài qua package manager. Giữ Firebase Auth và Firestore client để tương thích các rule và listener hiện tại. Listener được quản lý trong hook/provider theo phiên, có loading/error state và dọn khi đổi tài khoản.
- Tách kiểu dữ liệu cho deal, giao dịch, công nợ, todo, follow-up, căn hộ, thu tiền thuê và lịch định kỳ; adapter đọc dữ liệu cũ tương thích cả `type/amount` lẫn `thu/chi`.
- Biểu đồ được nạp theo trang sử dụng. Không tải toàn bộ biểu đồ và mọi modal cho trang đăng nhập.

## Dữ liệu và nghiệp vụ

Giữ nguyên project Firebase và đường dẫn `users/{uid}/{collection}/{id}`. Không thực hiện chuyển đổi/xóa dữ liệu thật chỉ để chạy bản Next.js. Cấu hình Firebase được khai báo qua biến môi trường công khai phù hợp; không đưa credential đặc quyền hoặc khóa OpenRouter vào các biến `NEXT_PUBLIC_*`.

Ngày 22/10/2026, người dùng đã cung cấp đầy đủ cấu hình Firebase Web. Đã đối chiếu cả 7 trường với cấu hình ứng dụng trước khi chuyển đổi: trùng hoàn toàn, cùng project `gen-lang-client-0931039939`. Cấu hình chuẩn bị cho Next.js được lưu tại `.secrets/firebase.env`, ngoài Git; đây mới là file chuẩn bị, chưa được ứng dụng Next.js nạp tự động. Chưa thực hiện kiểm tra kết nối hoặc thay đổi nào trên Firebase. Thông tin này là cấu hình client, không phải credential máy chủ cho Firebase Admin SDK; việc đọc dữ liệu để gửi báo cáo khi không có phiên đăng nhập cần danh tính máy chủ phù hợp khi triển khai.

Giữ date-only theo múi giờ Việt Nam, validation tiền, transaction tạo việc định kỳ có ID cố định và dấu chạy, collection `rentPayments`, di chuyển trạng thái tiền thuê local mà không đè trạng thái cloud, và backup đủ các collection. Các bước di chuyển dữ liệu local cần chạy trên cùng origin với bản cũ hoặc qua backup; ứng dụng ở localhost/domain mới không đọc được localStorage của domain cũ.

Backup vẫn là JSON Business Hub, đọc được phiên bản 1/2/3 đang được hỗ trợ. Import kiểm tra toàn bộ trước khi ghi, gộp theo ID, giữ thời điểm tạo cũ và thông báo rõ khi một phần các batch đã hoàn tất. Không đổi import thành xóa toàn bộ dữ liệu. Không dùng HTML không tin cậy để hiển thị tên, ghi chú, nội dung chat hay file import.

Undo tiếp tục giới hạn trong phiên và dữ liệu của người đang đăng nhập; cần kiểm tra hành vi trước/sau theo bản hiện tại. Các phép tính báo cáo và công nợ có kiểm thử fixture để phát hiện sai lệch khi chuyển đổi.

## AI và bảo mật

Đề xuất một Route Handler `POST /api/ai`. Trình duyệt gửi Firebase ID token; máy chủ xác minh token với Firebase Admin SDK, đối chiếu tài khoản chủ sở hữu và giới hạn đầu vào trước khi gọi OpenRouter. Route không chấp nhận yêu cầu chưa xác thực hoặc trả khóa bí mật về trình duyệt.

Giữ nguyên màn hình cài đặt AI, lựa chọn model và thao tác nhập/lưu khóa cá nhân. Khóa người dùng cung cấp có thể được gửi trong phần thân HTTPS đến Route Handler đã xác thực để dùng cho đúng yêu cầu đó; không đưa khóa vào URL, log, response hoặc Firestore. Route không lưu lâu dài khóa cá nhân. Việc lưu khóa ở trình duyệt tiếp tục tương thích thiết lập hiện tại, không tuyên bố rằng khóa người dùng nhập đã hoàn toàn rời khỏi trình duyệt.

Có thể cấu hình khóa mặc định qua môi trường máy chủ để chạy AI khi người dùng chưa nhập khóa cá nhân; khóa mặc định không được gửi về client. Đây là tùy chọn triển khai, không loại bỏ các thao tác cài đặt hiện có. Không tự sử dụng file khóa bí mật trong repository.

API có timeout, giới hạn kích thước prompt, token đầu ra và xử lý lỗi. Nội dung khách hàng chỉ gửi đi khi người dùng sử dụng chức năng AI tương ứng. Không dùng khóa bí mật đang có trong file văn bản làm credential mặc định hay tự kiểm tra bằng lời gọi trả phí.

## Báo cáo Telegram

### Nội dung người dùng đã yêu cầu

1. Công việc cần làm trong ngày hôm nay.
2. Công việc đang bị quá hạn.
3. Danh sách công nợ cần thu trong 7 ngày sắp tới.
4. Doanh thu, chi phí và lợi nhuận của tháng hiện tại.

Lịch gửi đã được người dùng xác nhận: tự động lúc **07:00 sáng hằng ngày**, theo giờ Việt Nam (`Asia/Ho_Chi_Minh`, UTC+7).

### Cách tính được đề xuất

- Tính ngày và tháng theo `Asia/Ho_Chi_Minh`. Mỗi báo cáo ghi rõ ngày báo cáo, khoảng công nợ và kỳ tài chính.
- Việc hôm nay: todo có `dueDate` bằng ngày báo cáo, chưa hoàn thành theo cả `done` và `status` tương thích dữ liệu cũ. Việc quá hạn: todo chưa hoàn thành có `dueDate` trước ngày báo cáo. Hai danh sách không đếm trùng nhau. Việc không có ngày hẹn không được tự coi là quá hạn.
- Công nợ: khoản còn phải thu lớn hơn 0, có `dueDate` trong khoảng 7 ngày tính cả hôm nay (ngày báo cáo đến hết ngày thứ sáu sau đó). Hiển thị khách hàng, ngày đến hạn, số tiền còn phải thu và tổng cộng; số còn phải thu là `max(amount - paid, 0)`. Đây là quy ước do người thực hiện đề xuất, chưa phải khoảng ngày người dùng đã xác nhận riêng.
- Doanh thu/chi phí: giữ cùng cách tổng hợp với dashboard hiện tại từ các giao dịch có ngày trong tháng báo cáo. Doanh thu là tổng Thu, chi phí là tổng Chi, lợi nhuận là Thu trừ Chi. Không lấy tổng giá trị deal đã chốt thay cho tiền Thu và không cộng công nợ chưa thu vào doanh thu của báo cáo này. Tháng đang diễn ra được ghi rõ là số liệu tính đến thời điểm gửi.
- Gửi văn bản có tiền tố `[Business Hub]`, dùng định dạng tiền Việt Nam và thông báo rõ khi một danh sách rỗng. Nội dung lấy trực tiếp từ dữ liệu, không cần gọi AI.

### Dùng chung bot và vận hành

- Business Hub chỉ gửi tin qua Bot API; không cài/đổi/xóa webhook, không gọi `getUpdates`, không đổi token hoặc cấu hình bot của phần mềm kia.
- Token đặt trong `TELEGRAM_BOT_TOKEN` ở máy chủ. Người dùng đã cung cấp token và chat đích; cấu hình tạm nằm trong `.secrets/telegram.env`, được `.gitignore` loại trừ. Không ghi giá trị token vào tài liệu. Chưa xác minh token hoặc quyền gửi đến chat với Telegram và chưa kích hoạt tích hợp. Đích nhận cấu hình bằng `TELEGRAM_CHAT_ID`, đã được người dùng cung cấp. Không đưa token vào `NEXT_PUBLIC_*`, mã trình duyệt hoặc Git. Không tự gửi tin thử tới bot thật.
- Nội dung chỉ gửi đến chat đã được người dùng xác nhận trong cấu hình riêng. Người dùng đã chỉ định chat đích ngày 22/10/2026; quyền gửi thực tế của bot đến chat này chưa được kiểm tra. Token bot không tự xác định đúng người nhận.
- Báo cáo dài được chia thành nhiều tin có đánh số, tránh vượt giới hạn của Telegram. Xử lý lỗi và giới hạn gửi chung của bot; không retry vô hạn hoặc khẳng định gửi thành công khi API thất bại.
- Tự động gửi lúc 07:00 hằng ngày theo `Asia/Ho_Chi_Minh`, kể cả khi người dùng không mở ứng dụng. Lịch chạy phía máy chủ, không dùng timer của trang web. Nếu scheduler dùng UTC, thời điểm tương ứng là 00:00 UTC hằng ngày (`0 0 * * *`); nếu hỗ trợ timezone, đặt 07:00 với timezone Việt Nam. Chưa chọn nền tảng scheduler hoặc yêu cầu gói hosting trả phí. Lịch mới chỉ được ghi trong thiết kế, chưa có tác vụ gửi thật được kích hoạt.
- Lệnh chạy lịch cần xác thực riêng và chỉ xử lý dữ liệu của UID chủ sở hữu được cấu hình ở máy chủ, không lấy UID/đích nhận tùy ý từ request. Chống chạy trùng theo ngày/kỳ gửi và ghi nhận kết quả. Khi mạng lỗi sau khi Telegram đã nhận tin nhưng trước khi ứng dụng lưu kết quả, có thể có trạng thái giao nhận không chắc chắn; không hứa bảo đảm tuyệt đối một lần gửi.
- Trước khi tổng hợp báo cáo 07:00, máy chủ xử lý các lịch định kỳ đến hạn của chủ sở hữu bằng cùng ID todo và transaction `recurringRuns` như ứng dụng. Sau đó mới đọc việc hôm nay/quá hạn. Như vậy báo cáo không thiếu việc định kỳ chỉ vì người dùng chưa mở ứng dụng. Cần quyền máy chủ phù hợp để đọc dữ liệu, tạo todo và ghi trạng thái chạy/gửi trong phạm vi Business Hub; không chỉ quyền đọc. Hàm tạo việc phải được dùng chung giữa giao diện và tác vụ nền để tránh lệch quy tắc.

### Kết quả rà soát trước khi code ngày 22/10/2026

- Chạy lại 22 kiểm thử của bản hiện tại: tất cả đạt. Mã Next.js chưa được tạo.
- `.secrets/firebase.env` và `.secrets/telegram.env` đều được Git bỏ qua. Chưa có cấu hình danh tính máy chủ/UID chủ sở hữu được chuẩn bị cho tác vụ nền.
- Đã thử gọi `getMe` đến API Telegram để kiểm tra chỉ đọc, không gửi tin và không đổi webhook. Kết nối thất bại với `URLError`; chưa xác minh token, chat hoặc quyền gửi, không kết luận credential sai.
- Chưa truy cập tài nguyên Firebase thật hoặc kiểm tra schema/rules đang chạy trên cloud. Chưa xác định mức dùng chung dữ liệu với phần mềm kia.
- Chưa có Firebase CLI sẵn trong PATH được kiểm tra. Có Node/npm hoạt động. Không bắt buộc có CLI Firebase để bắt đầu viết và kiểm thử các component/logic bằng dữ liệu giả.
- Cần chọn nền tảng chạy Next.js và scheduler trước triển khai thật. Có thể viết giao diện và logic độc lập nền tảng trước. Nếu chọn Firebase App Hosting, cần kiểm tra project đã bật Blaze và người dùng chấp thuận cấu hình chi phí; chưa thực hiện thay đổi này.
- Khi triển khai cùng origin bản cũ, phải xử lý việc ngừng/thay service worker cũ để tránh fallback HTML cũ vào route hoặc chunk Next.js. Cần thử cả tình huống người dùng đã từng cài/mở PWA cũ.

Các bước này không bắt buộc người dùng gửi mật khẩu Firebase hoặc khóa service account vào cuộc trò chuyện. Credential máy chủ được thiết lập an toàn theo môi trường triển khai khi cần tích hợp thật.

### Firebase đang dùng ở phần mềm khác

Cấu hình Firebase người dùng cung cấp trùng với cấu hình Business Hub hiện tại. Nếu đây cũng là project phần mềm kia đang dùng, hai ứng dụng đang chia sẻ project; chưa kiểm tra mã nguồn, đường dẫn dữ liệu, Authentication hoặc Security Rules của phần mềm kia. Không tự đổi project trong lần chuyển Next.js, không triển khai đè rules hoặc sửa/xóa dữ liệu của phần mềm kia. Bản Next.js tiếp tục dùng đường dẫn dữ liệu Business Hub hiện có; mọi thay đổi rules trên project dùng chung phải được đối chiếu trước.

## Chạy và triển khai

Cung cấp `.env.example`, hướng dẫn chạy local và lệnh dev/build/start/test. Kiểm tra các chức năng bằng dữ liệu giả hoặc Firebase Emulator, không viết fixture vào project production.

Ứng dụng có API phía máy chủ nên bản đề xuất không dùng static export. Repository không còn cấu hình triển khai Firebase Hosting HTML; tài nguyên hosting đã triển khai trên cloud không bị thay đổi bởi việc dọn mã cục bộ. Có thể triển khai sau lên nơi chạy Next.js server như Firebase App Hosting hoặc Vercel; việc chọn/chuyển hosting và xuất bản không thuộc phạm vi triển khai local ban đầu.

Service worker mới không cache API, token hay response nhạy cảm. Tránh dùng worker cũ để cache HTML ứng dụng Next.js hoặc làm hỏng chunk. Chỉ quảng bá mức hỗ trợ offline đã kiểm thử. Nhắc việc trong giao diện chưa trở thành tác vụ nền khi ứng dụng đóng; báo cáo Telegram 07:00 hằng ngày chạy riêng phía máy chủ.

## Tiêu chí hoàn tất

1. Sáu nhóm nghiệp vụ và các tiện ích trong phạm vi hoạt động bằng component React/Next.js thực sự.
2. Đọc/ghi tương thích schema hiện có, giữ ID, ngày, số tiền và timestamp; hỗ trợ backup/import hiện tại.
3. Đăng nhập/đăng xuất, listener, API AI và lỗi mạng xử lý đúng, không lộ khóa máy chủ.
4. Các ca hồi quy hiện có được chuyển hoặc bổ sung tương đương; typecheck, lint, tests và production build đều đạt.
5. Kiểm tra giao diện desktop/mobile và luồng chính bằng trình duyệt nếu môi trường có trình duyệt. Nếu không, ghi rõ phần chưa xác minh, không coi đó là kiểm thử E2E đã đạt.
6. Có README, `.env.example`, bảng tương đương chức năng và ghi chú khác biệt. Mã nguồn Next.js và cấu hình nằm tại gốc; mã HTML/PWA và các snapshot cũ đã được loại bỏ theo yêu cầu người dùng.
7. Báo cáo Telegram khớp dữ liệu ở các mốc đầu/cuối tháng và khoảng 7 ngày; không gửi việc đã xong hoặc công nợ đã thu đủ. Kiểm thử Telegram bằng mock, gồm báo cáo rỗng, báo cáo dài, API lỗi, chạy lịch trùng và quy đổi lịch 07:00 giờ Việt Nam. Không thay đổi cơ chế gửi form của phần mềm kia.

## Quyết định còn chờ

- Phạm vi giữ giao diện/chức năng và xây dựng bản dữ liệu giả đã được người dùng xác nhận; đã thực hiện. Phần tích hợp Firebase/AI/Telegram thật và triển khai production vẫn cần cấu hình, xác minh và quyết định hosting tương ứng.
- Token bot và chat đích đã được cung cấp trong cấu hình riêng; lịch gửi 07:00 hằng ngày theo giờ Việt Nam đã được chốt. Cần kiểm tra quyền gửi thực tế khi triển khai tích hợp, chưa gửi thử hoặc kích hoạt lịch.

Kế hoạch giai đoạn mock: `docs/plans/2026-10-22-nextjs-mock-implementation.md`. Kết quả: `docs/verification/2026-10-22-nextjs-mock.md`; hướng dẫn chạy và phạm vi chức năng: `README.md`.
