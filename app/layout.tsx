import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/Header';
import { SiteFooter } from '@/components/Footer';
import { ThemeProvider } from '@/components/ThemeProvider';
import { CoinRain } from '@/components/CoinRain';
import { PwaRegister } from '@/components/PwaRegister';
import { AiBot } from '@/components/AiBot';

export const metadata: Metadata = {
  title: 'Quasar — Demo Crypto Exchange',
  description: 'Quasar is a paper-trading demo crypto exchange. Live market data, zero real money.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Quasar' },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-void text-slate-200 antialiased min-h-screen flex flex-col">
        <PwaRegister />
        <ThemeProvider>
          <CoinRain />
          <div className="relative z-10 flex flex-col min-h-screen">
            <SiteHeader />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
            <SiteFooter />
          </div>
          <AiBot />
        </ThemeProvider>
      </body>
    </html>
  );
}
