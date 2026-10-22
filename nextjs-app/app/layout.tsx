import type { Metadata } from 'next';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import './globals.css';
import './next.css';
import { DemoProvider } from '@/components/demo-provider';
export const metadata: Metadata = {
  title: 'Business Hub — Công Ty 1 Người',
  description: 'Business Hub Next.js — bản dùng thử với dữ liệu mẫu',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      {/* Browser extensions may add body attributes before React hydrates. */}
      <body suppressHydrationWarning>
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
