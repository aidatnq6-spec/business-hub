import { firebaseClient } from '../firebase-client';

const messages: Record<string, string> = {
  ai_provider_unavailable:
    'Dịch vụ Gemini chưa phản hồi hoặc đang giới hạn yêu cầu. Hãy thử kiểm tra lại sau.',
  ai_provider_rejected:
    'Gemini từ chối khóa hoặc quyền truy cập model. Hãy kiểm tra đúng API key và dự án.',
  ai_metadata_invalid: 'Gemini trả metadata không phù hợp. Chưa xác nhận kết nối thành công.',
  ai_check_timeout: 'Kiểm tra kết nối quá thời gian chờ. Hãy thử lại sau.',
  ai_environment_check_requires_app_key:
    'Khóa đang được quản lý qua máy chủ. Nhập khóa trong ứng dụng để kiểm tra và quản lý tại đây.',
  ai_catalog_unverified: 'Model hoặc bảng giá đã hết hiệu lực. Cần xác minh lại trước khi sử dụng.',
  ai_unauthorized: 'Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.',
  ai_forbidden: 'Chỉ chủ sở hữu được quản lý cài đặt AI.',
  ai_revision_conflict: 'Cài đặt đã thay đổi. Hãy tải lại trước khi thực hiện tiếp.',
  ai_input_invalid: 'Thông tin chưa hợp lệ. Hãy kiểm tra lại các trường nhập.',
  ai_content_type_invalid: 'Định dạng dữ liệu gửi lên chưa hợp lệ. Hãy tải lại trang.',
  ai_body_too_large: 'Dữ liệu gửi lên vượt giới hạn. Hãy kiểm tra lại các trường nhập.',
  ai_budget_below_committed: 'Hạn mức không được thấp hơn tổng đã ghi nhận và đang giữ chỗ.',
  ai_rate_limited: 'Bạn thao tác quá nhanh. Hãy đợi một phút rồi thử lại.',
  ai_encryption_key_missing: 'Máy chủ chưa có khóa chủ mã hóa. Cần cấu hình trước khi lưu API key.',
  ai_encryption_key_invalid: 'Khóa chủ mã hóa của máy chủ chưa hợp lệ.',
  ai_master_key_missing: 'Máy chủ chưa có khóa chủ mã hóa. Cần cấu hình trước khi lưu API key.',
  ai_master_key_invalid: 'Khóa chủ mã hóa của máy chủ chưa hợp lệ.',
  ai_credential_missing: 'Chưa có API key để kiểm tra kết nối.',
  ai_credential_changed: 'API key đã thay đổi. Hãy tải lại trạng thái trước khi thực hiện tiếp.',
  ai_encryption_unavailable:
    'Máy chủ chưa có khóa chủ mã hóa hợp lệ. Cần cấu hình trước khi lưu hoặc dùng API key.',
  ai_credential_unreadable:
    'Máy chủ chưa giải mã được API key. Hãy kiểm tra khóa chủ mã hóa và nhập lại API key nếu cần.',
  ai_check_needs_confirmation:
    'Chưa xác minh được phép kiểm tra miễn phí. Chưa gọi dịch vụ AI; cần duyệt phương án kiểm tra trước.',
  ai_origin_forbidden: 'Địa chỉ ứng dụng chưa được phép cập nhật cài đặt AI trên máy chủ.',
  ai_server_unavailable:
    'Chưa kết nối được dịch vụ cài đặt AI. Hãy tải lại hoặc kiểm tra cấu hình máy chủ.',
};

function failure(code: string, message: string, status?: number) {
  return Object.assign(new Error(message), { code, status });
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function settingsResponse(value: Record<string, unknown>) {
  const { credential, budget, capabilities, activation } = value;
  return (
    record(credential) &&
    credential.provider === 'gemini' &&
    ['app', 'environment', 'none'].includes(String(credential.source)) &&
    typeof credential.configured === 'boolean' &&
    (credential.suffix === null || typeof credential.suffix === 'string') &&
    Number.isSafeInteger(credential.revision) &&
    record(credential.check) &&
    ['unchecked', 'checking', 'valid', 'error'].includes(String(credential.check.state)) &&
    record(budget) &&
    typeof budget.month === 'string' &&
    ['spent', 'reserved', 'limit', 'remaining', 'revision'].every(
      (key) => Number.isSafeInteger(budget[key]) && Number(budget[key]) >= 0,
    ) &&
    typeof budget.warning === 'boolean' &&
    Array.isArray(capabilities) &&
    capabilities.every(
      (item) =>
        record(item) &&
        typeof item.id === 'string' &&
        ['missing', 'unchecked', 'ready', 'error'].includes(String(item.state)) &&
        Array.isArray(item.reasons) &&
        item.reasons.every((reason) => typeof reason === 'string'),
    ) &&
    record(activation) &&
    typeof activation.desired === 'boolean' &&
    typeof activation.effective === 'boolean' &&
    Array.isArray(activation.reasons) &&
    activation.reasons.every((reason) => typeof reason === 'string')
  );
}

/** A single bounded request, with no retries and no browser persistence. */
export async function aiSettingsRequest<T>(
  path = '',
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const user = firebaseClient().auth.currentUser;
  if (!user) throw failure('ai_unauthorized', messages.ai_unauthorized);
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  const timer = setTimeout(() => controller.abort(new Error('ai_request_timeout')), 30000);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let onAbort = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
  });
  try {
    return await Promise.race([
      interrupted,
      (async () => {
        controller.signal.throwIfAborted();
        const token = await user.getIdToken();
        controller.signal.throwIfAborted();
        const response = await fetch(`/api/ai-settings${path ? `/${path}` : ''}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          cache: 'no-store',
          signal: controller.signal,
        });
        const text = await response.text();
        let value: unknown;
        try {
          value = JSON.parse(text);
        } catch {
          throw failure(
            'ai_response_invalid',
            `Máy chủ trả về phản hồi không hợp lệ (HTTP ${response.status}). Hãy tải lại để kiểm tra kết quả.`,
            response.status,
          );
        }
        if (!record(value))
          throw failure(
            'ai_response_invalid',
            'Phản hồi cài đặt AI không hợp lệ. Hãy tải lại để kiểm tra kết quả.',
            response.status,
          );
        if (!response.ok) {
          const raw = 'error' in value && typeof value.error === 'string' ? value.error : '';
          const code = Object.hasOwn(messages, raw)
            ? raw
            : response.status === 401
              ? 'ai_unauthorized'
              : response.status === 403
                ? 'ai_forbidden'
                : response.status === 409
                  ? 'ai_revision_conflict'
                  : response.status === 429
                    ? 'ai_rate_limited'
                    : 'ai_server_unavailable';
          throw failure(code, messages[code], response.status);
        }
        if (!settingsResponse(value))
          throw failure(
            'ai_response_invalid',
            'Phản hồi cài đặt AI thiếu dữ liệu cần thiết. Hãy tải lại để kiểm tra kết quả.',
            response.status,
          );
        return value as T;
      })(),
    ]);
  } catch (error) {
    if (controller.signal.reason?.message === 'ai_request_timeout')
      throw failure(
        'ai_request_timeout',
        method === 'GET'
          ? 'Máy chủ phản hồi quá lâu. Hãy thử tải lại.'
          : 'Chưa xác nhận được kết quả do kết nối chậm. Hãy tải lại để kiểm tra trước khi thực hiện tiếp.',
      );
    if (controller.signal.aborted) throw controller.signal.reason;
    if (error instanceof Error && 'code' in error) throw error;
    throw failure('ai_server_unavailable', messages.ai_server_unavailable);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
