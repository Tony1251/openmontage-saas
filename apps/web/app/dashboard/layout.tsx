import Link from 'next/link';
import { LayoutDashboard, Film, Key, CreditCard } from 'lucide-react';

const isMock = process.env.MOCK_MODE === 'true';

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/renders', label: 'Renders', icon: Film },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: Key },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r bg-muted/30">
        <div className="p-4">
          <Link href="/" className="text-lg font-bold">OpenMontage</Link>
        </div>
        <nav className="space-y-1 px-2">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent">
              <item.icon className="h-4 w-4" />{item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4">
          {isMock ? (
            <div className="rounded-md bg-yellow-500/20 px-3 py-2 text-xs text-yellow-700">MOCK MODE</div>
          ) : (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">User</div>
          )}
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
