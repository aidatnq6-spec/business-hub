'use client';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { marketingRequest } from '@/lib/marketing/client';
import { businessDay, initialBrand, canApprove } from '@/lib/marketing/domain';
import {
  services,
  channels,
  serviceLabels,
  channelLabels,
  type Service,
  type Channel,
  type Brand,
  type Bundle,
  type Plan,
  type Budget,
  type Job,
} from '@/lib/marketing/types';
import { Modal } from '../ui';
import s from './studio.module.css';
type Status = {
  enabled: boolean;
  generationEnabled: boolean;
  scheduleEnabled: boolean;
  telegramEnabled: boolean;
  missing: string[];
};
type Dashboard = {
  brand: Brand;
  plans: Plan[];
  bundles: Bundle[];
  budget: Budget;
  jobs: Job[];
  status: Status;
};
const money = (v: number) => new Intl.NumberFormat('vi-VN').format(v) + 'đ';
const stateNames: Record<string, string> = {
  empty: 'Chưa soạn',
  queued: 'Đang chờ xử lý',
  running: 'Đang xử lý',
  review: 'Chờ bạn duyệt',
  uncertain: 'Cần kiểm tra kết quả',
  failed: 'Xử lý thất bại',
  blocked_budget: 'Chạm hạn mức',
  waiting_material: 'Chờ tư liệu',
  stale: 'Kế hoạch đã thay đổi',
  cancelled: 'Đã hủy',
  draft: 'Bản nháp',
  succeeded: 'Hoàn tất',
};
export function MarketingStudio() {
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(''),
    [errorCode, setErrorCode] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [service, setService] = useState<Service>('signature'),
    [channel, setChannel] = useState<Channel>('facebook'),
    [selected, setSelected] = useState('');
  const [view, setView] = useState<'studio' | 'calendar' | 'brand' | 'status'>('studio'),
    [media, setMedia] = useState<'post' | 'video'>('post');
  const [brand, setBrand] = useState<Brand>(initialBrand),
    [month, setMonth] = useState(() => businessDay().slice(0, 7));
  const [planEdit, setPlanEdit] = useState<Plan | null>(null),
    [captionEdits, setCaptionEdits] = useState<Record<string, string>>({});
  const [approvalSelection, setApprovalSelection] = useState<string[]>([]);
  const [scriptEdit, setScriptEdit] = useState<string | null>(null),
    [claimEdit, setClaimEdit] = useState<Bundle['claims'] | null>(null),
    [asset, setAsset] = useState<{ url: string; kind: string } | null>(null);
  const [uploadId, setUploadId] = useState(''),
    [recordingConfirmed, setRecordingConfirmed] = useState(false);
  const reload = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const value = await marketingRequest<Dashboard>(
          `dashboard?month=${month}`,
          'GET',
          undefined,
          signal,
        );
        if (signal?.aborted) return;
        setData(value);
        setError('');
        setErrorCode('');
      } catch (e) {
        if (!signal?.aborted) {
          setError(e instanceof Error ? e.message : 'Không tải được Marketing.');
          setErrorCode(
            e instanceof Error && 'code' in e && typeof e.code === 'string' ? e.code : '',
          );
        }
      }
    },
    [month],
  );
  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      if (!c.signal.aborted) void reload(c.signal);
    });
    return () => c.abort();
  }, [reload]);
  const processing =
    data?.jobs.some((j) => ['queued', 'running'].includes(j.state)) ||
    data?.bundles.some((b) => ['queued', 'running'].includes(b.state));
  useEffect(() => {
    if (!processing) return;
    const c = new AbortController(),
      t = setInterval(() => void reload(c.signal), 15000);
    return () => {
      clearInterval(t);
      c.abort();
    };
  }, [processing, reload]);
  const act = async (fn: () => Promise<void>, message: string, refresh = true) => {
    setBusy(true);
    setNotice('');
    try {
      await fn();
      setNotice(message);
      if (refresh) await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Chưa hoàn tất thao tác.');
    } finally {
      setBusy(false);
    }
  };
  const bundles = data?.bundles.filter((b) => b.service === service) ?? [],
    bundle = bundles.find((b) => b.id === selected) ?? bundles[0];
  const currentPlan = data?.plans.find((p) => p.id === month),
    approved = bundle?.approvedRevision === bundle?.revision && bundle?.approvedRevision != null;
  const editKey = bundle ? `${bundle.id}:${channel}` : '';
  const postText = bundle ? (captionEdits[editKey] ?? bundle.captions[channel]) : '';
  const dirty =
    !!bundle &&
    channels.some(
      (c) =>
        captionEdits[`${bundle.id}:${c}`] !== undefined &&
        captionEdits[`${bundle.id}:${c}`] !== bundle.captions[c],
    );
  const openBrand = () => {
    setBrand(data?.brand ?? initialBrand());
    setView('brand');
  };
  const request = async (path: string, body: unknown) => {
    await marketingRequest(path, 'POST', body);
  };
  const previewAsset = async (id: string, kind: string) => {
    const a = await marketingRequest<{ url: string }>(`assets/${id}/download`);
    setAsset({ url: a.url, kind });
  };
  async function uploadRecording(file: File) {
    if (!bundle || !recordingConfirmed)
      throw new Error('Hãy xác nhận quyền sử dụng và nội dung bản ghi trước.');
    if (file.type !== 'video/mp4' || file.size > 200000000)
      throw new Error('Chọn bản ghi MP4 tối đa 200MB.');
    const a = await marketingRequest<{ id: string; url: string }>('assets/upload', 'POST', {
      bundleId: bundle.id,
      contentType: file.type,
      size: file.size,
      rightsConfirmed: true,
    });
    const r = await fetch(a.url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!r.ok) throw new Error('Tải tư liệu chưa thành công.');
    await request(`assets/${a.id}/finalize`, {});
    setUploadId(a.id);
  }
  return (
    <div className={s.root}>
      <header className={s.heading}>
        <div>
          <span className={s.kicker}>Đạt Nguyễn / Marketing Studio</span>
          <h1>Nội dung tốt, bắt đầu từ ý tưởng.</h1>
          <p>Cùng trợ lý chuẩn bị nội dung cho ba nhóm dịch vụ của bạn.</p>
        </div>
        <button onClick={() => void reload()} disabled={busy}>
          Làm mới
        </button>
      </header>
      <nav className={s.tabs} aria-label="Marketing">
        <button
          aria-current={view === 'studio' ? 'page' : undefined}
          onClick={() => setView('studio')}
        >
          ✧ Trợ lý Marketing
        </button>
        <button
          aria-current={view === 'calendar' ? 'page' : undefined}
          onClick={() => setView('calendar')}
        >
          Lịch nội dung
        </button>
        <button aria-current={view === 'brand' ? 'page' : undefined} onClick={openBrand}>
          Hồ sơ thương hiệu
        </button>
        <button
          aria-current={view === 'status' ? 'page' : undefined}
          onClick={() => setView('status')}
        >
          Trạng thái dịch vụ
        </button>
      </nav>
      {notice && (
        <div role="status" className={s.notice}>
          {notice}
          <button aria-label="Đóng thông báo Marketing" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className={s.error}>
          {error} <button onClick={() => void reload()}>Thử tải lại</button>
        </div>
      )}
      {errorCode.startsWith('marketing_firebase_') && (
        <section className={s.panel} aria-labelledby="marketing-firebase-setup">
          <div className={s.panelHead}>
            <h2 id="marketing-firebase-setup">Thiết lập Firebase Admin cho máy chủ</h2>
          </div>
          <div className={s.panelBody}>
            <p>
              Firebase trên thanh tiêu đề là kết nối từ trình duyệt. Marketing cần thông tin xác
              thực riêng ở máy chủ để xác minh đăng nhập và đọc dữ liệu.
            </p>
            <ol>
              <li>
                Mở{' '}
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Firebase Console
                </a>
                , chọn đúng project của Business Hub.
              </li>
              <li>
                Vào Cài đặt dự án → Tài khoản dịch vụ → Firebase Admin SDK, tạo khóa riêng và tải
                file JSON.
              </li>
              <li>
                Đặt file trên máy tại <code>.secrets/firebase-service-account.json</code>. Không đưa
                file này vào mã giao diện hoặc gửi nội dung khóa qua chat.
              </li>
              <li>
                Thêm vào <code>.env.local</code>:{' '}
                <code>
                  GOOGLE_APPLICATION_CREDENTIALS=D:/GitHub/business-hub/.secrets/firebase-service-account.json
                </code>
                .
              </li>
              <li>
                Khởi động lại <code>npm run dev</code>, rồi bấm Thử tải lại.
              </li>
            </ol>
            <p className={s.note}>
              Chưa cần bật Gemini, worker hoặc lịch Telegram để tải hồ sơ và kế hoạch Marketing. Nếu
              đã có Firebase Admin qua biến môi trường khác, hãy kiểm tra tính hợp lệ và project
              tương ứng.
            </p>
          </div>
        </section>
      )}
      {!data && !error && <p role="status">Đang tải dữ liệu Marketing…</p>}
      {data && (
        <>
          <section className={s.metrics} aria-label="Kết quả Marketing">
            <div>
              <span>Bộ bài và ảnh đã tạo</span>
              <b>
                {data.bundles.filter((b) => b.date.startsWith(month) && b.imageId).length}
                <small>/ 90 bộ</small>
              </b>
            </div>
            <div>
              <span>Video hoàn chỉnh</span>
              <b>
                {data.bundles.filter((b) => b.date.startsWith(month) && b.videoId).length}
                <small>/ 45 video</small>
              </b>
            </div>
            <div>
              <span>Đang chờ bạn duyệt</span>
              <b>
                {
                  data.bundles.filter(
                    (b) => b.state === 'review' && b.approvedRevision !== b.revision,
                  ).length
                }
                <small>bộ</small>
              </b>
            </div>
            <div>
              <span>Chi phí ghi nhận / đang giữ chỗ</span>
              <b className={s.cost}>
                {money(data.budget.spent)} / {money(data.budget.reserved)}
              </b>
              <small>Trần {money(data.budget.limit)} · Cần đối soát hóa đơn</small>
              <progress
                aria-label="Ngân sách đã dùng và giữ chỗ"
                max={data.budget.limit}
                value={data.budget.spent + data.budget.reserved}
              />
            </div>
          </section>
          {(!data.status.enabled || data.status.missing.length > 0) && (
            <div className={s.setup}>
              Chưa bật tạo nội dung tự động.{' '}
              {data.status.missing.length > 0
                ? `Cần bổ sung: ${data.status.missing.join(', ')}.`
                : 'Cấu hình đã có, cần xác nhận kích hoạt.'}{' '}
              <button onClick={() => setView('status')}>Xem cấu hình</button>
            </div>
          )}
          {view === 'studio' && (
            <div className={s.workspace}>
              <section className={s.panel}>
                <div className={s.panelHead}>
                  <h2>✧ Làm việc cùng trợ lý Marketing</h2>
                  <small>Ý tưởng → Soạn → Duyệt</small>
                </div>
                <div className={s.panelBody}>
                  <p className={s.label}>Bạn muốn làm việc với dịch vụ nào?</p>
                  <div className={s.services}>
                    {services.map((k) => (
                      <button
                        key={k}
                        aria-pressed={service === k}
                        onClick={() => {
                          setService(k);
                          setSelected('');
                          setUploadId('');
                        }}
                      >
                        {serviceLabels[k]}
                      </button>
                    ))}
                  </div>
                  <div className={s.assistant}>
                    <span className={s.aiIcon}>✧</span>
                    <div>
                      <strong>Trợ lý Marketing Đạt Nguyễn</strong>
                      <p>
                        Nội dung được chuẩn bị từ kế hoạch bạn đã duyệt. Bài, ảnh và video chỉ tải
                        thành bản đăng sau khi bạn duyệt thành phẩm.
                      </p>
                    </div>
                  </div>
                  {!bundles.length ? (
                    <div className={s.empty}>
                      <h3>Chưa có bộ nội dung cho dịch vụ này</h3>
                      <p>
                        Thiết lập hồ sơ, tạo và duyệt kế hoạch tháng. Lịch 20h sẽ chuẩn bị nội dung
                        ngày tiếp theo khi dịch vụ được bật.
                      </p>
                      <button className={s.primary} onClick={() => setView('calendar')}>
                        Mở kế hoạch nội dung
                      </button>
                    </div>
                  ) : (
                    <div className={s.ideas}>
                      {bundles.map((b) => (
                        <button
                          key={b.id}
                          aria-pressed={b.id === bundle?.id}
                          onClick={() => {
                            setSelected(b.id);
                            setUploadId('');
                          }}
                        >
                          <span className={s.radio} />
                          <span>
                            <strong>{b.title}</strong>
                            <small>
                              {b.date} · {b.video ? 'Ảnh và video' : 'Ảnh'} ·{' '}
                              {stateNames[b.state] ?? b.state}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {bundle?.error && (
                    <p className={s.error}>
                      Tác vụ cần xử lý: {stateNames[bundle.state] ?? bundle.state}. Không tự tạo lại
                      tác vụ có kết quả chưa chắc chắn.
                    </p>
                  )}
                  {bundle &&
                    ['failed', 'blocked_budget', 'waiting_material'].includes(bundle.state) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              request(`bundles/${bundle.id}/retry`, { revision: bundle.revision }),
                            'Đã yêu cầu thử lại tác vụ đủ điều kiện.',
                          )
                        }
                      >
                        Thử lại tác vụ an toàn
                      </button>
                    )}
                  {bundle?.state === 'empty' && (
                    <button
                      className={s.primary}
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () =>
                            request(`bundles/${bundle.id}/generate`, { revision: bundle.revision }),
                          'Đã đưa bộ nội dung vào hàng đợi.',
                        )
                      }
                    >
                      Soạn bộ nội dung
                    </button>
                  )}
                  <div className={s.note}>
                    Mục tiêu: 30 bộ bài và ảnh, 15 video cho mỗi dịch vụ/tháng. Kịch bản video cần
                    được duyệt trước khi dựng.
                  </div>
                  {data.jobs.some((j) => j.state === 'queued') && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(() => request('outbox', {}), 'Đã kiểm tra và tiếp tục hàng đợi.')
                      }
                    >
                      Tiếp tục xử lý tác vụ đang chờ
                    </button>
                  )}
                </div>
              </section>
              <section className={s.panel}>
                <div className={s.panelHead}>
                  <h2>Xem trước bộ nội dung</h2>
                  <span className={approved ? s.good : s.pill}>
                    {approved
                      ? 'Đã duyệt'
                      : bundle
                        ? (stateNames[bundle.state] ?? bundle.state)
                        : 'Chưa có bản nháp'}
                  </span>
                </div>
                <div className={s.channels}>
                  {channels.map((c) => (
                    <button key={c} aria-pressed={channel === c} onClick={() => setChannel(c)}>
                      {channelLabels[c]}
                    </button>
                  ))}
                </div>
                <div className={s.panelBody}>
                  <div className={s.mediaTabs}>
                    <button aria-pressed={media === 'post'} onClick={() => setMedia('post')}>
                      Bài viết & ảnh
                    </button>
                    <button aria-pressed={media === 'video'} onClick={() => setMedia('video')}>
                      Video ngắn
                    </button>
                  </div>
                  {!bundle ? (
                    <div className={s.empty}>
                      Bản nháp thật sẽ xuất hiện tại đây sau khi được tạo từ kế hoạch.
                    </div>
                  ) : media === 'post' ? (
                    <>
                      <div className={s.brand}>
                        <span>ĐN</span>
                        <div>
                          <strong>Đạt Nguyễn</strong>
                          <small>
                            {channelLabels[channel]} · Phiên bản {bundle.revision}
                          </small>
                        </div>
                      </div>
                      <label className={s.label} htmlFor="marketing-caption">
                        Nội dung {channelLabels[channel]}
                      </label>
                      <textarea
                        id="marketing-caption"
                        value={postText}
                        maxLength={7000}
                        onChange={(e) =>
                          setCaptionEdits((v) => ({ ...v, [editKey]: e.target.value }))
                        }
                        placeholder="Chưa có nội dung bài viết."
                        rows={9}
                      />
                      <button
                        disabled={busy || !postText.trim() || captionEdits[editKey] === undefined}
                        onClick={() =>
                          void act(async () => {
                            await marketingRequest(`bundles/${bundle.id}`, 'PATCH', {
                              revision: bundle.revision,
                              channel,
                              text: postText,
                            });
                            setCaptionEdits((v) => {
                              const next = { ...v };
                              delete next[editKey];
                              return next;
                            });
                          }, 'Đã lưu bài viết. Cần duyệt lại phiên bản mới.')
                        }
                      >
                        Lưu bản nháp
                      </button>
                      <div className={s.imageSpace}>
                        {bundle.imageId ? (
                          <>
                            <div className={s.imagePlaceholder}>Ảnh minh họa đã được tạo</div>
                            <button
                              onClick={() =>
                                void act(
                                  () => previewAsset(bundle.imageId!, 'image'),
                                  'Đã mở ảnh xem trước.',
                                )
                              }
                            >
                              Xem ảnh thật
                            </button>
                          </>
                        ) : (
                          <span>Chưa tạo ảnh · Không dùng ảnh mẫu thay thế</span>
                        )}
                      </div>
                      {bundle.claims.length > 0 && (
                        <div className={s.note}>
                          {bundle.claims.filter((c) => !c.verified).length} thông tin cần kiểm
                          chứng.{' '}
                          <button
                            onClick={() => setClaimEdit(bundle.claims.map((c) => ({ ...c })))}
                          >
                            Kiểm tra nguồn
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {bundle.video ? (
                        <>
                          <h3>{bundle.title}</h3>
                          <p className={s.note}>
                            Dọc 9:16 · Giọng Việt · Có phụ đề. Video kiến thức 30–60 giây hoặc hướng
                            dẫn 45–90 giây; thời lượng thực được kiểm tra khi dựng.
                          </p>
                          <p className={s.script}>{bundle.script || 'Chưa có kịch bản.'}</p>
                          <div className={s.actions}>
                            <button onClick={() => setScriptEdit(bundle.script)}>
                              Sửa kịch bản
                            </button>
                            <button
                              className={s.primary}
                              disabled={
                                busy ||
                                !bundle.script ||
                                bundle.scriptApprovedRevision === bundle.scriptRevision ||
                                bundle.claims.some((c) => !c.verified)
                              }
                              onClick={() =>
                                void act(
                                  () =>
                                    request(`bundles/${bundle.id}/approve-script`, {
                                      revision: bundle.revision,
                                    }),
                                  'Đã duyệt kịch bản và đưa vào hàng đợi dựng video.',
                                )
                              }
                            >
                              Duyệt kịch bản & dựng
                            </button>
                          </div>
                          {bundle.videoId ? (
                            <button
                              onClick={() =>
                                void act(
                                  () => previewAsset(bundle.videoId!, 'video'),
                                  'Đã mở video thật.',
                                )
                              }
                            >
                              Xem MP4 đã dựng
                            </button>
                          ) : (
                            <div className={s.empty}>
                              Chưa có MP4 hoàn chỉnh. App không hiển thị video giả.
                            </div>
                          )}
                          <div className={s.note}>
                            <label htmlFor="marketing-recording">
                              Bản ghi thao tác thực tế (MP4 ≤200MB)
                            </label>
                            <label className={s.checkbox}>
                              <input
                                type="checkbox"
                                checked={recordingConfirmed}
                                onChange={(e) => setRecordingConfirmed(e.target.checked)}
                              />
                              Tôi có quyền sử dụng và đã kiểm tra bản ghi khớp với thao tác trong
                              kịch bản.
                            </label>
                            <input
                              id="marketing-recording"
                              type="file"
                              accept="video/mp4"
                              disabled={busy || !recordingConfirmed}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file)
                                  void act(
                                    () => uploadRecording(file),
                                    'Đã tải bản ghi, đang kiểm tra định dạng.',
                                  );
                              }}
                            />
                            {uploadId && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  void act(async () => {
                                    const a = await marketingRequest<{ verified: boolean }>(
                                      `assets/${uploadId}`,
                                    );
                                    if (!a.verified)
                                      throw new Error('Tư liệu đang chờ worker kiểm tra.');
                                    await marketingRequest(`bundles/${bundle.id}`, 'PATCH', {
                                      revision: bundle.revision,
                                      recordingId: uploadId,
                                    });
                                    setUploadId('');
                                  }, 'Đã gắn bản ghi. Hãy duyệt lại kịch bản.')
                                }
                              >
                                Kiểm tra & gắn bản ghi
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className={s.empty}>
                          Bộ này chỉ có bài viết và ảnh theo kế hoạch. TikTok và YouTube chưa có tệp
                          video để đăng.
                        </div>
                      )}
                    </>
                  )}
                  {dirty && (
                    <p className={s.note}>
                      Có bài viết đang sửa chưa lưu. Hãy lưu trước khi duyệt hoặc tải bản đăng.
                    </p>
                  )}
                </div>
                <div className={s.panelFooter}>
                  <button
                    disabled={busy || !approved || dirty}
                    onClick={() =>
                      bundle &&
                      void act(
                        async () => {
                          const r = await marketingRequest<{ url?: string }>(
                            `bundles/${bundle.id}/export`,
                            'POST',
                            { revision: bundle.revision },
                          );
                          if (r.url) window.location.assign(r.url);
                        },
                        bundle?.exportId
                          ? 'Đã mở gói tải đã duyệt.'
                          : 'Đang chuẩn bị gói tải. Bấm lại khi tác vụ hoàn tất.',
                      )
                    }
                  >
                    {bundle?.exportId ? 'Tải bộ nội dung' : 'Chuẩn bị gói tải'}
                  </button>
                  <button
                    className={s.primary}
                    disabled={
                      busy ||
                      !bundle ||
                      approved ||
                      dirty ||
                      !canApprove(bundle) ||
                      bundle.state !== 'review'
                    }
                    onClick={() =>
                      bundle &&
                      void act(
                        () =>
                          request(`bundles/${bundle.id}/approve`, { revision: bundle.revision }),
                        'Đã duyệt bộ nội dung phiên bản hiện tại.',
                      )
                    }
                  >
                    ✓ Duyệt thành phẩm
                  </button>
                </div>
              </section>
            </div>
          )}
          {bundle &&
            data.plans.some(
              (p) => p.id === bundle.planId && p.approved && p.revision !== bundle.planRevision,
            ) && (
              <button
                disabled={busy || ['running', 'queued', 'uncertain'].includes(bundle.state)}
                onClick={() =>
                  void act(
                    () => request(`bundles/${bundle.id}/rebase`, { revision: bundle.revision }),
                    'Đã yêu cầu soạn lại theo kế hoạch mới, trong hạn mức AI hiện tại.',
                  )
                }
              >
                Soạn lại theo kế hoạch đã thay đổi
              </button>
            )}
          {view === 'calendar' && (
            <section className={s.panel}>
              <div className={s.panelHead}>
                <h2>Kế hoạch tháng</h2>
                <input
                  type="month"
                  aria-label="Tháng nội dung"
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setApprovalSelection([]);
                  }}
                />
              </div>
              <div className={s.panelBody}>
                <p>
                  90 bộ nội dung, chia đều 3 dịch vụ. Trong đó 45 bộ có video. Chỉ kế hoạch đã duyệt
                  mới được chạy tự động.
                </p>
                <div className={s.actions}>
                  <button
                    disabled={busy || !!currentPlan}
                    onClick={() =>
                      void act(
                        () => request('plans', { month }),
                        'Đã tạo khung lịch trống. Bạn có thể điền tiêu đề hoặc nhờ AI đề xuất.',
                      )
                    }
                  >
                    Tạo lịch tháng
                  </button>
                  {currentPlan && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => setPlanEdit(structuredClone(currentPlan))}
                      >
                        Chỉnh chủ đề
                      </button>
                      <button
                        disabled={busy || !data.status.generationEnabled}
                        onClick={() =>
                          void act(
                            () =>
                              request(`plans/${currentPlan.id}/generate`, {
                                revision: currentPlan.revision,
                              }),
                            'AI đang đề xuất các chủ đề. Kết quả vẫn cần bạn duyệt.',
                          )
                        }
                      >
                        AI đề xuất kế hoạch
                      </button>
                      <button
                        className={s.primary}
                        disabled={
                          busy ||
                          (approvalSelection.length === 0 &&
                            currentPlan.items.every((i) => i.approved ?? currentPlan.approved))
                        }
                        onClick={() =>
                          void act(
                            () =>
                              request(`plans/${currentPlan.id}/approve`, {
                                revision: currentPlan.revision,
                                ...(approvalSelection.length ? { itemIds: approvalSelection } : {}),
                              }),
                            'Đã duyệt kế hoạch. Tự động chỉ chạy khi dịch vụ đã được kích hoạt.',
                          )
                        }
                      >
                        {approvalSelection.length
                          ? `Duyệt ${approvalSelection.length} mục đã chọn`
                          : 'Duyệt kế hoạch'}
                      </button>
                      <button
                        disabled={busy || !currentPlan.approved || !data.status.generationEnabled}
                        onClick={() =>
                          void act(
                            () => request('prepare-today', {}),
                            'Đã yêu cầu chuẩn bị các mục đã duyệt của hôm nay.',
                          )
                        }
                      >
                        Chuẩn bị nội dung hôm nay
                      </button>
                    </>
                  )}
                </div>
                {currentPlan ? (
                  <div className={s.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>Chọn duyệt</th>
                          <th>Ngày</th>
                          <th>Dịch vụ</th>
                          <th>Chủ đề</th>
                          <th>Định dạng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPlan.items.map((i) => (
                          <tr key={i.id}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Chọn ${i.date} ${serviceLabels[i.service]}`}
                                checked={approvalSelection.includes(i.id)}
                                onChange={(e) =>
                                  setApprovalSelection((v) =>
                                    e.target.checked ? [...v, i.id] : v.filter((id) => id !== i.id),
                                  )
                                }
                              />
                              {(i.approved ?? currentPlan.approved) ? 'Đã duyệt' : 'Chưa duyệt'}
                            </td>
                            <td>{i.date}</td>
                            <td>{serviceLabels[i.service]}</td>
                            <td>{i.title || 'Chưa có chủ đề'}</td>
                            <td>{i.video ? 'Ảnh + video' : 'Ảnh'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={s.empty}>
                    Chưa có kế hoạch tháng này. Không tự tạo hoặc duyệt nội dung ngoài kế hoạch.
                  </div>
                )}
              </div>
            </section>
          )}
          {view === 'brand' && (
            <section className={s.panel}>
              <div className={s.panelHead}>
                <h2>Hồ sơ thương hiệu chung</h2>
                <span>{data.brand.approved ? 'Đã duyệt' : 'Chưa duyệt'}</span>
              </div>
              <form
                className={s.panelBody}
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(
                    async () => {
                      const saved = await marketingRequest<{ brand: Brand }>(
                        'brand',
                        'PATCH',
                        brand,
                      );
                      setBrand(saved.brand);
                      setData((current) =>
                        current ? { ...current, brand: saved.brand } : current,
                      );
                    },
                    'Đã lưu hồ sơ thương hiệu.',
                    false,
                  );
                }}
              >
                <label>
                  Tên thương hiệu
                  <input
                    value={brand.name}
                    maxLength={100}
                    onChange={(e) => setBrand({ ...brand, name: e.target.value, approved: false })}
                    required
                  />
                </label>
                <label>
                  Thông tin liên hệ thật
                  <input
                    value={brand.contact}
                    maxLength={500}
                    onChange={(e) =>
                      setBrand({ ...brand, contact: e.target.value, approved: false })
                    }
                    placeholder="Có thể để trống khi chưa có"
                  />
                </label>
                <label>
                  Giọng văn
                  <input
                    value={brand.tone}
                    maxLength={500}
                    onChange={(e) => setBrand({ ...brand, tone: e.target.value, approved: false })}
                  />
                </label>
                <label>
                  Mô tả ba dịch vụ và tài liệu nguồn
                  <textarea
                    value={brand.description}
                    maxLength={12000}
                    rows={10}
                    onChange={(e) =>
                      setBrand({ ...brand, description: e.target.value, approved: false })
                    }
                    placeholder="Thông tin chữ ký số; đào tạo AI; đào tạo đầu tư. Chỉ nhập giá, ưu đãi và cam kết đã được xác nhận. Có thể thêm URL tài liệu nguồn."
                  />
                </label>
                <label className={s.checkbox}>
                  <input
                    type="checkbox"
                    checked={brand.approved}
                    onChange={(e) => setBrand({ ...brand, approved: e.target.checked })}
                  />
                  Tôi đã kiểm tra và duyệt hồ sơ này để AI sử dụng.
                </label>
                <button type="submit" className={s.primary} disabled={busy}>
                  Lưu hồ sơ thương hiệu
                </button>
                <p className={s.note}>
                  Không cần bịa thông tin còn thiếu. Khi chưa có logo, có thể dùng tên thương hiệu
                  dạng chữ sau khi bạn duyệt.
                </p>
              </form>
            </section>
          )}
          {view === 'status' && (
            <section className={s.panel}>
              <div className={s.panelHead}>
                <h2>Trạng thái dịch vụ</h2>
                <span className={s.pill}>
                  {data.status.enabled ? 'Đã bật tính năng' : 'Chưa kích hoạt'}
                </span>
              </div>
              <div className={s.panelBody}>
                <dl className={s.statusList}>
                  <dt>Tạo bài, ảnh và video</dt>
                  <dd>
                    {data.status.generationEnabled ? 'Được bật bằng cấu hình máy chủ' : 'Đang tắt'}
                  </dd>
                  <dt>Chuẩn bị nội dung</dt>
                  <dd>20h hôm trước · Asia/Ho_Chi_Minh</dd>
                  <dt>Thông báo chờ duyệt</dt>
                  <dd>
                    Nhắm 08:00 · Nhóm Telegram đã cấu hình ·{' '}
                    {data.status.telegramEnabled ? 'Được bật' : 'Đang tắt'}
                  </dd>
                  <dt>Scheduler</dt>
                  <dd>
                    {data.status.scheduleEnabled
                      ? 'Được bật bằng cấu hình; cần xem nhật ký để xác nhận lần chạy'
                      : 'Chưa bật lịch thật'}
                  </dd>
                  <dt>Ngân sách AI</dt>
                  <dd>
                    {money(data.budget.limit)}/tháng. Đã ghi nhận {money(data.budget.spent)}, giữ
                    chỗ {money(data.budget.reserved)}.
                  </dd>
                </dl>
                {data.status.missing.length > 0 && (
                  <>
                    <h3>Cấu hình cần bổ sung</h3>
                    <ul>
                      {data.status.missing.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </>
                )}
                <div className={s.note}>
                  Thông tin cấu hình có sẵn không có nghĩa là lịch đã chạy thành công. Không bật
                  dịch vụ trả phí trước khi chủ sở hữu duyệt chi phí và cấu hình vận hành.
                </div>
              </div>
            </section>
          )}
        </>
      )}
      {planEdit && (
        <Modal title="Chỉnh kế hoạch tháng" wide onClose={() => setPlanEdit(null)}>
          <p>Điền chủ đề cho từng mục. Sửa kế hoạch sẽ yêu cầu duyệt lại.</p>
          <div className={s.planEditor}>
            {planEdit.items.map((i, n) => (
              <label key={i.id}>
                {i.date} · {serviceLabels[i.service]} · {i.video ? 'Có video' : 'Ảnh'}
                <input
                  value={i.title}
                  maxLength={180}
                  onChange={(e) =>
                    setPlanEdit({
                      ...planEdit,
                      items: planEdit.items.map((v, index) =>
                        index === n ? { ...v, title: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <button
            className={s.primary}
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await marketingRequest(`plans/${planEdit.id}`, 'PATCH', {
                  revision: planEdit.revision,
                  items: planEdit.items,
                });
                setPlanEdit(null);
              }, 'Đã lưu chủ đề. Cần duyệt lại kế hoạch.')
            }
          >
            Lưu kế hoạch
          </button>
        </Modal>
      )}
      {scriptEdit !== null && bundle && (
        <Modal title="Chỉnh kịch bản video" onClose={() => setScriptEdit(null)}>
          <label className={s.label} htmlFor="marketing-script">
            Lời đọc tiếng Việt (tối đa 1.800 ký tự)
          </label>
          <textarea
            id="marketing-script"
            rows={12}
            maxLength={1800}
            value={scriptEdit}
            onChange={(e) => setScriptEdit(e.target.value)}
          />
          <p>
            Sửa lời đọc sẽ yêu cầu duyệt và dựng lại video. Lời đọc được chia thành các đoạn phụ đề
            ngắn.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await marketingRequest(`bundles/${bundle.id}`, 'PATCH', {
                  revision: bundle.revision,
                  script: scriptEdit,
                });
                setScriptEdit(null);
              }, 'Đã sửa kịch bản. Cần duyệt lại.')
            }
          >
            Lưu kịch bản
          </button>
        </Modal>
      )}
      {claimEdit && bundle && (
        <Modal title="Kiểm tra thông tin và nguồn" onClose={() => setClaimEdit(null)}>
          {claimEdit.map((c, i) => (
            <div key={i} className={s.claim}>
              <p>{c.text}</p>
              <label>
                Nguồn đã kiểm tra
                <input
                  value={c.source}
                  onChange={(e) =>
                    setClaimEdit(
                      claimEdit.map((v, n) =>
                        n === i ? { ...v, source: e.target.value, verified: false } : v,
                      ),
                    )
                  }
                />
              </label>
              <label className={s.checkbox}>
                <input
                  type="checkbox"
                  checked={c.verified}
                  disabled={!c.source.trim()}
                  onChange={(e) =>
                    setClaimEdit(
                      claimEdit.map((v, n) => (n === i ? { ...v, verified: e.target.checked } : v)),
                    )
                  }
                />
                Tôi đã kiểm tra thông tin với nguồn này.
              </label>
            </div>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await marketingRequest(`bundles/${bundle.id}`, 'PATCH', {
                  revision: bundle.revision,
                  claims: claimEdit,
                });
                setClaimEdit(null);
              }, 'Đã lưu kết quả kiểm chứng; cần duyệt lại thành phẩm.')
            }
          >
            Lưu kiểm chứng
          </button>
        </Modal>
      )}
      {asset && (
        <Modal
          title={asset.kind === 'video' ? 'Video đã dựng' : 'Ảnh đã tạo'}
          wide
          onClose={() => setAsset(null)}
        >
          {asset.kind === 'video' ? (
            <video className={s.asset} src={asset.url} controls playsInline />
          ) : (
            <a href={asset.url} target="_blank" rel="noopener noreferrer">
              <span>Mở ảnh kích thước đầy đủ</span>
              <Image
                unoptimized
                width={1024}
                height={1024}
                className={s.asset}
                src={asset.url}
                alt="Ảnh Marketing đã tạo cho thương hiệu Đạt Nguyễn"
              />
            </a>
          )}
          <p className={s.note}>Liên kết xem riêng tư hết hạn sau 5 phút.</p>
        </Modal>
      )}
    </div>
  );
}
