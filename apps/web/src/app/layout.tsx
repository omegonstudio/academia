import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { site } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  // Makes every relative canonical/Open Graph URL resolve against the real origin.
  metadataBase: new URL(site.url),
  title: {
    default: site.name,
    template: `%s | ${site.shortName}`,
  },
  description: site.description,
  applicationName: site.shortName,
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: site.locale,
    title: site.name,
    description: site.description,
    url: '/',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `lang` drives screen-reader pronunciation and is required (WCAG 3.1.1).
    <html lang="es">
      <body className="flex min-h-screen flex-col">
        {/*
          First focusable element on the page: lets keyboard users jump past the
          navigation straight to the content (WCAG 2.4.1). Visible only on focus.
        */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand"
        >
          Saltar al contenido principal
        </a>

        <SiteHeader />

        <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
