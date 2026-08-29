import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditBalance } from '@/components/credit-balance';
import Link from 'next/link';

const isMock = process.env.MOCK_MODE === 'true';

export default async function DashboardPage() {
  if (!isMock) {
    try {
      const { auth } = await import('@clerk/nextjs/server');
      const { userId } = await auth();
      if (!userId) redirect('/sign-in');
    } catch {
      redirect('/sign-in');
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Overview</h1>
      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Credit balance</CardTitle></CardHeader>
          <CardContent><CreditBalance /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent renders</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">0</div><p className="text-sm text-muted-foreground">Last 7 days</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>API keys</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">0</div><Link href="/dashboard/api-keys" className="text-sm text-primary">Create one →</Link></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Get started</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Generate your first video with the API or via the dashboard.</p>
          <Link href="/dashboard/renders"><Button>Create a render</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
