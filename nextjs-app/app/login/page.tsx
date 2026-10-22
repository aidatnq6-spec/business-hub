'use client';
import { useRouter } from 'next/navigation';
import { useHub } from '@/components/demo-provider';
export default function Login() {
  const hub = useHub();
  const router = useRouter();
  return (
    <div id="auth-screen">
      <form
        className="auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          hub.signIn();
          router.push('/');
        }}
      >
        <div className="auth-logo-icon">💼</div>
        <h1 className="auth-title">Business Hub</h1>
        <p className="auth-sub">Công Ty 1 Người</p>
        <p className="demo-note">
          Bản dùng thử với dữ liệu mẫu. Không kết nối tài khoản Firebase thật.
        </p>
        <div className="auth-field">
          <label htmlFor="demo-email">Email mẫu</label>
          <input id="demo-email" type="email" defaultValue="demo@business-hub.test" required />
        </div>
        <button className="auth-btn auth-btn-primary" type="submit" disabled={!hub.ready}>
          Vào bản dùng thử
        </button>
        <p className="muted">
          Không cần mật khẩu thật. Các thay đổi chỉ lưu trong trình duyệt này.
        </p>
      </form>
    </div>
  );
}
