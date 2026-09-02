import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mesa-quince.sjjs0805.chatgpt.site'),
  title: 'Mesa Quince — Cuban Domino Trainer',
  description: 'Practice three-player Cuban double-nine dominoes with move-by-move coaching.',
  openGraph: {
    title: 'Mesa Quince — Cuban Domino Trainer',
    description: 'Practice three-player Cuban double-nine dominoes with move-by-move coaching.',
    type: 'website',
    images: [{
      url: 'https://mesa-quince.sjjs0805.chatgpt.site/og.png',
      width: 1200,
      height: 630,
      alt: 'Mesa Quince Cuban Domino Trainer',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mesa Quince — Cuban Domino Trainer',
    description: 'Practice three-player Cuban double-nine dominoes with move-by-move coaching.',
    images: ['https://mesa-quince.sjjs0805.chatgpt.site/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
