# AI Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Thay Cài đặt AI mô phỏng bằng màn hình quản lý khóa Gemini mã hóa, chọn model theo công việc và ngân sách Marketing được thực thi ở máy chủ.

**Architecture:** Giữ Next.js/Firebase/Vercel và luồng Marketing hiện có. Một module settings phía máy chủ quản lý credential, cấu hình công khai và ngân sách; API cùng worker dùng chung resolver, không lấy khóa từ browser storage. Các cờ kích hoạt hiện có vẫn là chốt bắt buộc và giữ tắt; lưu khóa hoặc ngân sách không bật dịch vụ trả phí.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Node.js crypto, Firebase Admin/Firestore, Vitest, Testing Library, Firestore Rules Emulator.

---

## Hợp đồng bàn giao

Thiết kế nguồn đã được duyệt: `docs/superpowers/specs/2026-10-22-ai-settings-design.md`. Phạm vi nhà cung cấp: Gemini trước; không tự thêm OpenRouter. Tham chiếu giao diện: `.superpowers/brainstorm/2375-1792675345/content/ai-settings-preview-v2.html` nếu còn tồn tại. Khi không có file này, lấy bố cục trong tài liệu thiết kế và theme `app/globals.css`; không tự tạo lại cơ chế mô phỏng.

Kế hoạch này chưa thực hiện code, tạo khóa chủ, ghi Firebase production, gọi AI hoặc triển khai. Khi thực hiện, dùng checkout/worktree riêng nếu phù hợp với môi trường, giữ nguyên thay đổi của người dùng. Không đọc/in nội dung `.secrets`, không tìm hoặc tự sử dụng khóa AI có sẵn trong file ngoài phạm vi cấu hình đã duyệt.

Tham chiếu kỹ năng khi thực hiện: @vercel-react-best-practices cho React/Next.js; @vercel:verification cho kiểm tra luồng thật; @vercel:env-vars khi quản lý khóa chủ; @ui-ux-pro-max khi dựng UI. Đọc guide liên quan trong `node_modules/next/dist/docs/` theo `AGENTS.md` trước khi sửa Next.js. Các kỹ năng thực thi ở header chỉ dùng nếu có trong môi trường; nếu thiếu thì thực hiện từng bước theo quy trình công cụ sẵn có, không tuyên bố đã dùng kỹ năng chưa đọc.

Mỗi task dưới đây gồm bước RED → triển khai nhỏ nhất → GREEN → commit riêng, chỉ stage các file thuộc task. Không cần chạy lại toàn bộ suite sau từng thay đổi nhỏ; chạy test mục tiêu rồi toàn bộ một lần khi tích hợp. Không dùng kết quả test fake để khẳng định provider/cloud thật hoạt động.

## Task 1: Xác minh nhà cung cấp và chốt danh mục khả dụng

**Files:** Create `docs/ai-settings-provider-validation.md`, `lib/ai-settings/catalog.ts`; Test `tests/ai-settings-catalog.test.ts`.

1. Đọc tài liệu chính thức Gemini về danh mục model, năng lực văn bản/ảnh, giá, usage metadata và phương thức kiểm tra khóa không tạo nội dung. Đọc tài liệu Google TTS riêng, không coi API key Gemini là danh tính TTS. Ghi URL trực tiếp, ngày xác minh và giới hạn từng kết luận vào tài liệu. Không gửi request bằng khóa thật, không chốt theo tên ứng viên đang hardcode.
2. Viết test catalog: model chưa được xác minh, giá hết hạn, năng lực không khớp hoặc catalog rỗng đều không được dùng để phát sinh phí. Model chính mỗi năng lực tối đa một; fallback mặc định rỗng.
3. Run `npm.cmd test -- tests/ai-settings-catalog.test.ts` → FAIL vì module chưa có.
4. Tạo catalog bất biến và hàm chọn thuần; giá lưu theo đơn vị rõ ràng, có priceVersion, nguồn và validUntil. Không xác minh được thì trả blocked, không bịa giá/khả năng.

```ts
export type Capability = 'text' | 'image' | 'speech' | 'render';
export type ModelChoice = {
  provider: 'gemini' | 'google-tts' | 'template';
  model: string;
  capability: Capability;
  verifiedAt: string;
  validUntil: string;
  priceVersion: string;
};
export function usable(choice: ModelChoice, now: number): boolean {
  return Number.isFinite(Date.parse(choice.validUntil)) &&
    Date.parse(choice.validUntil) > now;
}
```

5. Run test mục tiêu → PASS. Commit `docs: validate AI provider capabilities and catalog` với đúng ba file trên. Nếu chưa xác minh được miễn phí thì chức năng kiểm tra chỉ báo cần cấu hình/kiểm thử, không tự chuyển sang generateContent.

## Task 2: Schema settings, DTO và trạng thái an toàn

**Files:** Create `lib/ai-settings/types.ts`, `lib/ai-settings/domain.ts`; Test `tests/ai-settings-domain.test.ts`; read `lib/marketing/types.ts`.

1. Viết test cho body strict: provider chỉ Gemini, key là chuỗi trim không rỗng và giới hạn 512 ký tự; không nhận base URL/model ID tùy ý; revision nguyên không âm; monthlyLimit là số nguyên đồng an toàn ≥ 0. DTO không chứa bất kỳ trường mật mã/plaintext nào.
2. Run `npm.cmd test -- tests/ai-settings-domain.test.ts` → FAIL.
3. Tạo schemas và hàm map explicit, không spread dữ liệu Firestore vào response. Dùng các contract sau:

```ts
type CredentialView = {
  provider: 'gemini'; source: 'app' | 'environment' | 'none';
  configured: boolean; suffix: string | null; revision: number;
  updatedAt: string | null;
  check: { state: 'unchecked' | 'checking' | 'valid' | 'error';
    checkedAt: string | null; code: string | null; scope: 'metadata' | null };
};
type SettingsView = {
  credential: CredentialView;
  budget: { month: string; spent: number; reserved: number; limit: number;
    remaining: number; warning: boolean; revision: number };
  capabilities: { id: string; state: 'missing' | 'unchecked' | 'ready' | 'error'; reasons: string[] }[];
  activation: { desired: boolean; effective: boolean; reasons: string[] };
};
```

`remaining = max(0, limit - spent - reserved)`, cảnh báo `limit > 0 && spent + reserved >= limit * 0.8`; limit 0 là chặn chi phí, không phải unlimited. Credential quá ngắn không lộ suffix. API không trả key, kể cả khóa env.
4. Run test → PASS. Commit `feat: define AI settings contracts`.

## Task 3: Mã hóa credential và kiểm chứng tamper

**Files:** Create `lib/server/ai-settings/crypto.ts`; Test `tests/ai-settings-crypto.test.ts`; Modify `.env.example` chỉ thêm tên biến và giá trị trống.

1. Viết test round-trip, nonce khác nhau cho hai lần mã hóa cùng plaintext, sửa ciphertext/tag/AAD phải thất bại, sai/thiếu khóa chủ phải thất bại và lỗi không chứa plaintext. Test khóa chủ base64 giải mã đúng 32 byte, từ chối định dạng khác.
2. Run `npm.cmd test -- tests/ai-settings-crypto.test.ts` → FAIL.
3. Dùng Node crypto `randomBytes(12)`, `createCipheriv('aes-256-gcm', master, nonce)` và `createDecipheriv`. AAD dùng serialization ổn định:

```ts
const aad = Buffer.from(JSON.stringify(['business-hub-ai-v1', uid, 'gemini', revision]));
// Encrypt: setAAD(aad), update + final, getAuthTag().
// Decrypt: setAAD(aad), setAuthTag(tag), update + final.
// Persist only { algorithm: 'aes-256-gcm', keyVersion: 1, nonce, ciphertext, tag }.
```

Đọc `AI_SETTINGS_ENCRYPTION_KEY` chỉ ở server; dùng mã lỗi ổn định, không log input. Không generate/fallback master key tại runtime. Có keyVersion nhưng chưa làm giao diện rotate master.
4. Run test → PASS. Commit `feat: encrypt AI credentials on the server`.

## Task 4: Kho credential, tombstone, resolver và audit

**Files:** Create `lib/server/ai-settings/credentials.ts`; Modify `tests/marketing-fake-store.ts` nếu cần khả năng doc/delete/root-path; Test `tests/ai-settings-credentials.test.ts`.

1. Viết test create/replace/delete theo expectedRevision, transaction conflict không mất khóa cũ, ciphertext duy nhất ở `privateAiCredentials/{uid}/providers/gemini`, tombstone không fallback env, thay khóa invalidates check, DTO không lộ bí mật.
2. Run `npm.cmd test -- tests/ai-settings-credentials.test.ts` → FAIL.
3. Implement đọc metadata, lưu/thay, xóa ciphertext + tombstone, resolve cho task và audit sanitized. Sau xóa vẫn giữ revision/tombstone để chặn env fallback. Nếu chưa có document ứng dụng, env cũ được báo source environment; lần sửa/xóa đầu phải tạo record chặn fallback tương ứng. Thiếu/sai master không được ghi đè document active; chủ sở hữu vẫn có thể thay bằng khóa mới khi master đã được cấu hình hợp lệ.
4. Audit ở `privateAiAudit/{uid}/events/{eventId}` chỉ action/provider/revision/UID/time/result/code; không suffix/credential/envelope/request body. Thao tác mutation và audit thành công được ghi transaction cùng credential. Không cache decrypted keys qua request/job.
5. Run test → PASS. Commit `feat: persist private AI credential revisions`.

## Task 5: Bảo vệ API, giới hạn tần suất và Firestore rules

**Files:** Create `lib/server/ai-settings/guard.ts`; Modify `firestore.rules`, `tests/firestore-marketing.rules.test.ts`; Create `tests/ai-settings-guard.test.ts`.

1. Viết test bearer thiếu/sai/khác owner, UID không khớp; Origin lạ/thiếu bị chặn với mutation từ browser; vượt body/rate limit trả 413/429. Rules emulator phải từ chối owner và anonymous đọc/ghi root credential, audit, rate-limit và settings bằng client SDK.
2. Run `npm.cmd test -- tests/ai-settings-guard.test.ts` và `npm.cmd run test:marketing-rules` → RED cho trường hợp mới.
3. Dùng `requireOwner` hiện có; Origin allowlist cố định từ cấu hình triển khai, không tin request Host/X-Forwarded-Host tùy ý. Đọc body có giới hạn byte 8 KB bằng stream, không chỉ kiểm tra sau khi nạp không giới hạn. Chỉ nhận JSON cho mutation, strict schema từ Task 2.
4. Rate limit transaction theo UID/action trong root `privateAiRateLimits`, không dùng bộ nhớ instance Vercel: khởi điểm 10 mutations/phút, 5 checks/phút; kiểm thử clock/window. Rules root mặc định deny đã có; thêm deny rõ để thể hiện ý định. Không mở rộng allow của nhánh users. Cấu hình công khai chuẩn ở `users/{uid}/marketingSettings/ai` vẫn server-write-only theo rules marketing hiện có.
5. Run cả hai test → PASS. Commit `feat: secure AI settings access and Firestore paths`.

## Task 6: Ngân sách cấu hình được, dùng chung ledger

**Files:** Create `lib/server/ai-settings/budget.ts`; Modify `lib/server/marketing/store.ts`, `lib/server/marketing/api.ts`; Test `tests/ai-settings-budget.test.ts`, `tests/marketing-integration.test.ts`.

1. Viết test thay hạn mức hiện tại và mặc định tháng sau, từ chối hạ dưới spent+reserved, limit 0, cập nhật cạnh tranh reserve/update, reservation cũ không mất và rollover đúng tháng Việt Nam. Test idempotent reserve không giữ hai lần và unknown usage không giải phóng giữ chỗ.
2. Run `npm.cmd test -- tests/ai-settings-budget.test.ts tests/marketing-integration.test.ts` → RED.
3. Transaction sửa hạn mức đọc settings revision + ledger tháng hiện tại rồi ghi cả hai. Mặc định 1M chỉ dùng khi settings chưa tồn tại. Khi reserve, đọc settings + ledger + cost cùng transaction; ledger hiện tại có limit thì không bị ghi đè bằng MONTHLY_LIMIT. Khi đổi tháng, ledger mới lấy default mới; chuyển reservation chưa gửi phải kiểm tra limit tháng mới như hiện tại. `settle` tiếp tục ghi đúng tháng trong cost record, không lấy tháng hiện tại thay thế.

```ts
if (nextLimit < spent + reserved) throw new Error('ai_budget_below_committed');
const effectiveLimit = ledger?.limit ?? settings?.monthlyLimit ?? MONTHLY_LIMIT;
const nextReserved = reserveAmount({ spent, reserved }, maximum, effectiveLimit);
// Persist effectiveLimit, never overwrite a saved user limit with MONTHLY_LIMIT.
```

4. Dashboard Marketing và Cài đặt đọc cùng nguồn; UI 80% dựa trên ledger thực, không tính từ số bundle. Run tests → PASS. Commit `feat: enforce configurable Marketing budget atomically`.

## Task 7: API settings và kiểm tra metadata không sinh nội dung

**Files:** Create `app/api/ai-settings/[[...path]]/route.ts`, `lib/server/ai-settings/api.ts`, `lib/server/ai-settings/check.ts`, `lib/ai-settings/client.ts`; Test `tests/ai-settings-api.test.ts`, `tests/ai-settings-client.test.ts`.

1. Viết contract tests: GET metadata, PUT credential `{provider,key,revision}`, DELETE credential `{provider,revision}`, POST credential/check `{provider,revision}`, PATCH budget `{monthlyLimit,revision}`. Thành công trả DTO canonical mới, mutation không gọi generateContent/Google TTS. Test empty/HTML/malformed JSON, auth 401/403, conflict 409, blocked 503, throttle 429, timeout và abort client.
2. Run `npm.cmd test -- tests/ai-settings-api.test.ts tests/ai-settings-client.test.ts` → FAIL.
3. Route Node.js gọi handler; các nhánh mutation áp dụng guard và trả JSON `Cache-Control: no-store`. Errors từ mã allowlist, không trả exception provider. Client Firebase ID token dùng Authorization, deadline cho token/fetch/body, không ghi storage; có thể tách helper request hiện có từ `lib/marketing/client.ts` khi hợp lý, giữ regression tests Marketing.
4. POST check chỉ dùng endpoint metadata Task 1 đã xác minh; key trong header, không URL, timeout 10 giây, không retry tự động. Lưu kết quả với điều kiện credential revision chưa đổi; kiểm tra cũ hoàn tất muộn không làm khóa mới được đánh dấu valid. Kết quả ghi rõ scope metadata, không đánh dấu image/speech/render ready từ một phép check text. Chưa chứng minh endpoint không tính phí thì trả `ai_check_needs_confirmation`, không gọi provider.
5. Đợt này không thêm endpoint chạy thử trả phí: nút trình bày dự toán/điều kiện còn thiếu, không thực thi. Khi bổ sung probe sau này phải có quote-id một lần, credential/catalog revision, expiry, idempotency và ledger reserve/settle; không dùng boolean confirmed từ client để bỏ qua dự toán.
6. Run tests → PASS. Commit `feat: add owner AI settings API and safe connection checks`.

## Task 8: Nối credential/model vào API Marketing và worker

**Files:** Modify `lib/server/marketing/config.ts`, `lib/server/marketing/providers.ts`, `lib/server/marketing/runner.ts`, `lib/server/marketing/api.ts`, `lib/server/marketing/daily.ts`, `lib/marketing/types.ts`; Test `tests/ai-settings-provider-routing.test.ts`, existing Marketing tests; read `services/marketing-worker/server.mjs`.

1. Viết test resolver app-over-env, deleted-over-env, key chủ thiếu, job revision stale trước gửi, model/giá hết hạn, chưa đủ key/worker/voice vẫn block, không đổi cờ chỉ vì credential hiện diện. Check tasks plan/draft/image/speech/render/export/probe không bị map nhầm credential; render/export/probe không cần Gemini key riêng nếu không gọi Gemini.
2. Run `npm.cmd test -- tests/ai-settings-provider-routing.test.ts tests/marketing-api.test.ts tests/marketing-integration.test.ts tests/marketing-notify.test.ts` → RED.
3. Giữ getter cờ deployment sync riêng; thêm async capability/readiness theo Context. Chuyển tất cả callsites `requireGeneration`/status liên quan sang await phù hợp, cập nhật mock tests. Không thay `MARKETING_*` flags thành true, không làm UI công bố ready khi effective vẫn off.
4. Provider không còn `required('MARKETING_GEMINI_KEY')` trực tiếp; nhận context/resolved execution snapshot. Job lưu credentialRevision, model/price version và trạng thái sideEffect, không plaintext. Trước lần gửi provider, xác minh revision và reserve vẫn hợp lệ; đánh dấu dispatch-intent transaction để crash sau side effect không retry tính phí. Rotation sau khi request đã bắt đầu không hủy/hoàn phí request cũ; giữ journal để đối soát. Retry chưa gửi cần chủ động resnapshot phiên bản mới, không âm thầm dùng key cũ.
5. Giọng đọc vẫn dùng Google identity và giọng đã duyệt. Chi phí, model selector và cap tính từ catalog đã xác minh, không song song hardcode giá cũ. Khi không chắc chi phí giữ reservation uncertain. Không bật fallback mặc định.
6. Run test → PASS; `npm.cmd run marketing:worker:build` và `npm.cmd run marketing:worker:check` → PASS, không deploy worker. Commit `feat: share AI settings across Marketing API and worker`.

## Task 9: Giao diện nhập, thay, xóa và kiểm tra khóa thật

**Files:** Create `components/ai-settings/panel.tsx`, `components/ai-settings/panel.module.css`, `components/ai-settings/credential-form.tsx`; Modify `components/settings.tsx`; Test `tests/ai-settings-ui.test.tsx`.

1. Viết UI tests label/nút: chưa key → thêm; configured → suffix+thay/xóa/check; thay mở ô rỗng; save giữ busy chỉ trong mutation; canonical response cập nhật revision; lỗi thật không toast thành công; xóa cần xác nhận; đóng/unmount xóa key; không gọi browser storage với khóa.
2. Run `npm.cmd test -- tests/ai-settings-ui.test.tsx` → FAIL.
3. Thay riêng Section AI mô phỏng bằng panel. Bỏ state demo-model/sessionStorage và API-key nhập thử, không ảnh hưởng phần Firebase/Telegram. Form password, autoComplete off, không có “hiện lại khóa đã lưu”, không analytics payload. Key tồn tại ngắn trong state input cho đến lưu/đóng; mutation trả metadata, không trả key.
4. Giữ theme navy/Be Vietnam Pro, container responsive `minmax(0,1fr)` và min-width:0; dialog có focus và phím Escape, label rõ, live region. Không thêm UI switch lựa chọn bố cục thử nghiệm vào sản phẩm.
5. Run test → PASS. Commit `feat: replace demo AI settings with secure credential controls`.

## Task 10: Model tự động, ngân sách và trạng thái lịch

**Files:** Modify `components/ai-settings/panel.tsx`, `components/ai-settings/panel.module.css`, `components/marketing/studio.tsx`; Test `tests/ai-settings-ui.test.tsx`, `tests/marketing-ui.test.tsx`.

1. Viết test mức mặc định/ledger thật, cảnh báo 80%, limit 0 và hạ dưới committed; thay budget cần xác nhận, dùng canonical revision. Model theo task và các lý do blocked đọc từ API; advanced không cho nhập model ID. Saving settings không gửi request bật AI/scheduler.
2. Run `npm.cmd test -- tests/ai-settings-ui.test.tsx tests/marketing-ui.test.tsx` → RED.
3. Dựng các nhóm như bản mẫu: kết nối; AI theo công việc; ngân sách; quyền tự động; lịch; trợ lý tương lai chưa kích hoạt. Ghi rõ phí AI riêng hạ tầng; phân biệt đã ghi nhận và giữ chỗ. “Chạy thử” chỉ mở hướng dẫn/dự toán/blocked, không giả báo đã tạo kết quả.
4. Nút bật lịch/tạo nội dung bị chặn trong scope đợt này, hiển thị lý do và desired/effective. Giữ báo cáo kinh doanh 07:00 riêng; lịch Marketing 08:00 chưa bật không được hiện như lịch đang chạy. Studio đọc cùng budget và readiness mới.
5. Run test → PASS. Commit `feat: show automatic AI routing and real budget readiness`.

## Task 11: Kiểm thử tích hợp, race conditions và kiểm tra UI

**Files:** Create `tests/ai-settings-integration.test.ts`; Modify fake store nếu cần; Create `docs/verification/2026-10-22-ai-settings.md`.

1. Viết scenario xuyên lớp bằng fake provider: owner lưu key → DTO masked → metadata check đúng revision → sửa budget → fake job lấy resolver mới → ledger reserve/settle; sau delete, queued job bị chặn và env không sống lại. Race replace-vs-check và budget-update-vs-reserve phải ổn định.
2. Run test mới → RED trước các glue còn thiếu; sửa glue tối thiểu, không thêm fallback mock trong sản phẩm. Dùng emulator thật cho transaction contention nếu fake serialized không chứng minh được hành vi concurrency Firestore. Nếu thêm test file emulator riêng, cập nhật `vitest.rules.config.ts` và exclude `vitest.config.ts` đúng nhóm; không chạy lên Firebase production.
3. Run tuần tự kiểm tra cuối:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:marketing-rules
npm.cmd run build
npm.cmd run marketing:worker:build
npm.cmd run marketing:worker:check
```

Expected: tất cả exit 0; không có request Gemini/TTS thật, không ghi Firestore production. Không mặc định số lượng test vì suite sẽ tăng.
4. Mở dev browser desktop và viewport mobile thật 390px, kiểm tra không tràn ngang; thao tác bàn phím, dialog, timeout/401/503 và mất kết nối. Luồng UI auth thật có thể kiểm tra metadata với tài khoản chủ; không mint token giả danh để vượt đăng nhập. Chưa có master key/provider key thì phải báo đúng thiếu cấu hình, không báo sẵn sàng.
5. Ghi bằng chứng browser → API → kho/DTO, test đã chạy, giới hạn chưa kiểm tra thật vào verification. Commit `test: verify secure AI settings workflow` với test và báo cáo.

## Task 12: Tài liệu vận hành và bàn giao cấu hình

**Files:** Create `docs/ai-settings-setup.md`; Modify `docs/marketing-setup.md`, `.env.example`, `infra/marketing/README.md` nếu file tồn tại (nếu chưa có tạo nó).

1. Viết hướng dẫn khai báo `AI_SETTINGS_ENCRYPTION_KEY` base64 32 byte ở môi trường server, cùng giá trị cho Vercel và worker; không cho vào NEXT_PUBLIC hoặc Firestore. Phân biệt khóa chủ mã hóa với API key người dùng nhập sau. Không generate/publish giá trị thật trong task tài liệu.
2. Nêu mất master key cần cấu hình key mới và nhập lại API key; sao lưu database không phục hồi được key. Thay/xóa API key trong app không tự revoke ở nhà cung cấp. Nêu env legacy chỉ fallback khi chưa có record/tombstone.
3. Nêu scope kiểm tra metadata, thiếu gì thì blocked, nguồn/ngày xác minh catalog, quy trình đối soát cost uncertain; giữ phí AI và hạ tầng tách biệt. Không hứa key Gemini thay được cấu hình TTS/worker.
4. Kiểm tra `git diff --check`; kiểm tra git status và manifest triển khai loại `.secrets`, `.env*`, `.firebase`, Terraform state và master key. Không stage giá trị thật, không chạy `vercel env pull` đè `.env.local`.
5. Commit `docs: document secure AI settings setup`. Bàn giao tình trạng code, test, biến cần cấu hình và giới hạn. Chỉ deploy/cấu hình production khi có yêu cầu phù hợp; bật trả phí, phép thử có phí hoặc lịch phải được duyệt riêng theo thiết kế. Không gửi tin Telegram thật để kiểm thử nếu chưa được chỉ định.

## Điểm hoàn tất

Người dùng không có API key vẫn xem được trạng thái thật và cấu hình ngân sách; khi bổ sung key qua form nó được mã hóa ở server và chỉ trả metadata. UI, API và worker thống nhất resolver/catalog/ledger, không còn phần cài đặt mô phỏng. Có test quyền, mật mã, concurrency, lỗi JSON và hồi quy Marketing/Telegram; chưa có sự cho phép mới thì dịch vụ trả phí và lịch vẫn tắt.
