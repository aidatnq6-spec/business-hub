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
import { HubProvider } from '@/components/hub-provider';
export const metadata: Metadata = {
  title: 'Business Hub — Công Ty 1 Người',
  description: 'Business Hub — quản lý kinh doanh và đồng bộ Firebase',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      {/* Browser extensions may add body attributes before React hydrates. */}
      <body suppressHydrationWarning>
        <HubProvider>{children}</HubProvider>
      </body>
    </html>
  );
}
