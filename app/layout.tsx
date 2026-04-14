import type { Metadata } from 'next';
import './globals.css';
import AuthSessionProvider from '@/app/_components/session-provider';

export const metadata: Metadata = {
  title: 'Kobani',
  description: 'Kanban-driven agent orchestration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 min-h-screen flex flex-col">
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
