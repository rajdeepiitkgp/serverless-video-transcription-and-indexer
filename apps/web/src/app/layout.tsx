import './globals.css';

import { type Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { type ReactNode } from 'react';

import { AppFooter } from '@/components/layout/app-footer';
import { AppHeader } from '@/components/layout/app-header';
import { ThemeProvider } from '@/components/theme/theme-provider';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: { default: 'Signal', template: '%s · Signal' },
  description: 'Serverless video transcription and indexing console.',
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    // suppressHydrationWarning: next-themes stamps the theme class before hydration.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-accent-solid focus:px-3 focus:py-1.5 focus:text-sm focus:text-accent-solid-fg"
          >
            Skip to content
          </a>
          <AppHeader />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
            {children}
          </main>
          <AppFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
