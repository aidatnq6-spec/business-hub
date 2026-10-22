'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useHub } from '@/components/hub-provider';
export default function Login() {
  const hub = useHub();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (hub.authReady && hub.authenticated) router.replace('/');
  }, [hub.authReady, hub.authenticated, router]);
  return (
    <div id="auth-screen">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          try {
            if (await hub.signIn(email, password)) {
              setPassword('');
              router.push('/');
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="auth-logo-icon">💼</div>
        <h1 className="auth-title">Business Hub</h1>
        <p className="auth-sub">Công Ty 1 Người</p>
        <p className="demo-note">
          Đăng nhập tài khoản Business Hub hiện tại để đồng bộ dữ liệu Firebase.
        </p>
        <div className="auth-field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="auth-password">Mật khẩu</label>
          <input
            id="auth-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        {hub.syncError && (
          <p className="form-error" role="alert">
            {hub.syncError}
          </p>
        )}
        <button
          className="auth-btn auth-btn-primary"
          type="submit"
          disabled={!hub.authReady || submitting}
        >
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        <p className="muted">
          Dùng tài khoản đã đăng nhập ở bản cũ. Dữ liệu được đọc theo tài khoản; không tạo dữ liệu
          mẫu.
        </p>
      </form>
    </div>
  );
}
