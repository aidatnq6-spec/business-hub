import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="loading-screen">
      <h1>Không tìm thấy trang</h1>
      <Link href="/">Về tổng quan</Link>
    </main>
  );
}
