import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentor Tree',
  description: 'AI-powered goal decomposition',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  );
}
