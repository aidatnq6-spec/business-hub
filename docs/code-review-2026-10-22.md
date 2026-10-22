# Phân tích mã nguồn và sửa lỗi Business Hub

Ngày thực hiện: 22/10/2026. Phạm vi: thư mục `D:\GitHub\business-hub`.

## Kết quả

Đã sửa các lỗi được xác nhận trong bản đang triển khai: `public/index.html`, đồng bộ sang `index.html` ở thư mục gốc. Đã sửa service worker và hai script triển khai. Các thư mục phiên bản và ZIP lịch sử được giữ nguyên.

22 kiểm thử hồi quy chạy thành công bằng Node. Kiểm thử dùng mã JavaScript thực tế được trích từ HTML, với DOM, Firebase và OpenRouter giả lập; không ghi dữ liệu thật và không gọi AI trả phí.

Chưa kiểm thử trực tiếp trên trình duyệt, Firebase Emulator hoặc tài khoản Firebase thật. Môi trường không có trình duyệt kết nối. Chưa triển khai lên website và chưa đổi khóa OpenRouter.

## Cấu trúc hệ thống

| Thành phần | Vai trò |
|---|---|
| `public/index.html` | Nguồn đang được Firebase Hosting triển khai |
| `index.html` | Bản sao ở thư mục gốc; đã đồng bộ với nguồn trong `public/` |
| `public/sw.js` | Cache ứng dụng và xử lý yêu cầu khi mất mạng |
| `public/manifest.webmanifest`, `public/icon.svg` | Thông tin cài ứng dụng và biểu tượng |
| `firebase.json` | Hosting lấy nội dung từ `public/`; khai báo đường dẫn Firestore Rules |
| `firestore.rules` | Giới hạn truy cập theo tài khoản chủ sở hữu và UID |
| `.firebaserc` | Project Firebase mặc định |
| `deploy.bat`, `deploy.sh` | Triển khai bằng Firebase CLI |
| `v0/`–`v18/`, các ZIP | Các bản chụp lịch sử |
| `tests/business-hub.test.cjs` | Bộ kiểm thử hồi quy mới |

Lúc khảo sát có 60 file ngoài `.git/` và `.firebase/`, bao gồm 21 HTML và 8 ZIP. Các script nội tuyến trong 21 HTML và 8 bản HTML trong ZIP đã được kiểm tra cú pháp. Tài liệu hướng dẫn DOCX không phải mã nguồn và không được kiểm tra bố cục.

Ứng dụng dùng HTML/CSS/JavaScript thuần, không có framework, bundler hay `package.json`. Bản gốc đang hoạt động có 7.188 dòng và khoảng 404 KB, chứa cả giao diện, dữ liệu mẫu, nghiệp vụ và truy cập dữ liệu.

Firebase Auth xử lý đăng nhập. Firestore lưu dữ liệu trong `users/{uid}/{collection}/{documentId}`. Trình duyệt nghe thay đổi bằng `onSnapshot`, cập nhật các mảng trạng thái rồi dựng lại giao diện. OpenRouter được gọi trực tiếp từ trình duyệt. Chart.js cung cấp biểu đồ.

Luồng chính:

```text
Đăng nhập Firebase Auth
  → kiểm tra chủ sở hữu
  → đăng ký các listener Firestore
  → cập nhật trạng thái trong bộ nhớ
  → dựng dashboard, pipeline, thu chi, công nợ và vận hành

Nhập/sửa dữ liệu → Firestore → listener → cập nhật giao diện
Tính năng AI → OpenRouter → xem kết quả hoặc điền form để người dùng kiểm tra
```

## Chức năng đang có

- Dashboard: thu chi tháng, công nợ, việc ưu tiên, sức khỏe kinh doanh và tóm tắt AI.
- Sale: pipeline, khách/deal, lịch follow-up, script liên hệ và Customer 360.
- Kế toán: giao dịch thu/chi, biểu đồ, lọc theo tháng/mảng, dự báo và nhập bằng giọng nói.
- Công nợ: số tiền phải thu, đã thu, còn nợ và hạn thanh toán.
- Vận hành: todo, follow-up, căn hộ, lịch thu tiền thuê và nhắc việc định kỳ.
- Báo cáo: số liệu theo tháng, biểu đồ và hiệu suất sale.
- Tiện ích: backup/import, tìm kiếm, nhật ký thay đổi, hoàn tác và thông báo.

Trong mã còn có Marketing, danh bạ CKS và thư viện IT. Bản `v18` đã bỏ trang IT, listener IT và đường dẫn điều hướng IT; Marketing và trang CKS cũng không có đầy đủ trang giao diện trong bản đang triển khai. Các modal/hàm còn lại không chứng minh rằng toàn bộ những tính năng này đang được cung cấp cho người dùng. Đợt sửa không tự khôi phục các trang đã bị loại bỏ.

## Các lỗi đã sửa

| Nhóm | Lỗi xác nhận trước khi sửa | Cách xử lý |
|---|---|---|
| Nhắc định kỳ | Biến `today` là Date nhưng bị gọi như hàm; không tạo được todo | Dùng ngày nghiệp vụ riêng, loại bỏ việc che khuất tên hàm |
| Nhắc định kỳ | Đánh dấu đã tạo trong localStorage trước khi ghi thành công | Ghi todo và dấu hoàn thành trong một Firestore transaction |
| Nhắc định kỳ | Cờ trên từng thiết bị không ngăn trùng giữa các thiết bị | ID xác định theo lịch/ngày, collection `recurringRuns` và transaction |
| Giao diện nhắc định kỳ | Tìm nút xóa bằng `getElementById` khi hàng chưa được gắn vào DOM | Gán sự kiện trực tiếp vào nút thuộc hàng vừa tạo |
| Phạm vi JavaScript | Ô tìm sale, nút chạy lại nhắc nhở và kéo ảnh gọi hàm trong module từ inline handler | Công khai rõ các điểm vào cần thiết qua `window` |
| Giọng nói | Khoản thu/chi bằng 0 không xóa số tiền của lần nhập trước | Luôn gán lại cả hai ô, kể cả số 0 |
| Giọng nói | Preview dùng `type/amount` trong khi AI trả `thu/chi` | Hiển thị đúng hai khoản và kiểm tra dữ liệu AI trước khi điền form |
| Giọng nói | Bấm dừng chỉ đổi giao diện, không dừng bộ nhận dạng | Giữ tham chiếu bộ nhận dạng và gọi `stop()` |
| Ngày giờ | Cắt ngày từ UTC gây lùi ngày trong khoảng 00:00–06:59 tại Việt Nam | Dùng hàm ngày theo `Asia/Ho_Chi_Minh` cho các chuỗi ngày nghiệp vụ |
| Backup | Chỉ xuất sáu collection | Xuất thêm khách CKS, IT tùy chỉnh, thu tiền thuê, lịch định kỳ và lịch sử tạo việc |
| Import | Giao diện ghi “ghi đè toàn bộ”, thực tế chỉ cập nhật/thêm theo ID | Mô tả đúng là gộp dữ liệu; giữ các bản ghi khác |
| Import | Thay `createdAt` bằng thời gian nhập lại | Khôi phục Timestamp từ backup; chỉ bổ sung thời điểm khi dữ liệu cũ thiếu |
| Import | Dữ liệu JSON gần như không được kiểm tra | Kiểm tra ứng dụng/phiên bản, collection, ID, bản ghi trùng, ngày và tiền trước khi ghi |
| Import | Ghi từng bản ghi và khó biết mức độ hoàn tất khi lỗi | Ghi theo batch tối đa 400 bản ghi, báo tiến độ và số lượng đã nhập |
| Tiền thuê | Trạng thái đã thu chỉ nằm trên trình duyệt | Lưu Firestore `rentPayments`, có listener đồng bộ và nằm trong backup |
| Di chuyển dữ liệu cũ | Cần giữ trạng thái thu tiền thuê đang lưu local | Chuyển trạng thái đã thu sang cloud; không ghi đè bản ghi cloud đã tồn tại |
| Thu/chi và công nợ | Cho phép tiền âm hoặc đã thu lớn hơn tổng nợ | Kiểm tra số hữu hạn, không âm và giới hạn công nợ trước khi ghi |
| Báo cáo | So sánh với tháng trước bị âm dẫn đến đảo chiều cải thiện/xấu đi | Dùng trị tuyệt đối của mẫu số như dashboard |
| Thứ tự hiển thị | `0 || fallback` làm mất ưu tiên của follow-up gấp và căn đang thuê | Dùng `??` để giữ giá trị 0 |
| Hiển thị HTML | Nhiều tên, ghi chú, địa chỉ, query và kết quả AI được đưa trực tiếp vào HTML | Escape các trường tại điểm hiển thị; chat và preview giọng nói dùng DOM/textContent |
| Liên kết | Link hợp đồng có thể chứa scheme thực thi mã | Chỉ mở URL HTTP/HTTPS, tách tab khỏi `opener` |
| Ảnh hỗ trợ | Preview không kiểm tra định dạng/kích thước; fallback dùng `document.write` | Giới hạn ảnh raster, bỏ `document.write` và tạo ảnh bằng DOM |
| Listener | Lỗi Firestore không được báo; dữ liệu có thể đè lên ID thật từ snapshot | Thêm callback báo lỗi; lấy ID từ document làm giá trị cuối cùng |
| Dữ liệu cũ | Query sắp xếp loại những document thiếu `createdAt` | Nghe toàn collection rồi sắp xếp trong bộ nhớ |
| Phiên đăng nhập | Đồng hồ/timer có thể tồn tại sau đăng xuất | Dọn listener, timer và trạng thái; gắn thông báo với phiên đăng nhập |
| OpenRouter | Request không có giới hạn thời gian | Thêm timeout 60 giây, luôn dọn timer |
| Service worker | Khi mất mạng có thể trả HTML cho request script/API | Chỉ fallback HTML cho navigation của ứng dụng, tách các request khác |
| Service worker | Cache không được cập nhật và có thể xóa cache không thuộc ứng dụng | Cập nhật response hợp lệ, giới hạn namespace và tăng phiên bản cache |
| Triển khai | Script chỉ deploy Hosting dù dự án có rules | Chuẩn bị deploy Hosting và Firestore Rules; dừng khi lỗi và chạy từ thư mục dự án |
| Git | File chứa khóa OpenRouter có thể bị thêm vào Git | Thêm mẫu loại trừ cụ thể vào `.gitignore`; không in hoặc sửa giá trị khóa |

Firebase xác nhận `orderBy` loại những document không có trường sắp xếp; vì vậy việc đọc đầy đủ dữ liệu cũ và backup không còn dùng điều kiện sắp xếp này. Xem [tài liệu truy vấn Firestore](https://firebase.google.com/docs/firestore/query-data/order-limit-data).

Các hàm trong ES module không tự trở thành global cho inline handler. Xem [MDN về JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).

Lệnh triển khai rules được đối chiếu với [tài liệu triển khai Firebase Security Rules](https://firebase.google.com/docs/rules/manage-deploy). Script đã được sửa nhưng chưa chạy triển khai.

## Đối chiếu các phiên bản

| Phiên bản | Số dòng ban đầu | Kiểm tra cú pháp JavaScript |
|---|---:|---|
| v0 | 6.775 | Đạt |
| v1 | 6.742 | Đạt |
| v2 | 6.772 | Đạt |
| v3 | 6.775 | Đạt; HTML trùng v0 |
| v4 | 6.801 | Lỗi chuỗi xuống dòng, HTML dòng 584 |
| v5 | 6.818 | Lỗi chuỗi xuống dòng, HTML dòng 601 |
| v6 | 6.830 | Lỗi chuỗi xuống dòng, HTML dòng 613 |
| v7 | 6.651 | Đạt |
| v8 | 6.690 | Đạt |
| v9 | 6.669 | Đạt |
| v10 | 6.724 | Đạt |
| v11 | 6.724 | Đạt; HTML trùng v10 |
| v12 | 6.727 | Đạt |
| v13 | 7.190 | Đạt |
| v14 | 7.207 | Đạt |
| v15 | 7.207 | Đạt; HTML trùng v14 |
| v16 | 7.227 | Đạt |
| v17 | 7.227 | Đạt; HTML trùng v16 |
| v18 | 7.188 | Đạt; ban đầu trùng root và public |

Các ZIP được kiểm tra là bản chụp tương ứng của những HTML đã liệt kê. Hai ZIP của v4/v5 cũng chứa lỗi cú pháp đó. `firebase-deploy.zip` ở gốc chứa HTML trùng v7; không phải bản mới nhất. Không nên dùng những ZIP này để triển khai bản đã sửa.

## Kiểm thử và giới hạn

Chạy lại:

```powershell
node --test tests/business-hub.test.cjs
node --check public/sw.js
```

Các kiểm thử bao gồm: lỗi DOM định kỳ, tạo việc lặp không trùng, thử lại sau thất bại, nhập giọng nói và dừng nhận dạng, ngày Việt Nam, escape HTML, scope của handler, danh sách backup, kiểm tra file trước khi ghi, giữ timestamp, giữ bản ghi không có trong backup, kiểm tra tiền, lưu và di chuyển tiền thuê, báo cáo, thứ tự hiển thị, service worker và ID thật từ Firestore.

Import file lớn gồm nhiều batch, không phải một transaction cho cả file. Nếu lỗi sau một batch đã commit, các batch trước vẫn được giữ; thông báo có số lượng đã nhập. Nhập lại cùng file cập nhật theo cùng ID. Một batch bị lỗi không ghi dở từng document trong batch.

Chưa kiểm chứng độ hợp lệ thực tế của khóa OpenRouter, model đang được tài khoản hỗ trợ, dữ liệu Firebase hiện tại, rules đang chạy trên cloud, micro trên thiết bị thật hoặc cache trên điện thoại. Kiểm tra cú pháp và kiểm thử giả lập không thay thế các bước đó.

Khóa OpenRouter trong file văn bản vẫn còn trên máy. `.gitignore` không thu hồi khóa và không xóa lịch sử nếu khóa từng được chia sẻ ở nơi khác. Chủ tài khoản cần thu hồi/đổi khóa đó nếu đã bị lộ. Khóa người dùng nhập trong ứng dụng vẫn được lưu ở trình duyệt theo kiến trúc hiện tại; chuyển sang backend giữ khóa là một thay đổi kiến trúc riêng.

Service worker lưu shell và các script CDN khi chúng đi qua worker; chưa bảo đảm mọi phụ thuộc đã có sẵn để khởi động hoàn toàn offline. Firestore/AI vẫn phụ thuộc kết nối mạng. Nhắc việc hiện chạy khi ứng dụng mở, không có dịch vụ lập lịch nền khi ứng dụng đã đóng.

Ứng dụng vẫn là một HTML lớn; vẫn có logic và giao diện cũ không còn được dùng. Customer 360 còn ghép dữ liệu theo tên/số điện thoại thay vì khóa khách hàng thống nhất. Dự báo và điểm sức khỏe là công thức hỗ trợ tham khảo. Những giới hạn này không được chuyển thành một đợt thiết kế lại trong phạm vi sửa lỗi.
