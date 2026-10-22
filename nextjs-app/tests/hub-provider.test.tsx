import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HubProvider, useHub } from '@/components/hub-provider';
import { RecordEditor } from '@/components/record-editor';
import Login from '@/app/login/page';
import { emptyData, OWNER_EMAIL } from '@/lib/cloud-data';
import { FakeGateway } from './fake-gateway';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
function Inspector() {
  const hub = useHub();
  return (
    <>
      <div data-testid="state">
        {JSON.stringify({
          ready: hub.ready,
          authReady: hub.authReady,
          authenticated: hub.authenticated,
          deals: hub.data.deals.length,
          canUndo: hub.canUndo,
          status: hub.syncStatus,
        })}
      </div>
      <div role="alert">{hub.syncError}</div>
      <div role="status">{hub.notice}</div>
      <button onClick={() => hub.save('deals', { ten: 'Khách mới' })}>Save</button>
      <button onClick={() => hub.signOut()}>Sign out</button>
      <button onClick={hub.retry}>Retry</button>
    </>
  );
}
async function mount(gateway: FakeGateway, children: React.ReactNode = null) {
  const view = render(
    <HubProvider gateway={gateway}>
      <Inspector />
      {children}
    </HubProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('"authReady":true'));
  return view;
}
describe('live data lifecycle', () => {
  it('starts empty and never loads or uploads an old mock dataset', async () => {
    const gateway = new FakeGateway(emptyData());
    localStorage.setItem(
      'business-hub:next:mock:v1',
      JSON.stringify({ deals: [{ ten: 'Mock must stay out' }] }),
    );
    await mount(gateway);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('"ready":true'));
    expect(screen.getByTestId('state')).toHaveTextContent('"deals":0');
    expect(gateway.writes).toHaveLength(0);
  });
  it('clears data on sign-out and ignores late snapshots from the previous account', async () => {
    const gateway = new FakeGateway(emptyData());
    await mount(gateway);
    const late = [...gateway.dataListeners][0];
    await userEvent.click(screen.getByText('Sign out'));
    act(() =>
      late({
        data: { ...emptyData(), deals: [{ id: 'private', ten: 'Other user data' } as never] },
        complete: true,
        fromCache: false,
      }),
    );
    expect(screen.getByTestId('state')).toHaveTextContent('"authenticated":false');
    expect(screen.getByTestId('state')).toHaveTextContent('"deals":0');
    expect(gateway.dataListeners.size).toBe(0);
  });
  it('retains permission errors and retries subscriptions without leaking listeners', async () => {
    const gateway = new FakeGateway(emptyData());
    const view = await mount(gateway);
    act(() => gateway.errorListeners.forEach((error) => error({ code: 'permission-denied' })));
    expect(screen.getByRole('alert')).toHaveTextContent(/từ chối quyền/);
    await userEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('"status":"live"'));
    expect(gateway.dataListeners.size).toBe(1);
    view.unmount();
    expect(gateway.dataListeners.size).toBe(0);
    expect(gateway.authListeners.size).toBe(0);
  });
  it('blocks writes before all collections load or while disconnected', async () => {
    const gateway = new FakeGateway(emptyData());
    gateway.complete = false;
    await mount(gateway);
    await userEvent.click(screen.getByText('Save'));
    expect(gateway.writes).toHaveLength(0);
    act(() => {
      gateway.complete = true;
      gateway.fromCache = true;
      gateway.emit();
    });
    await userEvent.click(screen.getByText('Save'));
    expect(gateway.writes).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent(/kết nối Firebase đầy đủ/);
  });
  it('keeps the editor open and reports a failed Firebase write', async () => {
    const gateway = new FakeGateway(emptyData());
    gateway.failure = Object.assign(new Error('denied'), { code: 'permission-denied' });
    const close = vi.fn();
    await mount(gateway, <RecordEditor collection="deals" onClose={close} />);
    await userEvent.type(screen.getByLabelText(/Tên khách hàng/), 'Không lưu được');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/từ chối quyền/);
    expect(gateway.data.deals).toHaveLength(0);
  });
  it('does not subscribe for a non-owner restored account', async () => {
    const gateway = new FakeGateway(emptyData());
    gateway.user = { uid: 'foreign', email: 'foreign@example.com' };
    await mount(gateway);
    expect(gateway.dataListeners.size).toBe(0);
    expect(screen.getByTestId('state')).toHaveTextContent('"authenticated":false');
  });
  it('requires credentials and presents sign-in errors without creating an account', async () => {
    const gateway = new FakeGateway(emptyData());
    gateway.user = null;
    await mount(gateway, <Login />);
    await userEvent.type(screen.getByLabelText('Email'), OWNER_EMAIL);
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(
      screen.getAllByRole('alert').some((node) => node.textContent?.includes('không đúng')),
    ).toBe(true);
    expect(gateway.user).toBeNull();
    expect(gateway.writes).toHaveLength(0);
  });
});
