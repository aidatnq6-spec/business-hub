import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/marketing/client', () => ({ marketingRequest: request }));
import { MarketingStudio } from '@/components/marketing/studio';
import { initialBrand } from '@/lib/marketing/domain';
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({
    brand: initialBrand(),
    plans: [],
    bundles: [],
    jobs: [],
    budget: { spent: 0, reserved: 0, limit: 1000000 },
    status: {
      enabled: false,
      generationEnabled: false,
      scheduleEnabled: false,
      telegramEnabled: false,
      missing: ['API Gemini'],
    },
  });
});
describe('marketing workspace', () => {
  it('unlocks the save button and uses the confirmed revision for a second save without reloading the dashboard', async () => {
    const dashboard = await request();
    let revision = 0;
    request.mockImplementation(async (path, method, body) => {
      if (path === 'brand' && method === 'PATCH') {
        expect(body.revision).toBe(revision);
        return { ok: true, brand: { ...body, revision: ++revision } };
      }
      if (revision > 0) return new Promise(() => {});
      return dashboard;
    });
    render(<MarketingStudio />);
    await screen.findByText(/Chưa có bộ nội dung cho dịch vụ này/);
    fireEvent.click(screen.getByRole('button', { name: 'Hồ sơ thương hiệu' }));
    const save = screen.getByRole('button', { name: 'Lưu hồ sơ thương hiệu' });
    fireEvent.click(save);
    await screen.findByText('Đã lưu hồ sơ thương hiệu.');
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(revision).toBe(2));
    await waitFor(() => expect(save).toBeEnabled());
  });
  it('explains missing Firebase Admin without substituting demo data', async () => {
    request.mockRejectedValue(
      Object.assign(new Error('Máy chủ chưa được cấu hình Firebase Admin.'), {
        code: 'marketing_firebase_admin_missing',
      }),
    );
    render(<MarketingStudio />);
    expect(
      await screen.findByRole('heading', { name: 'Thiết lập Firebase Admin cho máy chủ' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Marketing cần thông tin xác thực riêng/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Firebase Console' })).toHaveAttribute(
      'href',
      'https://console.firebase.google.com/',
    );
    expect(screen.queryByText(/Chưa có bộ nội dung cho dịch vụ này/)).not.toBeInTheDocument();
  });
  it('shows true empty/configuration states without sample production numbers', async () => {
    render(<MarketingStudio />);
    await screen.findByText(/Chưa có bộ nội dung cho dịch vụ này/);
    expect(screen.getByText(/Cần bổ sung: API Gemini/)).toBeInTheDocument();
    expect(screen.queryByText('240.000đ')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Duyệt thành phẩm/ })).toBeDisabled();
  });
  it('keeps approval explicit when saving the initial brand', async () => {
    render(<MarketingStudio />);
    await screen.findByText(/Chưa có bộ nội dung cho dịch vụ này/);
    fireEvent.click(screen.getByRole('button', { name: 'Hồ sơ thương hiệu' }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ thương hiệu' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        'brand',
        'PATCH',
        expect.objectContaining({ name: 'Đạt Nguyễn', approved: true, revision: 0 }),
      ),
    );
  });
  it('does not silently use demo data when the server fails', async () => {
    request.mockRejectedValue(new Error('Firebase Admin chưa cấu hình'));
    render(<MarketingStudio />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Firebase Admin chưa cấu hình');
    expect(screen.queryByText(/Chưa có bộ nội dung cho dịch vụ này/)).not.toBeInTheDocument();
  });
});
