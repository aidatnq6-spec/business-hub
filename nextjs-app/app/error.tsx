'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>Không thể mở màn hình này</h1>
      <p>
        Thử tải lại màn hình. Các thay đổi đã được Firebase xác nhận vẫn được lưu trên tài khoản của
        bạn.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Thử lại
      </button>
    </main>
  );
}
