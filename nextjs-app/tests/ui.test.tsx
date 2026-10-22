import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoProvider, STORAGE_KEY, useHub } from '@/components/demo-provider';
import { Sale } from '@/components/sale';
import { Accounting } from '@/components/accounting';
import { Operations } from '@/components/operations';
import { Debts } from '@/components/debts';
import { Reports } from '@/components/reports';
import { Dashboard } from '@/components/dashboard';
import { Settings } from '@/components/settings';
import { TelegramPreview } from '@/components/telegram-preview';
import { BackupDialog } from '@/components/backup-dialog';
import { HubShell } from '@/components/shell';
import Login from '@/app/login/page';
import { createDemoData } from '@/lib/demo';
import { businessDate, exportBackup, validateData } from '@/lib/domain';

vi.mock('next/dynamic', () => ({
  default: () =>
    function ChartPlaceholder() {
      return <div>Biểu đồ mẫu</div>;
    },
}));
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => navigation }));
function Ready() {
  const h = useHub();
  return <span data-testid="ready">{h.ready ? 'ready' : 'loading'}</span>;
}
function Notice() {
  const h = useHub();
  return (
    <>
      <div role="status">{h.notice}</div>
      <button onClick={h.undo} disabled={!h.canUndo}>
        Hoàn tác kiểm thử
      </button>
    </>
  );
}
async function mount(ui: React.ReactNode) {
  const result = render(
    <DemoProvider>
      <Ready />
      <Notice />
      {ui}
    </DemoProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('ready'));
  return result;
}

describe('editable screens', () => {
  it('renders dashboard totals and opens the mock AI result', async () => {
    const user = userEvent.setup();
    await mount(<Dashboard />);
    expect(screen.getByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(screen.getAllByText('23.000.000đ').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '🧠 Briefing thông minh' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '✨ Tạo với AI' }),
    );
    await waitFor(() => expect(screen.getByText(/Kết quả mô phỏng/)).toBeInTheDocument());
  });
  it('creates a deal, persists it, and restores it when the provider remounts', async () => {
    const user = userEvent.setup();
    const app = await mount(<Sale />);
    await user.click(screen.getByRole('button', { name: '+ Thêm khách' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Tên khách hàng/), 'Khách thử mới');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.getByText('Khách thử mới')).toBeInTheDocument());
    expect(
      validateData(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).deals.some(
        (d) => d.ten === 'Khách thử mới',
      ),
    ).toBe(true);
    app.unmount();
    await mount(<Sale />);
    expect(screen.getByText('Khách thử mới')).toBeInTheDocument();
  });
  it('filters the pipeline and keeps lost deals from advancing', async () => {
    const user = userEvent.setup();
    await mount(<Sale />);
    await user.type(screen.getByLabelText('Tìm khách hàng'), 'Cửa hàng Mộc');
    expect(screen.queryByText('Công ty An Bình (mẫu)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '→ Tiến' })).toBeDisabled();
  });
  it('deletes a debt with confirmation and restores it through undo', async () => {
    const user = userEvent.setup();
    await mount(<Debts />);
    await user.click(screen.getByRole('button', { name: 'Xóa công nợ Công ty An Bình (mẫu)' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận xóa' }),
    );
    expect(screen.queryByText('Công ty An Bình (mẫu)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hoàn tác kiểm thử' }));
    expect(screen.getByText('Công ty An Bình (mẫu)')).toBeInTheDocument();
  });
  it('rejects a zero-value transaction before saving', async () => {
    const user = userEvent.setup();
    await mount(<Accounting />);
    await user.click(screen.getByRole('button', { name: '+ Thêm giao dịch' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Mô tả giao dịch/), 'Giao dịch không có tiền');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/lớn hơn 0/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('uses a transcript to fill both amounts correctly and saves a new expense', async () => {
    const user = userEvent.setup();
    await mount(<Accounting />);
    await user.type(
      screen.getByRole('textbox', { name: 'Câu giao dịch để thử' }),
      'chi 100 nghìn mua văn phòng phẩm',
    );
    await user.click(screen.getByRole('button', { name: 'Điền vào form' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Thu (đồng)')).toHaveValue(0);
    expect(within(dialog).getByLabelText('Chi (đồng)')).toHaveValue(100000);
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(screen.getByText('chi 100 nghìn mua văn phòng phẩm')).toBeInTheDocument();
  });
  it('completes a task and hides it from the today filter', async () => {
    const user = userEvent.setup();
    await mount(<Operations />);
    await user.click(
      screen.getByRole('checkbox', { name: 'Hoàn thành Gọi An Bình xác nhận gia hạn chữ ký số' }),
    );
    expect(
      screen.queryByRole('checkbox', { name: 'Hoàn thành Gọi An Bình xác nhận gia hạn chữ ký số' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Đã xong' }));
    expect(
      screen.getByRole('checkbox', { name: 'Hoàn thành Gọi An Bình xác nhận gia hạn chữ ký số' }),
    ).toBeChecked();
  });
  it('updates rent collection status and the persisted backup state', async () => {
    const user = userEvent.setup();
    await mount(<Operations />);
    const checkbox = screen.getByRole('checkbox', {
      name: 'Đã thu tiền thuê A12 · Chung cư Riverside (mẫu)',
    });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    const data = validateData(JSON.parse(localStorage.getItem(STORAGE_KEY)!));
    expect(data.rentPayments.some((p) => p.apartmentId === 'apt-1' && p.paid)).toBe(true);
  });
  it('creates an active monthly reminder for today without duplicating its todo', async () => {
    const user = userEvent.setup();
    await mount(<Operations />);
    await user.click(screen.getByRole('button', { name: '+ Thêm lịch' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Nội dung việc định kỳ/), 'Việc định kỳ thử');
    const day = within(dialog).getByLabelText('Ngày trong tháng');
    await user.clear(day);
    await user.type(day, String(Number(businessDate().slice(-2))));
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await user.click(screen.getByRole('button', { name: 'Kiểm tra việc đến hạn' }));
    const data = validateData(JSON.parse(localStorage.getItem(STORAGE_KEY)!));
    expect(data.todos.filter((t) => t.text === 'Việc định kỳ thử')).toHaveLength(1);
  });
  it('closes an editor with Escape and restores keyboard focus', async () => {
    const user = userEvent.setup();
    await mount(<Sale />);
    const button = screen.getByRole('button', { name: '+ Thêm khách' });
    await user.click(button);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
  it('renders imported HTML-like names as text rather than executable markup', async () => {
    const d = createDemoData();
    d.deals[0].ten = '<img src=x onerror=alert(1)>';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    const view = await mount(<Sale />);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(view.container.querySelector('img')).toBeNull();
  });
});

describe('mock integrations and safety boundaries', () => {
  it('previews all daily Telegram sections without making an external request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await mount(<TelegramPreview onClose={() => {}} />);
    expect(screen.getByText(/Lịch dự kiến: 07:00/)).toBeInTheDocument();
    const text = screen.getByRole('dialog').textContent;
    for (const label of [
      'Việc hôm nay',
      'Việc quá hạn',
      'Công nợ cần thu',
      'Doanh thu',
      'Chi phí',
      'Lợi nhuận',
    ])
      expect(text).toContain(label);
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('rejects a malformed backup without changing current data', async () => {
    const user = userEvent.setup();
    await mount(<BackupDialog onClose={() => {}} />);
    const before = localStorage.getItem(STORAGE_KEY);
    const file = new File(['{"appName":"Other","version":3,"data":{}}'], 'bad.json', {
      type: 'application/json',
    });
    Object.defineProperty(file, 'text', {
      value: async () => '{"appName":"Other","version":3,"data":{}}',
    });
    await user.upload(screen.getByLabelText('Chọn file JSON'), file);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });
  it('previews and merges a valid backup only after confirmation', async () => {
    const user = userEvent.setup();
    await mount(<BackupDialog onClose={() => {}} />);
    const d = createDemoData();
    d.deals[0].ten = 'Khách nhập backup';
    const text = exportBackup(d);
    const file = new File([text], 'backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => text });
    await user.upload(screen.getByLabelText('Chọn file JSON'), file);
    await screen.findByText('Xác nhận gộp: backup.json');
    expect(validateData(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).deals[0].ten).not.toBe(
      'Khách nhập backup',
    );
    await user.click(screen.getByRole('button', { name: 'Xác nhận gộp dữ liệu mẫu' }));
    expect(validateData(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).deals[0].ten).toBe(
      'Khách nhập backup',
    );
  });
  it('keeps the key input out of persistent mock data and never sends it', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await mount(<Settings />);
    await user.type(screen.getByLabelText('OpenRouter API key (nhập thử)'), 'test-only-key');
    await user.click(screen.getByRole('button', { name: 'Lưu cài đặt AI' }));
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('test-only-key');
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText('OpenRouter API key (nhập thử)')).toHaveValue('');
    vi.unstubAllGlobals();
  });
  it('renders reports and navigates report months without live services', async () => {
    const user = userEvent.setup();
    await mount(<Reports />);
    expect(screen.getByRole('heading', { name: '📊 Báo cáo tháng' })).toBeInTheDocument();
    const month = screen.getByLabelText('Chọn tháng');
    const initial = (month as HTMLInputElement).value;
    await user.click(screen.getByRole('button', { name: 'Tháng trước' }));
    expect((month as HTMLInputElement).value).not.toBe(initial);
  });
});

describe('regressions found during compatibility review', () => {
  it('signs out and re-enters the demo without a real account or network request', async () => {
    function SessionFlow() {
      const hub = useHub();
      return hub.authenticated ? (
        <HubShell>
          <p>Demo session content</p>
        </HubShell>
      ) : (
        <Login />
      );
    }
    const user = userEvent.setup();
    await mount(<SessionFlow />);
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(screen.getByRole('button', { name: 'Vào bản dùng thử' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vào bản dùng thử' }));
    expect(screen.getByText('Demo session content')).toBeInTheDocument();
    expect(navigation.push).toHaveBeenCalledWith('/');
  });
  it('keeps an old completed todo completed when editing it', async () => {
    const user = userEvent.setup();
    const d = createDemoData();
    d.todos.find((t) => t.id === 'todo-6')!.status = 'open';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    await mount(<Operations />);
    await user.click(screen.getByRole('button', { name: 'Đã xong' }));
    await user.click(
      screen.getByRole('button', { name: 'Sửa việc Hoàn tất cài đặt token cho Tiệm Bánh Nắng' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Trạng thái')).toHaveValue('done');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(
      validateData(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).todos.find(
        (t) => t.id === 'todo-6',
      )?.done,
    ).toBe(true);
  });
  it('supports keyboard selection from global search', async () => {
    const user = userEvent.setup();
    await mount(
      <HubShell>
        <p>Demo content</p>
      </HubShell>,
    );
    const search = screen.getByRole('combobox', { name: 'Tìm kiếm toàn bộ' });
    await user.type(search, 'An Bình');
    expect(screen.getByRole('listbox', { name: 'Kết quả tìm kiếm' })).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(navigation.push).toHaveBeenCalledWith('/sale');
    expect(search).toHaveValue('');
  });
  it('recovers from invalid saved mock data without crashing', async () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json');
    await mount(<Sale />);
    expect(screen.getByRole('status')).toHaveTextContent(/Dữ liệu mẫu đã lưu không hợp lệ/);
    expect(screen.getByRole('heading', { name: '💼 Sale Pipeline' })).toBeInTheDocument();
  });
  it('exports a JSON backup and records the local export history', async () => {
    const user = userEvent.setup();
    const create = vi.fn(() => 'blob:demo-backup');
    const revoke = vi.fn();
    const OriginalURL = URL;
    vi.stubGlobal(
      'URL',
      class extends OriginalURL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await mount(<BackupDialog onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: '📥 Xuất backup ngay' }));
    expect(create).toHaveBeenCalled();
    expect(screen.getByText(`business-hub-demo-${businessDate()}.json`)).toBeInTheDocument();
    expect(localStorage.getItem('business-hub:next:demo-backup-history')).toContain(
      'business-hub-demo-',
    );
    await waitFor(() => expect(revoke).toHaveBeenCalled(), { timeout: 1500 });
    vi.unstubAllGlobals();
  });
});
