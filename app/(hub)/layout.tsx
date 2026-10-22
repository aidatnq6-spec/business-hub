import { HubShell } from '@/components/shell';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <HubShell>{children}</HubShell>;
}
