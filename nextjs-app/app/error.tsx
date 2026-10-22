'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>Không thể mở màn hình này</h1>
      <p>Thử tải lại màn hình. Dữ liệu mẫu đã lưu vẫn nằm trong trình duyệt.</p>
      <button className="btn btn-primary" onClick={reset}>
        Thử lại
      </button>
    </main>
  );
}
