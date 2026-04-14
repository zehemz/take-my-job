import { redirect } from 'next/navigation';
import { devAuth } from '@/lib/dev-auth';
import AccessPageClient from './_components/AccessPageClient';

export const dynamic = 'force-dynamic';

export default async function AccessPage() {
  const session = await devAuth();
  if (!session) redirect('/login');
  if (!session.user.isAdmin) redirect('/');

  return <AccessPageClient />;
}
