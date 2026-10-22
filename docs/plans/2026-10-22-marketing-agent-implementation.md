# Marketing Studio Đạt Nguyễn Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> Ghi chú môi trường: catalog hiện tại chưa cung cấp `superpowers:executing-plans` hoặc `superpowers:subagent-driven-development`. Dòng hướng dẫn trên được giữ theo mẫu writing-plans, không khẳng định skill đã cài. Khi thực thi dùng workflow hiện có hoặc tìm skill tương ứng; không giả đã áp dụng skill thiếu. Không cần skill thiếu để đọc hoặc duyệt kế hoạch này.

**Goal:** Bổ sung Marketing Studio cho một chủ sở hữu: 90 bộ bài/ảnh và mục tiêu 45 video/tháng cho ba dịch vụ, bốn biến thể kênh, duyệt phiên bản, tải thành phẩm, chuẩn bị hằng ngày và thông báo Telegram nhắm 08:00 Việt Nam trong trần phí AI 1 triệu VND/tháng.

**Architecture:** Next.js hiện tại cung cấp giao diện/API được Firebase Auth bảo vệ, Firestore lưu dữ liệu và trạng thái; Cloud Storage giữ tài sản riêng tư. Cloud Tasks chuyển từng bước xử lý đến Cloud Run worker có FFmpeg; Cloud Scheduler chỉ kích hoạt chuẩn bị và thông báo, không dựng video trong request Vercel. Agent là bộ điều phối hữu hạn có schema, ngân sách, chống trùng và cổng duyệt, dùng adapter Gemini/text-to-speech có thể thay thế.

**Tech Stack:** Next.js App Router/React/TypeScript hiện có, Zod, Firebase Admin/Auth/Firestore, Google Cloud Scheduler/Tasks/Run/Storage, Google OIDC, FFmpeg/ffprobe, Vitest/Testing Library; Firebase Emulator cho kiểm tra quyền/transaction. Các SDK mới chỉ cài lúc triển khai, chọn phiên bản đang hỗ trợ và commit lockfile nếu có yêu cầu commit.

---

## Nguồn yêu cầu, phạm vi và cách thực hiện

- Thiết kế đã duyệt: `docs/superpowers/specs/2026-10-22-marketing-agent-design.md`.
- Bản mẫu bố cục đã duyệt: `.superpowers/brainstorm/2107-1792645775/content/marketing-studio.html`; dùng làm tham khảo, xây component React riêng, không nhúng HTML mẫu bằng iframe hoặc dangerouslySetInnerHTML.
- Chủ sở hữu đã đồng ý xây Marketing trước, không xây bốn trợ lý khác, không tự đăng mạng xã hội. Không seed dữ liệu mẫu vào production hoặc fallback sang mock khi thiếu AI/Firebase.
- Không tạo worktree trong lượt lập kế hoạch: repo có thay đổi chưa commit và người dùng làm việc trực tiếp ở đây. Khi triển khai cần kiểm tra lại `git status`, không ghi đè `next-env.d.ts` hay công việc người dùng. Chỉ tạo worktree khi phù hợp cơ chế workspace/quyền ghi hiện tại; không chuyển thư mục gốc của app lần nữa.
- Đọc `AGENTS.md` và guide Next liên quan trong `node_modules/next/dist/docs/` trước khi viết mã. Guide route đã được kiểm tra khi lập kế hoạch: `01-app/01-getting-started/15-route-handlers.md`; không cache response chứa dữ liệu cá nhân.
- Mỗi bước dưới là một hành động khoảng 2–5 phút; tách thêm nếu thực hiện lâu hơn. Với nghiệp vụ có rủi ro, thêm test hành vi, chạy đỏ, triển khai nhỏ, chạy xanh. Không thêm test chỉ soi class CSS hoặc mirror implementation.
- Sau mỗi task, kiểm tra diff và ghi checkpoint; chỉ Git commit khi người dùng yêu cầu hoặc cho phép trong workflow. Không tự thực hiện Git add/commit ở lượt lập kế hoạch.

## Chốt phương án kỹ thuật và dự toán sơ bộ

### Dịch vụ được đề xuất để triển khai

| Phần | Phương án | Cách giữ chi phí |
| --- | --- | --- |
| Bài/kịch bản/kế hoạch | Adapter Gemini, ứng viên `gemini-3.1-flash-lite` | Schema, giới hạn token, không lặp agent tự do |
| Ảnh gốc | Ứng viên `gemini-3.1-flash-lite-image`, 1K | Một ảnh gốc/bộ, cắt/đặt chữ bằng renderer, không tạo lại cho từng kênh |
| Giọng đọc | Cloud Text-to-Speech Neural2 tiếng Việt nếu voices.list xác nhận phù hợp | Giọng cố định chủ sở hữu nghe duyệt, tái dùng audio khi chỉ sửa caption |
| Dựng video | FFmpeg trong Cloud Run service riêng | Mẫu hữu hạn, không tạo cảnh video AI theo giây, min-instances 0, concurrency 1 |
| Hàng đợi | Cloud Tasks HTTP OIDC → Cloud Run worker | Nội dung task chỉ có ID; retry hữu hạn; không đưa tệp vào payload |
| Ảnh/video | Bucket riêng tư mới, cùng region worker nếu khả thi | Không đổi IAM/bucket đang phục vụ phần mềm kia; link tải có hạn |
| Lịch | 2 job Cloud Scheduler | 20:00 chuẩn bị hôm sau; 08:00 báo trạng thái, Asia/Ho_Chi_Minh |

Các model trên xuất hiện trong bảng giá chính thức tại thời điểm khảo sát; chưa gọi API để xác minh quyền truy cập tài khoản, chất lượng tiếng Việt hoặc định mức thực. Nếu ứng viên không hoạt động, dừng và cập nhật manifest giá/model; không fallback âm thầm sang model đắt hơn hoặc model đã ngừng hỗ trợ.

### Tính phí AI theo giả định, không dựa quota miễn phí

Dùng tỷ giá giả định để dự toán 30.000 VND/USD, không phải tỷ giá thị trường đã xác nhận. Giá chưa gồm thuế/phí ngân hàng. Giả định video dùng 3–6 cảnh dựng từ cùng ảnh gốc, chữ và bản ghi màn hình, KHÔNG tạo 3–6 ảnh mới/video.

| Thành phần | Giả định / tháng | Phép tính USD | VND giả định |
| --- | --- | ---: | ---: |
| Văn bản | 1 triệu token vào, 0,5 triệu token ra, đã dự trù bản kênh và sửa | 1 × 0,25 + 0,5 × 1,50 = 1,00 | 30.000 |
| Ảnh | 90 gốc + 30 lượt tạo lại, 1K | 120 × 0,0336 = 4,032 | 120.960 |
| Input ảnh và phần text/thinking của ảnh | Khoản dự phòng, phải thay bằng usage thực | 1,00 | 30.000 |
| Giọng đọc | 45 video × tối đa 1.800 ký tự × hệ số sửa 2 | 162.000 / 1.000.000 × 16 = 2,592 | 77.760 |
| Tra cứu nguồn | Trần dự toán 100 query tính phí, không giả miễn phí | 100 / 1.000 × 14 = 1,40 | 42.000 |
| Cộng giả định | | 10,024 | 300.720 |

Dự phòng kế hoạch 50% cho biến động/sai số: 451.080 VND; làm tròn phong bì dự toán khoảng **500.000 VND/tháng cho AI**, trần ứng dụng vẫn **1.000.000 VND/tháng**. Đây là giả thuyết định lượng, không bảo đảm sản lượng/chất lượng hoặc hóa đơn. Nếu cần nhiều ảnh cảnh riêng, nhiều video dài, nhiều lần sửa hoặc truy vấn nguồn hơn thì phải tính lại trước. Benchmark có giới hạn sẽ thay các giả định này; không chạy benchmark trả phí trong lượt lập kế hoạch.

### Phần hạ tầng tính riêng

- Scheduler: tối đa dự toán 0,20 USD/31 ngày cho 2 job, có thể 0 nếu còn quota miễn phí dùng chung billing account. Khoảng 6.000 VND theo tỷ giá giả định, chưa thuế.
- Cloud Tasks: giá vượt free-tier 0,40 USD/triệu operations (task lớn chia theo 32KB); 10.000 operations giả định tương đương 0,004 USD, chưa network, không bảo đảm mọi operations chỉ một lần.
- Cloud Run: lập mô hình 45 lượt dựng × 300 giây × 2 vCPU và 2GiB, cộng thời gian các bước văn bản/ảnh, khởi động và sửa. Phải tra SKU/region Singapore thực tế trước khi báo con số; không dùng giá region khác làm báo giá. Giới hạn đề xuất 15 phút/request, max-instances 1, CPU 2 và memory 2GiB; benchmark RAM/thời gian trước khi chốt. Giảm độ phức tạp mẫu nếu không đạt; không lặng lẽ giảm chất lượng đã duyệt.
- Storage: 45 × 60MB + 90 × 2MB + audio/ảnh trung gian, dự trù khoảng 5GB tăng/tháng; 15GB sau ba tháng nếu không xóa. Ví dụ 10 lượt tải toàn bộ thành phẩm có thể đến 50GB egress/tháng. Phải tính storage, operations, băng thông và lưu trữ container/build/logs, không chỉ phí giữ tệp.
- Firestore: tính đọc/ghi theo số step, transaction, retry và kết nối UI. Không dùng onSnapshot toàn bộ lịch sử/tài sản; phân trang. Xác minh free-quota và billing hiện tại, không hứa bằng 0.
- Khoản dự phòng hạ tầng để đưa vào bảng xin bật: **100.000–200.000 VND/tháng**, là phong bì dự toán do người xây đề xuất, CHƯA phải báo giá đủ căn cứ hoặc giới hạn cứng của cloud. Nếu phép tính theo SKU thực tế cao hơn phải trình lại. Tổng cloud có thể tăng vì lưu tài sản cũ/tải nhiều hơn.

**Trước khi bật:** trình bảng tổng có region, SKU, billing/free quota thực tế, API model/giọng đã kiểm tra, chi phí benchmark và hạn mức được chủ sở hữu duyệt. Không tự bật billing/Blaze, tạo job dù paused, deploy worker hoặc nạp tiền. Budget alert cloud không phải công tắc cắt chi phí; cờ tắt app không dừng mọi phí lưu trữ.

Nguồn chính thức kiểm tra 22/10/2026: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [TTS](https://cloud.google.com/text-to-speech/pricing), [Scheduler](https://cloud.google.com/scheduler/pricing), [Tasks](https://cloud.google.com/tasks/pricing), [Run](https://cloud.google.com/run/pricing), [Storage](https://cloud.google.com/storage/pricing). Các con số cho model là đề xuất lựa chọn mới của người xây, không phải yêu cầu do người dùng chỉ định.

## Hợp đồng dữ liệu và API

Tất cả collection mới là top-level dưới `users/{uid}/` và có tiền tố `marketing`: `marketingBrand`, `marketingPlans`, `marketingItems`, `marketingBundles`, `marketingVersions`, `marketingAssets`, `marketingJobs`, `marketingApprovals`, `marketingBudget`, `marketingCosts`, `marketingNotifications`, `marketingOutbox`. Dùng ID không có slash; lưu schemaVersion, createdAt/updatedAt server timestamps. Quyền ghi là API/worker máy chủ; client chỉ đọc qua API được phân trang hoặc listener read-only đã xác thực. Không đưa chúng vào HubData/backup cũ nếu chưa có định dạng tài sản/khôi phục riêng.

Hợp đồng tối thiểu mẫu để task 1 triển khai, không phải code đã được thêm vào sản phẩm:

```ts
type Service = 'signature' | 'ai-training' | 'investment-training';
type Channel = 'zalo' | 'facebook' | 'tiktok' | 'youtube';
type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'uncertain'
  | 'blocked_budget' | 'waiting_material' | 'stale' | 'cancelled';
interface JobInput {
  schemaVersion: 1;
  uid: string; // populated server-side, never trusted from browser
  itemId: string;
  planRevision: number;
  bundleRevision: number;
  kind: 'draft' | 'image' | 'script' | 'speech' | 'render' | 'export';
  idempotencyKey: string;
}
interface CostReservation {
  monthVN: string;
  jobId: string;
  priceVersion: string;
  maximumVnd: number; // integer conservative bound
  state: 'reserved' | 'settled' | 'uncertain' | 'released';
}
```

API mới bên dưới `app/api/marketing/`, route Node.js, trả `Cache-Control: no-store`; JSON lỗi có code an toàn, không chứa prompt/secret. Bearer Firebase ID token từ người dùng, verifyIdToken với kiểm tra revoked và owner UID/email/disabled. Không dựa vào shell client guard để bảo vệ route. Server token/OIDC không thay thế quyền duyệt của người dùng.

- `GET status`: thiếu cấu hình/cờ bật, không trả credential hoặc tài sản công khai.
- `GET/PATCH brand`: schema hồ sơ, revision và trạng thái đã duyệt.
- `POST plans`: tạo lịch nháp; `PATCH plans/[id]`: chỉnh theo expectedRevision; `POST plans/[id]/approve`: duyệt revision.
- `GET bundles`: bộ lọc ngày/dịch vụ/trạng thái, phân trang; `GET/PATCH bundles/[id]`: đọc/sửa biến thể theo expectedRevision.
- `POST bundles/[id]/approve-script`: duyệt kịch bản; `POST bundles/[id]/approve`: duyệt các phiên bản tài sản/kênh được chỉ định; `POST bundles/[id]/retry`: yêu cầu lại stage hợp lệ, không retry uncertain tự động.
- `POST assets/upload`: trả upload URL ngắn hạn cho object ID máy chủ cấp; bước finalize kiểm tra type/kích thước/checksum và xác nhận nguồn; `POST bundles/[id]/export`: kiểm tra lại approval rồi tạo manifest/gói ZIP; `GET assets/[id]/download`: cấp link tải riêng tư có hạn.
- `POST schedule/prepare`, `POST schedule/notify`: chỉ OIDC từ scheduler; `HEAD` chỉ health check không gây tác dụng phụ.

Upload giới hạn đề xuất: PNG/JPEG ≤10MB; MP4 bản ghi ≤200MB; kiểm tra magic bytes, kích thước và ffprobe trong worker, không cho nội dung thực thi hoặc đường dẫn ngoài bucket được phép. Tệp còn chờ kiểm tra không được renderer dùng.

## Chuỗi thực hiện

### Task 1: Schema, ngày Việt Nam và máy trạng thái

**Files:** Create `lib/marketing/types.ts`, `lib/marketing/schemas.ts`, `lib/marketing/dates.ts`, `lib/marketing/state.ts`; Test `tests/marketing-domain.test.ts`.

1. Viết test cho lịch 30 mục/15 video mỗi dịch vụ, 4 kênh/bộ, tháng 28/29/30/31 ngày, khởi động giữa tháng, cấm duyệt khi còn claim chưa xác minh và stale revision.
2. Chạy `npm.cmd test -- tests/marketing-domain.test.ts`; kỳ vọng đỏ vì module/hàm mới chưa có.
3. Thêm Zod schema strict, enum, giới hạn chuỗi, expectedRevision; tính ngày bằng Intl timezone, không Date locale mặc định. Hàm phân lịch: 30 slots/service, base 1/ngày; tháng ngắn cho ngày cuối nhận slot thêm; 31 ngày để ngày cuối dự phòng. Cờ video 15 mục, chọn ngày xen kẽ rồi điều chỉnh theo kế hoạch đã duyệt.
4. Thêm máy trạng thái thuần: chỉ current approved plan mới enqueue; sửa script invalidates script/video approvals; sửa caption không buộc render nhưng invalidates approval kênh; không biến failed thành approved.
5. Chạy lại test, kỳ vọng xanh. Checkpoint diff chỉ schema/domain; không chạm cloud.

Ví dụ test hành vi cần có:
```ts
it('blocks a completion written against an older revision', () => {
  expect(canApplyCompletion({ expected: 3, current: 4 })).toBe(false);
});
it('does not silently reapprove modified content', () => {
  expect(editCaption(approvedBundle, 'facebook', 'Nội dung mới').approved).toBe(false);
});
```

### Task 2: API xác thực và Firestore rules chặn ghi tắt

**Files:** Create `lib/server/marketing/auth.ts`, `lib/server/marketing/http.ts`, `lib/server/marketing/store.ts`, `tests/marketing-auth.test.ts`, `tests/marketing-store.test.ts`, `tests/firestore-marketing.rules.test.ts`, `firebase.emulator.json`; Modify `firestore.rules`, `package.json`, `package-lock.json`.

1. Test request thiếu token, revoked, disabled, owner khác: từ chối trước khi đọc dữ liệu/gọi provider; stale revision trả 409; input uid không thay scope.
2. Chạy `npm.cmd test -- tests/marketing-auth.test.ts tests/marketing-store.test.ts`, kỳ vọng đỏ.
3. Tái dùng `firebaseAdmin()`/`ownerContext()` trong `lib/server/firebase-admin.ts`, bọc verify token và repository transaction, không copy credential init.
4. Viết rule emulator test: client owner có thể đọc Marketing đúng UID, không được ghi approval/job/budget; owner vẫn ghi collection nghiệp vụ cũ như trước; người khác không đọc/ghi. **Thay cấu trúc match wildcard cũ** bằng match collection/doc có điều kiện loại tiền tố Marketing và match Marketing read-only; không thêm deny dưới allow recursive hiện có vì các allow hợp lại theo OR. Bảo vệ cả nested path, không vô tình phá subcollection cũ; test rõ đường dẫn lồng nhau.
5. Thêm dev dependencies emulator/rules-unit-testing lúc thực thi, script `test:marketing-rules` chỉ nối emulator local (kiểm tra host loopback, không chạy production). Chạy test targeted và `npm.cmd run test:marketing-rules`; xanh trước task kế. Chưa deploy rules lên Firebase.

### Task 3: Sổ ngân sách và bản giá có phiên bản

**Files:** Create `lib/marketing/pricing.ts`, `lib/server/marketing/budget.ts`, `lib/server/marketing/prices.ts`, `tests/marketing-budget.test.ts`, `scripts/marketing-cost-estimate.mjs`; Modify `package.json`, `.env.example`.

1. Test 2 yêu cầu đồng thời không giữ chỗ vượt 1 triệu; cùng idempotency key chỉ giữ một lần; token/độ dài vượt cấu hình bị chặn; rollover theo VN; timeout không nhả reservation.
2. Chạy `npm.cmd test -- tests/marketing-budget.test.ts`, kỳ vọng đỏ.
3. Transaction kiểm tra `spent + reserved + worstCase <= limit`. Reserve trước provider call; settle theo usage; release chỉ khi xác nhận chưa tính phí. Model/giá chưa biết, giá hết hạn hoặc không tính được upper bound thì fail closed. Trần tính cả thuế/phụ phí do cấu hình, không mặc định giá USD là hóa đơn VND.
4. Bản giá JSON/version chứa model, đơn giá, rounding, currency giả định, ngày kiểm tra, source; priceVersion đóng vào reservation. Script estimate chỉ đọc tham số, không gọi API hoặc tạo tài nguyên. Thêm cảnh báo 80%, chặn 100%; chi phí ước tính/đã đối soát có nhãn riêng.
5. Chạy test và `node scripts/marketing-cost-estimate.mjs --offline`; đối chiếu bảng tính 300.720 VND giả định, gồm image overhead và search. Checkpoint không lộ khóa.

### Task 4: Outbox và Cloud Tasks bền vững

**Files:** Create `lib/server/marketing/jobs.ts`, `lib/server/marketing/outbox.ts`, `lib/server/marketing/tasks.ts`, `tests/marketing-jobs.test.ts`, `tests/marketing-outbox.test.ts`.

1. Test Firestore commit thành công nhưng enqueue lỗi, duplicate schedule, task retry, lease hết hạn, phiên bản kế hoạch bị thu hồi và provider result không rõ.
2. Chạy `npm.cmd test -- tests/marketing-jobs.test.ts tests/marketing-outbox.test.ts`; đỏ.
3. Transaction lưu job + outbox atomically, id job từ UID/item/revision/stage. Sau commit gọi Cloud Tasks bằng tên ổn định; ACK sau enqueue hoặc bảo đảm outbox sẽ được reconciliation xử lý. Không trả 'đã tạo' nếu chỉ ghi job mà không có cách đẩy lại.
4. Bổ sung reconciliation trong prepare/notify và một Cloud Task tên cố định để drain khi có backlog; chặn vòng lặp và tối đa 3 lần giao ở từng chu kỳ. Outbox có trạng thái pending/enqueued, lease 15 phút, nhận lại chỉ khi không có side effect bất định. Task payload chỉ IDs, reload và verify owner/revision từ server.
5. Chạy xanh; thử worker giả crash trước và sau provider call. Uncertain phải treo budget, không tự tạo lại ảnh/audio đã có thể bị tính phí. Ghi runbook xử lý outbox không tự hồi được.

### Task 5: Hồ sơ thương hiệu và thư viện riêng tư

**Files:** Create `app/api/marketing/brand/route.ts`, `app/api/marketing/assets/upload/route.ts`, `app/api/marketing/assets/[id]/finalize/route.ts`, `lib/server/marketing/assets.ts`, `lib/marketing/brand.ts`, `tests/marketing-brand.test.ts`, `tests/marketing-assets.test.ts`.

1. Test thiếu bảng giá không sinh giá; upload khác UID, sai MIME, asset chưa kiểm tra và object key do request tùy ý đều bị chặn.
2. Chạy hai test mới, đỏ.
3. Lưu profile có revision, 3 service descriptors, policy nguồn và quyền dùng tài sản. Tên Đạt Nguyễn mặc định; logo chữ là đề xuất chưa duyệt, không giả tư liệu người dùng.
4. Dùng SDK Cloud Storage với ADC/service account thích hợp; bucket Marketing riêng tư, upload URL TTL 10 phút, download TTL 5 phút; finalize kiểm tra object metadata/checksum rồi enqueue media probe. Không dùng download token công khai lâu dài. Không tự tạo bucket ở task này.
5. Chạy xanh; validate cache headers, allowlist bucket/key, giới hạn file; UI sẽ có trạng thái chưa thiết lập khi bucket chưa được cấp.

### Task 6: Adapter AI và kiểm tra nguồn

**Files:** Create `lib/marketing/provider.ts`, `lib/marketing/prompts.ts`, `lib/server/marketing/providers/gemini.ts`, `lib/server/marketing/providers/speech.ts`, `lib/server/marketing/claims.ts`, `tests/marketing-provider.test.ts`, `tests/marketing-claims.test.ts`.

1. Test provider giả trả JSON sai/thiếu kênh, cố bịa giá, prompt injection trong tài liệu, output vượt token, image lỗi và claim số liệu chưa có nguồn.
2. Chạy test mới, đỏ.
3. Adapter có `generatePlan`, `generateBundle`, `generateImage`, `synthesizeSpeech`, result gồm usage/model/requestId và status xác định/uncertain. Retry chỉ ở lớp job có ngân sách, không retry ẩn trong SDK. Abort/timeout không mặc định nghĩa là chưa tính phí.
4. Structured output strict; tách instructions và untrusted source. Lưu provenance theo claim: URL/tài liệu, trích đoạn ngắn hợp lệ, checkedAt, phạm vi đã kiểm tra. Nếu có URL fetch, chặn private IP/redirect nội bộ, giới hạn bytes/thời gian; không duyệt claim chỉ vì có URL. Search có quota/chi phí riêng, không bật unrestricted browsing. Những claim không kiểm chứng phải loại bỏ hoặc chặn final approval.
5. Chạy xanh với fixture chỉ nằm `tests/fixtures/marketing/`; chưa dùng khóa thật. Config model/API key server-only, thiếu cấu hình trả lỗi rõ, không runtime fallback mock.

### Task 7: Lịch tháng và duyệt kế hoạch

**Files:** Create `lib/server/marketing/plans.ts`, `app/api/marketing/plans/route.ts`, `app/api/marketing/plans/[id]/route.ts`, `app/api/marketing/plans/[id]/approve/route.ts`, `tests/marketing-plans.test.ts`.

1. Test duyệt một phần, race chỉnh/duyệt, giới hạn 90/45, ngày quá khứ, tháng mới và 4 channel variants khác cùng chủ đề.
2. Chạy test đỏ; implement tạo plan skeleton theo lịch deterministic + AI đề xuất chủ đề qua job, không chờ 90 bài trong route HTTP.
3. API dùng expectedRevision, job input chụp brandRevision/planRevision; duyệt exact item revisions. Kế hoạch chưa AI xong/không đủ trường không được approve. Chủ đề trùng được cảnh báo và yêu cầu chỉnh.
4. Cho tạo/duyệt sẵn tháng tiếp theo; khi chưa có thì thông báo thiếu, không tự approve hoặc tự bù ngày cũ. Các ngày quá khứ chỉ chạy nếu chủ sở hữu yêu cầu riêng rõ ràng và đủ quota.
5. Chạy xanh; kiểm tra API 401/403/409/422, không tin body uid/approved=true.

### Task 8: Soạn bộ nội dung và phê duyệt phiên bản

**Files:** Create `lib/server/marketing/bundles.ts`, `lib/server/marketing/agent.ts`, `app/api/marketing/bundles/route.ts`, `app/api/marketing/bundles/[id]/route.ts`, `app/api/marketing/bundles/[id]/approve/route.ts`, `app/api/marketing/bundles/[id]/approve-script/route.ts`, `app/api/marketing/bundles/[id]/retry/route.ts`, `tests/marketing-agent.test.ts`, `tests/marketing-approvals.test.ts`.

1. Test stage chưa kế hoạch duyệt bị từ chối; một bộ sinh 4 variants, ảnh dùng chung, script approval trước speech/render; sửa caption invalidates đúng kênh; asset đã lỗi thời không tải thành bản đăng.
2. Chạy đỏ; implement hữu hạn draft → claims → image → script (nếu cần) → waiting approval → speech → render → final review. Không tự gọi renderer từ POST approve trước transaction approval hoàn tất.
3. Content hash/manifest ghi exact text revision, asset IDs, script revision; concurrent change trả 409. Tách generation state khỏi approval state, không dùng một boolean chung cho tất cả.
4. Thiếu bản ghi hướng dẫn để waiting_material; lựa chọn chuyển sang video kiến thức cần người dùng duyệt lại mục kế hoạch, không tự thay nội dung. Token, scene count, script length và retries capped.
5. Chạy xanh; job completion cũ được stale, ghi audit, không làm mất nội dung chỉnh tay hoặc đếm thêm sản lượng.

### Task 9: Cloud Run worker và FFmpeg renderer

**Files:** Create `services/marketing-worker/package.json`, `services/marketing-worker/tsconfig.json`, `services/marketing-worker/src/server.ts`, `services/marketing-worker/src/dispatch.ts`, `services/marketing-worker/src/render.ts`, `services/marketing-worker/Dockerfile`, `services/marketing-worker/fonts/README.md`, `tests/marketing-render-contract.test.ts`, `scripts/check-marketing-render.mjs`.

1. Test manifest không được truyền shell args/path/URL tùy ý, input asset sai UID hoặc chưa duyệt, stale job; contract kiểm tra codec/duration/subtitle timing.
2. Chạy đỏ; chọn Node runtime đang hỗ trợ và pin base image/dependencies lúc triển khai. HTTP worker chỉ nhận Cloud Tasks OIDC/service account đã allowlist; Cloud Run IAM invoker riêng, không public unauthenticated.
3. Renderer tải asset riêng tư đã allowlist, dựng 1080×1920, 30fps, AAC/H.264; `spawn` args array, `shell:false`; workdir tạm riêng job, dọn đúng resolved directory trong finally. Dùng font Việt có giấy phép tương thích; không dùng bản thiếu glyph. Worker lưu MP4/checksum vào bucket trước ghi succeeded.
4. Subtitle dùng TTS SSML mark timepoints nếu voice hỗ trợ; nếu không hỗ trợ chia TTS từng đoạn có thời lượng ffprobe, ghép audio và tính SRT bằng độ dài đo được. Không chia đều thời gian tùy ý rồi coi đã đồng bộ. Có chữ/ảnh chuyển cảnh nhẹ, logo, màn kết, nhạc mặc định tắt. Không giả clip thao tác thật bằng hình sinh.
5. Chạy test contract; smoke local dùng audio/ảnh test tạo cục bộ, không gọi AI hoặc cloud; `node scripts/check-marketing-render.mjs --input <local-file>` dùng ffprobe và xác nhận frame/subtitle tiếng Việt. Thiếu Docker/FFmpeg ghi block kiểm tra thật, không fake pass. Package worker có lockfile riêng; deployment chưa thực hiện.

### Task 10: Xuất bản tải về và bảo vệ tài sản

**Files:** Create `lib/server/marketing/export.ts`, `app/api/marketing/bundles/[id]/export/route.ts`, `app/api/marketing/assets/[id]/download/route.ts`, `tests/marketing-export.test.ts`.

1. Test ZIP không chứa draft/unapproved assets, tên file an toàn, bộ không video không sinh MP4, approval bị thu hồi trước export hoàn tất và user khác không lấy signed URL.
2. Chạy đỏ; implement snapshot manifest sau transaction kiểm tra approval; pack UTF-8 TXT từng kênh + ảnh + MP4/SRT hợp lệ + manifest nguồn/version. Job tạo ZIP lớn ở worker, không nhồi RAM Vercel.
3. File download có Content-Disposition, expiry, checksum; route rechecks owner/current approval trước phát link. Signed URL đã phát có thể còn dùng đến hết TTL: ghi rõ giới hạn này; không hứa revoke tức thì khi sửa bài. Gói mới không dùng asset revoked.
4. Xuất nháp riêng chỉ khi action chỉ rõ 'Tải bản nháp', watermark/manifest nháp; button 'Tải bản đăng' luôn qua approval. Xử lý tệp chưa xong và mất object không báo thành công.
5. Chạy xanh và thử giải nén bằng công cụ local, mở UTF-8 tiếng Việt; không lấy ảnh/video sample thành kết quả AI thật.

### Task 11: Scheduler OIDC và Telegram 08:00

**Files:** Create `lib/server/marketing/schedule-auth.ts`, `lib/server/marketing/daily.ts`, `lib/server/marketing/notify.ts`, `app/api/marketing/schedule/prepare/route.ts`, `app/api/marketing/schedule/notify/route.ts`, `tests/marketing-schedule.test.ts`, `tests/marketing-notify.test.ts`.

1. Test wrong issuer/audience/email, token hết hạn, request replay, VN midnight, duplicate job, absence of plan, failure image, budget block, Telegram uncertain và lịch 07:00 không bị thay đổi.
2. Chạy đỏ; dùng Google auth library verify signed OIDC, email_verified và đúng scheduler service account; pin audience origin/route theo job. Không coi X-CloudScheduler headers là auth.
3. Kiểm tra tên job allowlist, scheduleTime hợp lệ và cửa sổ tối đa 60 phút từ lịch gốc; kiểm tra đúng cron dự kiến. Ngoài cửa sổ ghi skipped_late và không gửi/prepare bù. Chuẩn bị ngày D+1 lúc 20:00; notify ngày D lúc 08:00; danh tính owner/chat cấu hình máy chủ.
4. Journal `marketingNotifications/{dateVN}` có pending/sending/sent/uncertain/failed và messageId. Tái dùng `telegramSender` trong `lib/telegram-transport.ts`, giữ retry-after/unknown semantics; không dùng journal `telegramReports` cũ. Header health HEAD không gọi send. Có reconcile outbox trước tổng hợp trạng thái, không báo sai '3 bộ sẵn sàng'.
5. Chạy xanh; `vercel.json` và route cron 07:00 không bị thay trong task này. Không gọi getUpdates, setWebhook hay sendMessage thật.

### Task 12: UI Marketing theo bố cục đã duyệt

**Files:** Create `app/(hub)/marketing/page.tsx`, `app/(hub)/marketing/marketing.module.css`, `components/marketing/studio.tsx`, `components/marketing/service-picker.tsx`, `components/marketing/preview.tsx`, `components/marketing/approval-controls.tsx`, `components/marketing/provider.tsx`, `lib/marketing/client.ts`, `tests/marketing-ui.test.tsx`; Modify `components/shell.tsx`.

1. Viết test hành vi chuyển dịch vụ/kênh, giữ draft người dùng khi server cập nhật, 409 reload có chọn lọc, disable export khi chưa duyệt, lỗi/thiếu cấu hình, keyboard dialog và mobile nav. Không test màu/class.
2. Chạy đỏ; thêm một mục Marketing vào HubShell, giữ các routes cũ. Nội bộ Marketing có nav bên trái tại desktop và menu gọn mobile, không nhân đôi global shell. Nếu cần đổi rộng shell ngoài Marketing, trình lại thay đổi bố cục thay vì làm ngầm.
3. React UI dùng dữ liệu API/Firebase thật. Loading/empty/error riêng; không hiện 18/90 hoặc 240.000đ từ mockup. UI progress phản ánh queued/running/waiting_material/uncertain, không fake animation = xong.
4. Auth ID token lấy từ Firebase user đang đăng nhập, refresh theo SDK; không lưu token/khóa AI vào localStorage. Label/textarea, focus trap/return, aria-live thông báo, reduced motion và responsive 390/768/1440px.
5. Chạy `npm.cmd test -- tests/marketing-ui.test.tsx tests/ui.test.tsx tests/hub-provider.test.tsx`; kiểm tra layout với ảnh chụp nếu có browser, ghi giới hạn khi chỉ có HTTP. Không nói E2E đã đạt nếu chưa login/thao tác thật.

### Task 13: Màn hình kế hoạch, hồ sơ, chi phí và readiness

**Files:** Create `components/marketing/calendar.tsx`, `components/marketing/brand-editor.tsx`, `components/marketing/budget-panel.tsx`, `components/marketing/setup-status.tsx`, `app/api/marketing/status/route.ts`, `tests/marketing-settings.test.tsx`.

1. Test brand thiếu dữ liệu thật, plan chưa duyệt, cờ tắt, model chưa cấu hình, budget reservation hiển thị riêng spent, và người dùng không đổi hard cap qua client request.
2. Chạy đỏ; dựng calendar lọc 3 dịch vụ, approve revision/per-item, planned vs ready vs video hoàn chỉnh. Thư viện hỗ trợ nhập mô tả và upload tư liệu được phép.
3. Readiness liệt kê thiếu server identity, key/model, bucket, queue/worker, scheduler verified và Telegram config; không coi env có giá trị là job đã chạy. Chỉ chủ sở hữu xem chi tiết readiness, public status không chứa IDs/tài liệu nhạy cảm.
4. Cờ server riêng: `MARKETING_ENABLED`, `MARKETING_GENERATION_ENABLED`, `MARKETING_SCHEDULE_ENABLED`, `MARKETING_TELEGRAM_ENABLED`, tất cả false mặc định. ENV model/key, scheduler SA/audiences, task SA/worker URL/queue, bucket, price version và daily caps được ghi `.env.example` không giá trị thật.
5. Chạy xanh; kiểm tra npm build không cần credential cloud và không gọi AI khi render SSR/build.

### Task 14: Hạ tầng và tài liệu vận hành dưới dạng chưa áp dụng

**Files:** Create `infra/marketing/main.tf`, `infra/marketing/variables.tf`, `infra/marketing/outputs.tf`, `infra/marketing/README.md`, `infra/marketing/terraform.tfvars.example`, `docs/marketing-setup.md`, `docs/marketing-operations.md`, `docs/marketing-costs.md`; Modify `.gitignore` nếu cần loại `.terraform`, state, tfvars thật.

1. Ghi đầy đủ region/SA roles/queue/worker/bucket và 2 scheduler job; cấu hình định danh API audience đúng với production URL hiện tại, không dựa domain cũ đã xóa. Không chạy terraform init/plan kết nối cloud/apply lúc viết tài liệu.
2. Queue: maxConcurrentDispatches 1, retry hữu hạn 3, request timeout phù hợp worker, giới hạn body; task drain có backoff. Worker: max instances 1, min 0, tài nguyên đề xuất ở trên; container image version cố định. Scheduler: retries hữu hạn trong cửa sổ 60 phút.
3. IAM tối thiểu: scheduler chỉ invocation Vercel OIDC; enqueuer chỉ queue cần thiết và actAs task SA; worker chỉ đọc/ghi namespace Marketing qua code và bucket riêng; không cấp Editor/Owner toàn project. Firebase Admin dùng IAM không chịu rules, cần allowlist UID/namespace trong repository; IAM Firestore không được tuyên bố giới hạn collection tuyệt đối nếu nền tảng không hỗ trợ.
4. Không dùng Firebase Web key làm credential Admin. Tài liệu hướng dẫn quota/billing, scope phần mềm cũ, hạn mức provider, cost guard, cleanup scratch, logs retention, ký URL và cách tắt lịch/job/queue khi sự cố. Không ghi secret vào tfstate đầu vào; dùng Secret Manager reference và service identity ở Cloud Run, credential Vercel chỉ theo cơ chế hiện có hoặc federation đã kiểm chứng.
5. Dự toán đủ Google services, Vercel usage và lưu trữ lâu dài; không tự đặt lifecycle xóa thành phẩm người dùng chưa đồng ý. Chỉ đề xuất dọn scratch sau 7 ngày, giữ asset đang dùng; chính sách xóa thật cần xác nhận trước khi áp dụng. Terraform validate/offline kiểm tra cú pháp nếu có CLI, không provision.

### Task 15: Kiểm tra tích hợp và dự toán trước kích hoạt

**Files:** Create `tests/marketing-integration.test.ts`, `docs/verification/2026-10-22-marketing-agent.md`, `scripts/check-marketing-setup.mjs`; Modify `package.json`, `docs/marketing-costs.md`.

1. Chạy flow giả lập end-to-end máy chủ: brand → plan → approve → scheduler prepare → task jobs → bundles/image → script approve → speech/render → final approve → export → Telegram fake. Fixture nằm tests, credentials giả; không seed production.
2. Chạy `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`; test rules emulator và worker package build riêng. Không tự nới test cũ để chấp nhận regression. Kiểm tra SSR hydration không dùng random/date khác nhau server/client.
3. Script setup read-only, redacted: xác nhận identity/owner, model có tồn tại/quyền truy cập bằng cơ chế không phát sinh inference khi provider hỗ trợ; tính readiness, không gửi Telegram/gọi AI trả phí. Nếu không thể kiểm tra miễn phí ghi 'chưa xác minh'. Không đọc/in file secrets.
4. Sau khi báo đủ chi phí benchmark và có chấp thuận dùng tiền, benchmark nhỏ có giới hạn (đề xuất tối đa 50.000 VND, vẫn tính trong ngân sách tháng): 1 bộ/dịch vụ, ít nhất 1 MP4 kiến thức và 1 hướng dẫn chỉ khi có bản ghi thật; kiểm tra giọng Việt, chữ có dấu, đồng bộ phụ đề và thời gian dựng. Người dùng nghe duyệt giọng. Thiếu clip thì đánh dấu chưa nghiệm thu video hướng dẫn, không dựng giả để qua test.
5. Cập nhật bảng dự toán bằng usage/region/billing thực, báo mục tiêu 90/45 có đạt dưới trần không và phần hạ tầng riêng; nếu không đạt trình điều chỉnh. Đây là bước xin bật cụ thể sau khi toàn bộ phần có thể làm offline đã hoàn tất. Không yêu cầu lại duyệt thiết kế hoặc từng sửa code thông thường.

### Task 16: Bật production sau khi chi phí/cấu hình được duyệt

**Files:** Update `docs/verification/2026-10-22-marketing-agent.md`, `docs/marketing-operations.md`; áp dụng cấu hình cloud đã được người dùng duyệt, không tạo secret value trong Git.

1. Ghi chấp thuận thực tế về ngân sách hạ tầng/benchmark, quyền billing/quota và scope project; thiếu thì không apply. Bảo toàn Firestore hiện có và không thay bot token/webhook.
2. Deploy API/UI cùng rules read-only Marketing trước; mọi cờ generation/schedule/send vẫn false. Tạo worker, queue, bucket và IAM theo plan đã kiểm tra; deploy worker image có version; kiểm tra private access và invalid token thật.
3. Kiểm thử một bộ thật với chủ sở hữu đăng nhập, kiểm tra object ACL, MP4 phát trên điện thoại, gói tải đúng phiên bản và thu hồi duyệt. Tin Telegram thật chỉ theo quyền đã xác nhận, nội dung báo đúng trạng thái; lần test phải được nêu rõ, không gửi dữ liệu giả như báo cáo vận hành thật.
4. Chỉ sau pass mới tạo hai Scheduler job và bật cờ cần thiết; kiểm tra job timezone/audience/SA/target/retry. Không chuyển cron 07:00 sang Scheduler mới trong phạm vi Marketing này.
5. Theo dõi lần 20:00 và 08:00 đầu tiên bằng journal/usage/Telegram, ghi actual scheduled/delivered times; không kết luận đúng giờ chỉ từ cron expression. Rollback: tắt cờ enqueue/send, dừng scheduler và pause queue, không xóa tài sản/dữ liệu nghiệp vụ. Phí storage có thể còn sau khi pause; thông báo rõ.

## Điều kiện hoàn tất và bàn giao

Cập nhật thực thi 22/10/2026: đã triển khai nền tảng nghiệp vụ/API/UI, adapter AI, hàng đợi/worker, renderer, export, lịch/thông báo và cấu hình hạ tầng; 126 test ứng dụng và 3 test rules đã đạt, build/lint/typecheck/worker/MP4 smoke/Terraform validate đã qua. Task15 còn benchmark trả phí và xác minh luồng đã đăng nhập bằng tài khoản thật; Task16 chưa bắt đầu vì chưa có cấu hình vận hành/billing và chấp thuận kích hoạt theo bảng chi phí thực tế. Không xem mã hạ tầng đã validate là tài nguyên đã deploy. Báo cáo đầy đủ: `docs/verification/2026-10-22-marketing-agent.md`.

- Mã/kiểm thử cục bộ có thể hoàn thành trước khi có billing/credential; không đánh dấu tích hợp thật hoàn tất nếu chưa benchmark/triển khai.
- 90/45 là mục tiêu đã thống nhất, không thay bằng tạo 90 caption dùng lặp cùng một ảnh hoặc video mẫu. Bốn kênh có phần văn bản riêng nhưng ảnh/video có thể dùng chung đúng kế hoạch.
- Báo cáo bàn giao nêu mã thay đổi, test thực chạy, chi phí dự toán và thực đo, tính năng đang bật, giới hạn/chưa nghiệm thu. Không tuyên bố lịch hoạt động lúc 08:00 nếu chưa quan sát lần chạy thật.
- Có thể thực hiện tuần tự ngay trong phiên hiện tại, hoặc bàn giao nguyên kế hoạch cho một phiên triển khai riêng. Phân chia subagent chỉ khi workflow được chọn và skill cần thiết thực sự có sẵn; không bắt người dùng chọn công nghệ hoặc phê duyệt lại thiết kế đã duyệt.
