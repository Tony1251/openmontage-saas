import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const isMock = process.env.MOCK_MODE === 'true';

  const payload = await req.text();
  const hdrs = await headers();
  const svixId = hdrs.get('svix-id') ?? '';
  const svixTs = hdrs.get('svix-timestamp') ?? '';
  const svixSig = hdrs.get('svix-signature') ?? '';

  if (!isMock && (!svixId || !svixTs || !svixSig)) {
    return new NextResponse('missing svix headers', { status: 400 });
  }

  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!isMock && !secret) {
    return new NextResponse('webhook secret not set', { status: 500 });
  }

  if (isMock && !secret) {
    const event = JSON.parse(payload);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    await fetch(`${apiUrl}/v1/users/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerk_user_id: event.data?.id,
        email: event.data?.email_addresses?.[0]?.email_address,
      }),
    });
    return NextResponse.json({ ok: true });
  }

  const { Webhook } = await import('svix');
  const wh = new Webhook(secret!);
  try {
    wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTs,
      'svix-signature': svixSig,
    });
  } catch {
    return new NextResponse('invalid signature', { status: 400 });
  }

  const event = JSON.parse(payload);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  await fetch(`${apiUrl}/v1/users/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clerk_user_id: event.data?.id,
      email: event.data?.email_addresses?.[0]?.email_address,
    }),
  });

  return NextResponse.json({ ok: true });
}
