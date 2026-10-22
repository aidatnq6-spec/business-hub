'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { SettingsView } from '@/lib/ai-settings/types';
import { aiSettingsRequest } from '@/lib/ai-settings/client';
import { Modal } from '../ui';
import { CredentialForm } from './credential-form';
import s from './panel.module.css';

const currency = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
    .format(n)
    .replace(/\s/g, '');
const labels: Record<string, string> = {
  text: 'Ý tưởng và bài viết',
  image: 'Ảnh minh họa',
  speech: 'Giọng đọc tiếng Việt',
  render: 'Dựng video hoàn chỉnh',
};
const states: Record<string, string> = {
  missing: 'Chưa cấu hình',
  unchecked: 'Chưa kiểm tra',
  ready: 'Sẵn sàng',
  error: 'Cần xử lý',
};
const checkStates: Record<string, string> = {
  unchecked: 'Chưa kiểm tra',
  checking: 'Đang kiểm tra',
  valid: 'Kết nối metadata hợp lệ',
  error: 'Kiểm tra chưa thành công',
};
const priceLabels: Record<string, string> = {
  inputUsdPerMillion: 'USD / 1 triệu token đầu vào',
  outputUsdPerMillion: 'USD / 1 triệu token văn bản đầu ra',
  imageUsdPerMillion: 'USD / 1 triệu token ảnh đầu ra',
  charactersUsdPerMillion: 'USD / 1 triệu ký tự',
  aiGeneration: 'USD phí AI tạo nội dung (chưa gồm hạ tầng)',
};
const reasonLabels: Record<string, string> = {
  ai_connection_unchecked: 'Chưa kiểm tra quyền truy cập metadata Gemini.',
  ai_image_generation_unchecked:
    'Metadata chưa xác nhận tạo ảnh thực tế; cần phép thử riêng được duyệt.',
  ai_provider_unavailable: 'Gemini chưa phản hồi hoặc đang giới hạn yêu cầu.',
  ai_provider_rejected: 'Gemini từ chối khóa hoặc quyền truy cập model.',
  ai_metadata_invalid: 'Metadata Gemini chưa phù hợp với model đã chọn.',
  ai_check_timeout: 'Kiểm tra kết nối đã hết thời gian chờ.',
  ai_credential_missing: 'Chưa có API key Gemini.',
  ai_catalog_unverified: 'Model hoặc bảng giá chưa được xác minh.',
  ai_check_needs_confirmation: 'Chưa xác minh phép kiểm tra miễn phí.',
  ai_master_key_missing: 'Máy chủ chưa có khóa chủ mã hóa.',
  ai_encryption_unavailable: 'Máy chủ chưa có khóa chủ mã hóa hợp lệ.',
  ai_activation_requires_approval: 'Chưa duyệt kích hoạt dịch vụ trả phí và lịch hoạt động.',
  ai_voice_not_approved: 'Chưa cấu hình và duyệt giọng đọc tiếng Việt.',
  ai_worker_required: 'Cần cấu hình máy chủ dựng video và kho tư liệu.',
  marketing_disabled: 'Tạo nội dung chưa được bật.',
};
const reason = (value: string) =>
  reasonLabels[value] ?? (/^[a-z_\d]+$/.test(value) ? `Điều kiện chưa đủ: ${value}` : value);

export function AiSettingsPanel() {
  const [data, setData] = useState<SettingsView | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<'key' | 'delete' | 'budget' | 'trial' | null>(null);
  const [limit, setLimit] = useState('');
  const [confirmedLimit, setConfirmedLimit] = useState(0);
  const active = useRef(true),
    locked = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const budgetId = useId();
  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const next = await aiSettingsRequest<SettingsView>('', 'GET', undefined, signal);
      if (!signal?.aborted && active.current) {
        setData(next);
        setLimit(String(next.budget.limit));
        setUncertain(false);
      }
    } catch (cause) {
      if (!signal?.aborted && active.current)
        setError(cause instanceof Error ? cause.message : 'Không tải được cài đặt AI.');
    } finally {
      if (!signal?.aborted && active.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void reload(controller.signal);
    });
    return () => {
      active.current = false;
      controller.abort();
    };
  }, [reload]);
  const mutate = async (path: string, method: string, body: unknown, success: string) => {
    if (locked.current || uncertain) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await aiSettingsRequest<SettingsView>(path, method, body);
      if (active.current) {
        setData(next);
        setLimit(String(next.budget.limit));
        setNotice(success);
      }
      return true;
    } catch (cause) {
      if (
        cause instanceof Error &&
        'code' in cause &&
        [
          'ai_request_timeout',
          'ai_response_invalid',
          'ai_revision_conflict',
          'ai_server_unavailable',
        ].includes(String(cause.code))
      )
        setUncertain(true);
      if (active.current)
        setError(cause instanceof Error ? cause.message : 'Không thể lưu cài đặt AI.');
      return false;
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  };
  const blocked = busy || loading || uncertain;
  return (
    <section className={s.root} aria-labelledby="ai-settings-title">
      <div className={s.heading}>
        <div>
          <p className={s.eyebrow}>BUSINESS HUB / AI</p>
          <h2 id="ai-settings-title">Cài đặt AI</h2>
          <p className={s.muted}>
            Hệ thống chọn model theo công việc. Bạn quản lý kết nối, chi phí và quyền thực hiện.
          </p>
        </div>
        <button type="button" disabled={busy || loading} onClick={() => void reload()}>
          {loading ? 'Đang tải…' : 'Tải lại trạng thái'}
        </button>
      </div>
      {error && !dialog ? (
        <p role="alert" className={s.error}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className={s.success}>
          {notice}
        </p>
      ) : null}
      {!data ? (
        <p className={s.muted}>
          {loading
            ? 'Đang tải cài đặt từ máy chủ…'
            : 'Chưa có dữ liệu cài đặt. Hãy thử tải lại trạng thái.'}
        </p>
      ) : (
        <>
          <div className={s.grid}>
            <section className={s.card}>
              <div className={s.cardHeading}>
                <h3>Kết nối dịch vụ</h3>
                <span className={s.badge}>
                  {data.credential.configured ? 'Đã cấu hình' : 'Chưa cấu hình API key'}
                </span>
              </div>
              <h4>Google Gemini</h4>
              <p className={s.muted}>
                Dùng cho văn bản và ảnh khi đủ điều kiện riêng của từng công việc.
              </p>
              {data.credential.configured ? (
                <>
                  <p>
                    API key:{' '}
                    <strong>
                      {data.credential.suffix ? `••••${data.credential.suffix}` : 'Đã được bảo vệ'}
                    </strong>
                  </p>
                  <p>{checkStates[data.credential.check.state]}</p>
                  {data.credential.check.code ? (
                    <p className={s.note}>{reason(data.credential.check.code)}</p>
                  ) : null}
                  {data.credential.source === 'environment' ? (
                    <p className={s.muted}>
                      Khóa hiện được quản lý qua cấu hình máy chủ. Thay hoặc xóa tại đây sẽ ưu tiên
                      cấu hình trong ứng dụng.
                    </p>
                  ) : null}
                  <div className={s.actions}>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => {
                        setError('');
                        setDialog('key');
                      }}
                    >
                      Thay khóa
                    </button>
                    <button type="button" disabled={blocked} onClick={() => setDialog('delete')}>
                      Xóa khóa
                    </button>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() =>
                        void mutate(
                          'credential/check',
                          'POST',
                          { provider: 'gemini', revision: data.credential.revision },
                          'Đã cập nhật kết quả kiểm tra. Phạm vi kiểm tra chỉ là metadata.',
                        )
                      }
                    >
                      {busy ? 'Đang xử lý…' : 'Kiểm tra kết nối'}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className={s.primary}
                  disabled={blocked}
                  onClick={() => {
                    setError('');
                    setDialog('key');
                  }}
                >
                  Thêm API key
                </button>
              )}
              <p className={s.note}>
                Lưu khóa không tự bật AI hoặc lịch. Kiểm tra metadata không tạo nội dung và không
                chứng minh ảnh, giọng đọc hay video đã hoạt động.
              </p>
            </section>
            <section className={s.card}>
              <div className={s.cardHeading}>
                <h3>Ngân sách AI Marketing</h3>
                <span className={s.badge}>{data.budget.month}</span>
              </div>
              <dl className={s.ledger}>
                <div>
                  <dt>Đã ghi nhận</dt>
                  <dd>{currency(data.budget.spent)}</dd>
                </div>
                <div>
                  <dt>Đang giữ chỗ</dt>
                  <dd>{currency(data.budget.reserved)}</dd>
                </div>
                <div>
                  <dt>Còn khả dụng</dt>
                  <dd>{currency(data.budget.remaining)}</dd>
                </div>
              </dl>
              <progress
                className={s.progress}
                aria-label="Ngân sách đã ghi nhận và giữ chỗ"
                value={Math.min(data.budget.limit, data.budget.spent + data.budget.reserved)}
                max={data.budget.limit || 1}
              />
              {data.budget.limit === 0 ? (
                <p className={s.note}>Hạn mức 0 đồng: không được phát sinh chi phí AI mới.</p>
              ) : data.budget.warning ? (
                <p className={s.note}>
                  Đã dùng hoặc giữ chỗ từ 80% hạn mức. Cần kiểm tra trước khi tạo thêm nội dung.
                </p>
              ) : null}
              <form
                className={s.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (blocked) return;
                  const next = Number(limit);
                  if (!limit.trim() || !Number.isSafeInteger(next) || next < 0) {
                    setError('Hạn mức phải là số nguyên đồng, lớn hơn hoặc bằng 0.');
                    return;
                  }
                  if (next < data.budget.spent + data.budget.reserved) {
                    setError('Hạn mức không được thấp hơn tổng đã ghi nhận và đang giữ chỗ.');
                    return;
                  }
                  setError('');
                  setConfirmedLimit(next);
                  setDialog('budget');
                }}
              >
                <label htmlFor={budgetId}>Hạn mức AI mỗi tháng (đồng)</label>
                <input
                  id={budgetId}
                  type="number"
                  min="0"
                  step="1"
                  value={limit}
                  disabled={blocked}
                  onChange={(event) => setLimit(event.target.value)}
                />
                <button type="submit" disabled={blocked}>
                  Cập nhật hạn mức
                </button>
              </form>
              <p className={s.muted}>
                Áp dụng tháng hiện tại và làm mặc định tháng sau. Phí AI tách riêng chi phí hosting
                và hạ tầng. Khoản giữ chỗ có thể đang chờ đối soát.
              </p>
            </section>
          </div>
          <section className={s.card}>
            <div className={s.cardHeading}>
              <h3>AI theo công việc</h3>
              <span className={s.badge}>Tự động chọn model</span>
            </div>
            <div className={s.capabilities}>
              {data.capabilities.map((item) => (
                <article key={item.id}>
                  <h4>{labels[item.id] ?? item.id}</h4>
                  <span className={s.badge}>{states[item.state]}</span>
                  {item.reasons.length ? (
                    <ul>
                      {item.reasons.map((entry, index) => (
                        <li key={index}>{reason(entry)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={s.muted}>
                      Đủ điều kiện năng lực. Việc thực hiện vẫn phụ thuộc quyền kích hoạt và ngân
                      sách.
                    </p>
                  )}
                </article>
              ))}
            </div>
            <details className={s.advanced}>
              <summary>Nâng cao: model và bảng giá</summary>
              <p>
                Chỉ dùng danh mục model đã xác minh cho đúng năng lực và phiên bản giá còn hiệu lực.
                Khi danh mục chưa đủ điều kiện, hệ thống chặn tác vụ có phí; không tự chọn model
                khác hoặc thêm phương án dự phòng.
              </p>
              <p>
                Giọng đọc dùng dịch vụ riêng; video dựng từ tư liệu, giọng đọc và phụ đề theo mẫu.
                Model có trong danh mục không đồng nghĩa dịch vụ đã được bật.
              </p>
              <div className={s.modelList}>
                {data.capabilities.map((item) => (
                  <article key={item.id}>
                    <h4>{labels[item.id] ?? item.id}</h4>
                    {item.selection ? (
                      <>
                        <p>
                          <strong>{item.selection.model}</strong> · {item.selection.provider}
                        </p>
                        <p>
                          Xác minh:{' '}
                          {new Date(item.selection.verifiedAt).toLocaleDateString('vi-VN')} · Hiệu
                          lực đến: {new Date(item.selection.validUntil).toLocaleDateString('vi-VN')}
                        </p>
                        <p>Phiên bản giá: {item.selection.priceVersion}</p>
                        <ul>
                          {Object.entries(item.selection.prices).map(([unit, amount]) => (
                            <li key={unit}>
                              {amount} {priceLabels[unit] ?? unit}
                            </li>
                          ))}
                        </ul>
                        <a href={item.selection.source} target="_blank" rel="noreferrer">
                          Nguồn bảng giá chính thức
                        </a>
                      </>
                    ) : (
                      <p>Chưa có model đủ điều kiện cho công việc này.</p>
                    )}
                  </article>
                ))}
              </div>
            </details>
            <button type="button" disabled={busy} onClick={() => setDialog('trial')}>
              Điều kiện chạy thử
            </button>
          </section>
          <div className={s.grid}>
            <section className={s.card}>
              <h3>Quyền tự động</h3>
              <p>
                Mong muốn:{' '}
                <strong>
                  {data.activation.desired ? 'Tự chuẩn bị theo kế hoạch đã duyệt' : 'Chưa bật'}
                </strong>
              </p>
              <p>
                Hiệu lực:{' '}
                <strong>
                  {data.activation.effective ? 'Đang bật theo cấu hình máy chủ' : 'Đang tắt'}
                </strong>
              </p>
              <ul>
                {data.activation.reasons.map((entry, index) => (
                  <li key={index}>{reason(entry)}</li>
                ))}
              </ul>
              <p className={s.muted}>
                Bạn duyệt kịch bản và thành phẩm trước khi tải về để nhân viên đăng.
              </p>
              <button type="button" disabled>
                Bật tạo nội dung và lịch
              </button>
              <p className={s.note}>
                Đợt này chưa kích hoạt dịch vụ trả phí hoặc bộ lập lịch. Cần duyệt chi phí và cấu
                hình vận hành riêng.
              </p>
            </section>
            <section className={s.card}>
              <h3>Lịch Marketing dự kiến</h3>
              <p>
                <strong>20:00</strong> hôm trước — chuẩn bị nội dung.
              </p>
              <p>
                <strong>08:00</strong> — thông báo nội dung chờ duyệt qua nhóm Telegram.
              </p>
              <p className={s.muted}>
                Giờ Việt Nam. Lịch chưa được bật từ màn hình này. Báo cáo kinh doanh 07:00 được quản
                lý riêng ở bên dưới.
              </p>
              <h4>Trợ lý khác</h4>
              <p className={s.muted}>
                Thư ký Chủ tịch, Bán hàng, Kế toán và Nhân sự: chưa kích hoạt.
              </p>
            </section>
          </div>
        </>
      )}
      {dialog === 'key' && data ? (
        <CredentialForm
          replacing={data.credential.configured}
          busy={busy}
          blocked={uncertain}
          error={error}
          onClose={() => {
            setDialog(null);
            if (!uncertain) setError('');
          }}
          onSave={(key) =>
            mutate(
              'credential',
              'PUT',
              { provider: 'gemini', key, revision: data.credential.revision },
              'Đã lưu khóa. Tạo nội dung và lịch giữ nguyên trạng thái.',
            )
          }
        />
      ) : null}
      {dialog === 'delete' && data ? (
        <Modal
          title="Xóa API key Gemini?"
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <p>
            Tác vụ chưa gửi sẽ bị chặn. Tác vụ đã gửi có thể vẫn phát sinh phí và cần đối soát. Xóa
            tại đây không thu hồi khóa ở Google và không khôi phục khóa môi trường cũ.
          </p>
          {error ? (
            <p role="alert" className={s.error}>
              {error}
            </p>
          ) : null}
          <div className={s.actions}>
            <button type="button" disabled={busy} onClick={() => setDialog(null)}>
              Hủy
            </button>
            <button
              type="button"
              className={s.danger}
              disabled={blocked}
              onClick={async () => {
                if (
                  await mutate(
                    'credential',
                    'DELETE',
                    { provider: 'gemini', revision: data.credential.revision },
                    'Đã xóa khóa.',
                  )
                )
                  setDialog(null);
              }}
            >
              {busy ? 'Đang xóa…' : 'Xác nhận xóa khóa'}
            </button>
          </div>
        </Modal>
      ) : null}
      {dialog === 'budget' && data ? (
        <Modal
          title="Xác nhận thay đổi hạn mức"
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <p>
            Đổi hạn mức từ <strong>{currency(data.budget.limit)}</strong> thành{' '}
            <strong>{currency(confirmedLimit)}</strong> cho tháng hiện tại và mặc định tháng sau.
            Lịch sử chi phí và các khoản giữ chỗ được giữ nguyên.
          </p>
          {error ? (
            <p role="alert" className={s.error}>
              {error}
            </p>
          ) : null}
          <div className={s.actions}>
            <button type="button" disabled={busy} onClick={() => setDialog(null)}>
              Hủy
            </button>
            <button
              type="button"
              className={s.primary}
              disabled={blocked}
              onClick={async () => {
                if (
                  await mutate(
                    'budget',
                    'PATCH',
                    { monthlyLimit: confirmedLimit, revision: data.budget.revision },
                    'Đã cập nhật hạn mức AI.',
                  )
                )
                  setDialog(null);
              }}
            >
              {busy ? 'Đang cập nhật…' : 'Xác nhận hạn mức'}
            </button>
          </div>
        </Modal>
      ) : null}
      {dialog === 'trial' ? (
        <Modal title="Điều kiện chạy thử" onClose={() => setDialog(null)}>
          <p>
            Đợt này chưa chạy thử trả phí. Cần API key hợp lệ, model và giá còn hiệu lực, ngân sách
            khả dụng và hạ tầng tương ứng.
          </p>
          <p>
            Trước phép thử có phí, hệ thống phải trình dự toán, dữ liệu sẽ gửi và xin duyệt riêng.
            Nút này không gọi AI hoặc tạo kết quả mẫu.
          </p>
        </Modal>
      ) : null}
    </section>
  );
}
