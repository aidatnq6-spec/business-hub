import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai-settings/client', () => ({ aiSettingsRequest: request }));
import { AiSettingsPanel } from '@/components/ai-settings/panel';
const view = () => ({
  credential: {
    provider: 'gemini',
    source: 'none',
    configured: false,
    suffix: null,
    revision: 0,
    updatedAt: null,
    check: { state: 'unchecked', checkedAt: null, code: null, scope: null },
  },
  budget: {
    month: '2026-10',
    spent: 200000,
    reserved: 100000,
    limit: 1000000,
    remaining: 700000,
    warning: false,
    revision: 0,
  },
  capabilities: [{ id: 'text', state: 'missing', reasons: ['Chưa có API key'] }],
  activation: { desired: false, effective: false, reasons: ['Chưa duyệt chi phí và lịch'] },
});
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(view());
});
describe('AI settings owner controls', () => {
  it('requires metadata reload after an uncertain save and never sends an automatic retry', async () => {
    render(<AiSettingsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm API key' }));
    fireEvent.change(screen.getByLabelText('API key Gemini'), {
      target: { value: 'temporary-key' },
    });
    request.mockRejectedValueOnce(
      Object.assign(new Error('Chưa xác nhận được kết quả. Hãy tải lại.'), {
        code: 'ai_request_timeout',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lưu khóa' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Lưu khóa' })).toBeDisabled();
    expect(request).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.getByRole('button', { name: 'Thêm API key' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Thêm API key' })).toBeEnabled());
    expect(request).toHaveBeenLastCalledWith('', 'GET', undefined, undefined);
  });
  it('shows current model metadata and the 80 percent budget warning without arbitrary model inputs', async () => {
    const data = view();
    data.budget = {
      ...data.budget,
      spent: 700000,
      reserved: 100000,
      remaining: 200000,
      warning: true,
    };
    const enriched = {
      ...data,
      capabilities: [
        {
          ...data.capabilities[0],
          selection: {
            provider: 'gemini',
            model: 'verified-test-model',
            capability: 'text',
            verifiedAt: '2026-10-22T00:00:00Z',
            validUntil: '2026-11-21T00:00:00Z',
            priceVersion: 'test-price-version',
            prices: { inputUsdPerMillion: 0.25 },
            source: 'https://ai.google.dev/gemini-api/docs/pricing',
          },
        },
      ],
    };
    request.mockResolvedValue(enriched);
    render(<AiSettingsPanel />);
    expect(await screen.findByText(/từ 80% hạn mức/)).toBeInTheDocument();
    expect(screen.getByText('verified-test-model')).toBeInTheDocument();
    expect(screen.getByText(/test-price-version/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nguồn bảng giá chính thức' })).toHaveAttribute(
      'href',
      'https://ai.google.dev/gemini-api/docs/pricing',
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
  it('shows real ledger values and keeps activation off', async () => {
    render(<AiSettingsPanel />);
    await screen.findByRole('button', { name: 'Thêm API key' });
    expect(screen.getByText('700.000₫')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bật tạo nội dung và lịch' })).toBeDisabled();
    expect(screen.queryByText(/OpenRouter/)).not.toBeInTheDocument();
  });
  it('clears the password after closing and sends the canonical revision on replacement', async () => {
    const configured = view();
    Object.assign(configured.credential, {
      configured: true,
      source: 'app',
      suffix: 'abcd',
      revision: 3,
    });
    request.mockResolvedValue(configured);
    render(<AiSettingsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thay khóa' }));
    let input = screen.getByLabelText('API key Gemini');
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: 'temporary-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thay khóa' }));
    input = screen.getByLabelText('API key Gemini');
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: 'new-test-secret' } });
    const updated = {
      ...configured,
      credential: { ...configured.credential, revision: 4, suffix: 'cret' },
    };
    request.mockResolvedValue(updated);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu khóa' }));
    await screen.findByText('Đã lưu khóa. Tạo nội dung và lịch giữ nguyên trạng thái.');
    expect(request).toHaveBeenLastCalledWith('credential', 'PUT', {
      provider: 'gemini',
      key: 'new-test-secret',
      revision: 3,
    });
    expect(screen.queryByLabelText('API key Gemini')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết nối' }));
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith('credential/check', 'POST', {
        provider: 'gemini',
        revision: 4,
      }),
    );
  });
  it('requires deletion confirmation and does not announce success on failure', async () => {
    const configured = view();
    configured.credential.configured = true;
    request.mockResolvedValue(configured);
    render(<AiSettingsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa khóa' }));
    expect(request).toHaveBeenCalledTimes(1);
    const dialog = screen.getByRole('dialog');
    request.mockRejectedValue(new Error('Không thể lưu thay đổi.'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận xóa khóa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể lưu thay đổi.');
    expect(screen.queryByText('Đã xóa khóa.')).not.toBeInTheDocument();
  });
  it('validates committed budget and confirms a canonical update without enabling anything', async () => {
    render(<AiSettingsPanel />);
    await screen.findByRole('button', { name: 'Thêm API key' });
    const input = screen.getByLabelText('Hạn mức AI mỗi tháng (đồng)');
    fireEvent.change(input, { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật hạn mức' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/đã ghi nhận và đang giữ chỗ/);
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { value: '500000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật hạn mức' }));
    request.mockResolvedValue({
      ...view(),
      budget: { ...view().budget, limit: 500000, remaining: 200000, revision: 1 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hạn mức' }));
    await screen.findByText('Đã cập nhật hạn mức AI.');
    expect(request).toHaveBeenLastCalledWith('budget', 'PATCH', {
      monthlyLimit: 500000,
      revision: 0,
    });
  });
  it('shows warnings and zero-limit blocking from ledger without fabricating readiness', async () => {
    const data = view();
    data.budget = { ...data.budget, spent: 0, reserved: 0, limit: 0, remaining: 0 };
    request.mockResolvedValue(data);
    render(<AiSettingsPanel />);
    expect(await screen.findByText(/Hạn mức 0 đồng/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Điều kiện chạy thử' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/chưa chạy thử trả phí/i);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
