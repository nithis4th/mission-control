import type { Metadata } from 'next';
import './globals.css';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import DemoBanner from '@/components/DemoBanner';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mission Control',
  description: 'AI Agent Orchestration Dashboard',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${plusJakarta.variable}`}>
      <body className={`${plusJakarta.className} bg-mc-bg text-mc-text text-lg h-screen overflow-hidden scanline-overlay`}>
        <DemoBanner />
        <div className="h-full overflow-hidden">{children}</div>
      </body>
    </html>
  );
}
