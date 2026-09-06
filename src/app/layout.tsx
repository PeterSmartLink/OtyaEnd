import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Manrope } from 'next/font/google'
import ThemeControl from './ThemeControl'
import './globals.css'
import './brand-overrides.css'

const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-otya' })
const SITE_URL = 'https://petersmartlink.com'
const APP_VERSION = '1.0.0'
const ADSENSE_ID = 'ca-pub-2517163652161686'
const OTYA_MARK = '/otya-mark-current.png'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Otya Player — Offline Music & Video Player for Android | PeterSmart Link',
    template: '%s | PeterSmart Link',
  },
  description:
    'Otya Player by PeterSmart Link is an offline-first Android music and video player for local media, nearby Send, Private media and practical media tools.',
  keywords: [
    'Otya Player',
    'Otya Player Android',
    'PeterSmart Link',
    'offline music player',
    'offline video player',
    'local music player Android',
    'local video player Android',
    'file transfer Android',
    'private media Android',
    'Uganda technology',
  ],
  authors: [{ name: 'PeterSmart Link', url: SITE_URL }],
  creator: 'PeterSmart Link',
  publisher: 'PeterSmart Link',
  applicationName: 'Otya Player',
  category: 'multimedia',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_UG',
    url: SITE_URL,
    siteName: 'PeterSmart Link',
    title: 'Otya Player — Offline Music & Video Player for Android',
    description:
      'Official Otya Player by PeterSmart Link for local Android music and video, offline playback, nearby Send and Private media.',
    images: [
      {
        url: OTYA_MARK,
        width: 1024,
        height: 1024,
        alt: 'Otya Player by PeterSmart Link',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Otya Player — Offline Music & Video Player for Android',
    description: 'Official Otya Player by PeterSmart Link for local Android media.',
    images: [OTYA_MARK],
  },
  icons: {
    icon: [{ url: OTYA_MARK, sizes: '1024x1024', type: 'image/png' }],
    apple: [{ url: OTYA_MARK, sizes: '1024x1024', type: 'image/png' }],
    shortcut: OTYA_MARK,
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Otya Player', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5FAFF' },
    { media: '(prefers-color-scheme: dark)', color: '#050812' },
  ],
  width: 'device-width', initialScale: 1, maximumScale: 5,
}

const schemaOrg = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'PeterSmart Link',
      url: SITE_URL,
      logo: `${SITE_URL}${OTYA_MARK}`,
      email: 'support@petersmartlink.com',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#otya-player`,
      name: 'Otya Player',
      alternateName: 'Otya',
      identifier: 'com.otyaplayer.app',
      operatingSystem: 'Android',
      applicationCategory: 'MultimediaApplication',
      softwareVersion: APP_VERSION,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      url: `${SITE_URL}/otya-player`,
      downloadUrl: `${SITE_URL}/download/otya-player`,
      author: { '@id': `${SITE_URL}/#organization` },
      publisher: { '@id': `${SITE_URL}/#organization` },
      description:
        'Offline-first Android music and video player for local media, nearby Send, Private media, playlists, subtitles and practical media tools.',
      image: `${SITE_URL}${OTYA_MARK}`,
      featureList: [
        'Local music playback',
        'Local video playback',
        'Background audio',
        'Playlists',
        'Subtitles',
        'Picture-in-Picture',
        'Nearby media sending',
        'Private media',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'PeterSmart Link',
      alternateName: 'Otya Player',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

const initialThemeScript = `try {
  var migrated = localStorage.getItem('otya_theme_device_v3');
  if (!migrated) {
    localStorage.setItem('otya_theme', 'system');
    localStorage.setItem('otya_theme_device_v3', '1');
  }
  var t = localStorage.getItem('otya_theme') || 'system';
  if (t === 'light' || t === 'dark') {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = 'light dark';
  }
} catch (e) {}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" dir="ltr" className={manrope.variable} suppressHydrationWarning>
    <head>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }} />
      <meta name="google-adsense-account" content={ADSENSE_ID} />
      <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
    </head>
    <body className={manrope.className}>
      {children}
      <ThemeControl />
      <Script id="google-adsense" async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`} crossOrigin="anonymous" strategy="afterInteractive" />
    </body>
  </html>
}
