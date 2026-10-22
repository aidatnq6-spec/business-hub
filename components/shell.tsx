'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useHub } from './hub-provider';
import { searchData, dueLabel, isDone } from '@/lib/domain';
import { COLLECTION_LABELS } from '@/lib/types';
import { BackupDialog } from './backup-dialog';
import { Modal, Empty, Button } from './ui';
import { TelegramPreview } from './telegram-preview';
const nav = [
  ['/', '🏠', 'Tổng quan'],
  ['/sale', '💼', 'Sale Pipeline'],
  ['/accounting', '💰', 'Kế toán'],
  ['/debts', '📋', 'Công nợ'],
  ['/operations', '⚙️', 'Vận hành'],
  ['/reports', '📊', 'Báo cáo'],
] as const;
export function HubShell({ children }: { children: ReactNode }) {
  const hub = useHub();
  const path = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState('--:--');
  const [dialog, setDialog] = useState<'backup' | 'reminders' | 'telegram' | null>(null);
  useEffect(() => {
    if (hub.authReady && !hub.authenticated) router.replace('/login');
  }, [hub.authReady, hub.authenticated, router]);
  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date()),
      );
    const t = setInterval(tick, 1000);
    queueMicrotask(tick);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('hub-search')?.focus();
      }
      if (e.key === 'Escape') setQuery('');
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (e.target instanceof Node && !searchRef.current?.contains(e.target)) {
        setQuery('');
        setSearchIndex(-1);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  if (hub.syncError)
    return (
      <div className="loading-screen">
        <div role="alert">
          <p>{hub.syncError}</p>
          <Button onClick={hub.retry}>Thử lại</Button>{' '}
          <Button secondary onClick={() => hub.signOut()}>
            Đăng xuất
          </Button>
        </div>
      </div>
    );
  if (!hub.ready || !hub.authenticated)
    return (
      <div className="loading-screen" role="status">
        Đang tải dữ liệu Firebase…
      </div>
    );
  const results = searchData(hub.data, query);
  return (
    <div id="app-screen" className="next-app">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <header className="topbar">
        <Link href="/" className="tb-brand" aria-label="Business Hub — Tổng quan">
          <span className="tb-logo">💼</span>
          <span className="tb-title">Business Hub</span>
        </Link>
        <div className="tb-search" ref={searchRef}>
          <label className="sr-only" htmlFor="hub-search">
            Tìm kiếm toàn bộ
          </label>
          <input
            id="hub-search"
            role="combobox"
            aria-expanded={!!query}
            aria-controls="hub-search-results"
            aria-activedescendant={searchIndex >= 0 ? `hub-result-${searchIndex}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchIndex(-1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSearchIndex((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSearchIndex((i) => Math.max(0, i - 1));
              }
              if (e.key === 'Enter' && results[searchIndex]) {
                router.push(results[searchIndex].route);
                setQuery('');
                setSearchIndex(-1);
              }
            }}
            placeholder="🔍 Tìm kiếm toàn bộ… (Ctrl+K)"
            autoComplete="off"
          />
          {query && (
            <div
              className="search-results"
              id="hub-search-results"
              role="listbox"
              aria-label="Kết quả tìm kiếm"
            >
              {results.length ? (
                results.map((r, i) => (
                  <Link
                    role="option"
                    id={`hub-result-${i}`}
                    aria-selected={i === searchIndex}
                    key={r.collection + r.id}
                    href={r.route}
                    onClick={() => setQuery('')}
                  >
                    <strong>{r.title}</strong>
                    <small>{COLLECTION_LABELS[r.collection]}</small>
                  </Link>
                ))
              ) : (
                <Empty>Không tìm thấy “{query}”.</Empty>
              )}
            </div>
          )}
        </div>
        <div className="tb-right">
          <span className="demo-badge" title={hub.user?.email ?? ''} role="status">
            {hub.busy
              ? 'Đang lưu Firebase…'
              : hub.syncStatus === 'live'
                ? 'Firebase · Đã đồng bộ'
                : 'Firebase · Mất kết nối'}
          </span>
          <div id="clock">{clock}</div>
          <Link className="logout-btn" href="/settings">
            ⚙️ AI
          </Link>
          <button className="logout-btn" onClick={() => setDialog('backup')}>
            💾 Backup
          </button>
          <button
            className="logout-btn"
            aria-label="Trung tâm nhắc nhở"
            onClick={() => setDialog('reminders')}
          >
            🔔
          </button>
          <button
            className="logout-btn"
            onClick={async () => {
              if (await hub.signOut()) router.push('/login');
            }}
          >
            Đăng xuất
          </button>
        </div>
      </header>
      <div className="app-body">
        <nav className="side-nav" aria-label="Điều hướng chính">
          {nav.map(([href, icon, label]) => (
            <Link
              href={href}
              key={href}
              className={'nav-item ' + (path === href ? 'active' : '')}
              aria-current={path === href ? 'page' : undefined}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </Link>
          ))}
          <div className="side-footer">
            <p>Bản dùng thử Next.js</p>
            <small>Dữ liệu lưu trên trình duyệt này.</small>
            <button onClick={() => setDialog('telegram')}>📨 Xem báo cáo 07:00</button>
            <Link href="/settings">Cài đặt</Link>
          </div>
        </nav>
        <main id="main-content" className="tab-page active" tabIndex={-1}>
          {children}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng điện thoại">
        {nav.map(([href, icon, label]) => (
          <Link
            href={href}
            key={href}
            className={'nav-item ' + (path === href ? 'active' : '')}
            aria-current={path === href ? 'page' : undefined}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </Link>
        ))}
      </nav>
      {hub.notice && (
        <div className="hub-toast" role="status">
          {hub.notice}
          {hub.canUndo && <button onClick={hub.undo}>Hoàn tác</button>}
          <button aria-label="Đóng thông báo" onClick={() => hub.notify('')}>
            ✕
          </button>
        </div>
      )}
      {dialog === 'backup' && <BackupDialog onClose={() => setDialog(null)} />}{' '}
      {dialog === 'telegram' && <TelegramPreview onClose={() => setDialog(null)} />}{' '}
      {dialog === 'reminders' && (
        <Modal title="🔔 Trung tâm nhắc nhở" onClose={() => setDialog(null)}>
          <div className="stack">
            {hub.data.todos
              .filter((t) => !isDone(t))
              .map((t) => (
                <Link
                  key={t.id}
                  className="reminder-row"
                  href="/operations"
                  onClick={() => setDialog(null)}
                >
                  <strong>{t.text}</strong>
                  <span>{dueLabel(t.dueDate)}</span>
                </Link>
              ))}
          </div>
          <div className="modal-actions">
            <Button
              onClick={() => {
                hub.runRecurring();
              }}
            >
              🔄 Làm mới
            </Button>
            <Button secondary onClick={() => setDialog('telegram')}>
              📨 Xem báo cáo Telegram
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
