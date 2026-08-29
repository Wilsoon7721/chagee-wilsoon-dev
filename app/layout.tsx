import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

export const metadata: Metadata = {
  title: {
    default: 'CHAGEE Tool | Wilson Oon',
    template: '%s | CHAGEE Tool | Wilson Oon'
  },
  description: 'Crowdsourcing CHAGEE Singapore QR code payloads to map drink SKUs and get the sweetness formula'
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <header className="relative z-10 flex w-full flex-col items-start justify-between gap-1 px-6 py-4 pointer-events-none sm:absolute sm:left-0 sm:top-0 sm:flex-row sm:items-center sm:gap-0 sm:px-8 sm:py-5 md:pl-24 md:pr-12">
          <div className="pointer-events-auto select-none text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400 dark:text-white/30">wilsoon.dev</div>
          <div className="pointer-events-auto select-none text-[10px] tracking-wider text-zinc-400 dark:text-white/20">CHAGEE QR Code Analysis</div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-zinc-200 py-6 dark:border-zinc-800">
          <div className="flex flex-col items-center justify-center gap-3">
            <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">This is a community research project, and is not affiliated with CHAGEE.</p>
            <div className="flex items-center justify-center gap-3 text-xs text-zinc-400 dark:text-zinc-600">
              <a href="https://github.com/Wilsoon7721/chagee-wilsoon-dev" target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors">
                Source Code
              </a>
              <span>&middot;</span>
              <a href="https://reddit.com/u/Java7421" target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors">
                Contact (Reddit)
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
