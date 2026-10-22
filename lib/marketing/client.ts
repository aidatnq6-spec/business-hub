import { firebaseClient } from '../firebase-client';
const errors: Record<string, string> = {
  marketing_unauthorized: 'Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.',
  marketing_forbidden: 'Tài khoản này không có quyền truy cập.',
  marketing_revision_conflict: 'Nội dung đã thay đổi. Bấm Làm mới rồi kiểm tra lại trước khi lưu.',
  marketing_plan_conflict: 'Đã có kế hoạch cho tháng này.',
  marketing_not_ready: 'Chưa đủ cấu hình hoặc chưa bật tạo nội dung. Xem phần trạng thái dịch vụ.',
  marketing_server_unavailable:
    'Chưa kết nối được máy chủ. Kiểm tra Firebase Admin và cấu hình dịch vụ.',
  marketing_firebase_admin_missing:
    'Máy chủ chưa được cấu hình Firebase Admin. Cần bổ sung thông tin xác thực để tải dữ liệu Marketing.',
  marketing_firebase_admin_invalid:
    'Thông tin xác thực Firebase Admin chưa hợp lệ. Kiểm tra file JSON hoặc biến môi trường máy chủ.',
  marketing_firebase_project_missing: 'Chưa có cấu hình project Firebase cho máy chủ.',
  marketing_firebase_project_mismatch:
    'Thông tin Firebase Admin thuộc project khác với project Business Hub đang dùng.',
  marketing_brand_not_approved: 'Hãy lưu và duyệt hồ sơ thương hiệu trước.',
  marketing_plan_incomplete: 'Cần điền đủ tiêu đề của 90 chủ đề trước khi duyệt kế hoạch.',
  marketing_approval_incomplete: 'Chưa đủ ảnh, video hoặc nguồn được xác minh để duyệt thành phẩm.',
  marketing_script_incomplete: 'Kịch bản chưa đủ tư liệu hoặc còn thông tin cần kiểm chứng.',
  marketing_job_conflict: 'Tác vụ đang chạy hoặc cần được kiểm tra trước khi thử lại.',
  marketing_budget_exceeded: 'Không đủ hạn mức AI còn lại.',
  marketing_input_invalid: 'Thông tin chưa hợp lệ. Kiểm tra các trường nhập.',
};
export async function marketingRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const user = firebaseClient().auth.currentUser;
  if (!user) throw new Error(errors.marketing_unauthorized);
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  const timeout = setTimeout(() => controller.abort(new Error('marketing_request_timeout')), 30000);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
  });
  try {
    return await Promise.race([
      aborted,
      (async () => {
        const token = await user.getIdToken();
        controller.signal.throwIfAborted();
        const result = await fetch(`/api/marketing/${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          cache: 'no-store',
        });
        const value = await result.json();
        if (!result.ok)
          throw Object.assign(
            new Error(
              errors[value.error] ??
                'Chưa hoàn tất thao tác. Kiểm tra trạng thái cấu hình và thử lại.',
            ),
            {
              code: typeof value.error === 'string' ? value.error : 'marketing_server_unavailable',
            },
          );
        return value;
      })(),
    ]);
  } catch (error) {
    if (
      controller.signal.aborted &&
      controller.signal.reason?.message === 'marketing_request_timeout'
    ) {
      throw Object.assign(
        new Error(
          method === 'GET'
            ? 'Máy chủ phản hồi quá lâu. Hãy thử tải lại.'
            : 'Chưa xác nhận được kết quả lưu do kết nối chậm. Hãy tải lại để kiểm tra trước khi lưu tiếp.',
        ),
        { code: 'marketing_request_timeout' },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
