import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'
import { getKV } from '@/lib/d1'

export const metadata: Metadata = {
  title: 'Otya Player — Offline Music & Video Player for Android',
  description:
    'Otya Player by PeterSmart Link is an offline-first Android music and video player for local media, nearby Send, Private media, playlists, subtitles and practical media tools.',
  keywords: [
    'Otya Player',
    'Otya Player Android',
    'offline music player Android',
    'offline video player Android',
    'local music player Android',
    'local video player Android',
    'Android media player Uganda',
    'PeterSmart Link Otya',
  ],
  alternates: { canonical: 'https://petersmartlink.com/otya-player' },
  openGraph: {
    type: 'website',
    url: 'https://petersmartlink.com/otya-player',
    title: 'Otya Player — Offline Music & Video Player for Android',
    description:
      'Play local music and video offline, send supported media nearby, protect Private media and use practical media tools with Otya Player by PeterSmart Link.',
    images: [
      {
        url: '/otya-mark-current.png',
        width: 1024,
        height: 1024,
        alt: 'Otya Player by PeterSmart Link',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Otya Player — Offline Music & Video Player for Android',
    description: 'Official Otya Player by PeterSmart Link for local Android music and video.',
    images: ['/otya-mark-current.png'],
  },
}

const FEATURES = [
  ['Video', 'Local playback, subtitles, audio tracks, gestures and Picture-in-Picture.'],
  ['Music', 'Local songs, artists, albums, folders, playlists, search and background playback.'],
  ['Send', 'Move supported media directly over nearby Wi-Fi or hotspot without uploading personal media to Otya.'],
  ['Private', 'Keep supported media inside app-private storage behind your device authentication and Private controls.'],
  ['Tools', 'Trim, extract audio and use practical media utilities when you need them.'],
  ['Together', 'Use an optional connected session when you choose to watch with an invited Otya user.'],
]

export default async function OtyaPlayerPage() {
  let appVersion = '1.0.0'
  try {
    const { env } = await getCloudflareContext()
    const raw = await getKV(env as Record<string, unknown>).get('LATEST_BUILD_INFO')
    if (raw) appVersion = (JSON.parse(raw) as { version?: string }).version || appVersion
  } catch {}

  return <div className="min-h-screen flex flex-col otya-ambient" style={{ color: 'var(--cosmos-text-primary)' }}>
    <SiteNav />
    <main className="flex-1 pb-24 md:pb-0">
      <section className="otya-shell py-11 sm:py-18 grid lg:grid-cols-[.9fr_1.1fr] gap-9 lg:gap-14 items-center">
        <div>
          <div className="otya-kicker mb-4">Official Otya Player · Android · v{appVersion} · PeterSmart Link</div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-.06em] leading-[.94]">Otya Player.<br/><span style={{ color: 'var(--cosmos-primary)' }}>Your media. Still yours.</span></h1>
          <p className="mt-5 max-w-xl text-base sm:text-lg otya-muted">Otya Player is an offline-first Android music and video player for the media already on your device. Play local files, send supported media nearby and protect Private media without requiring an account or internet connection for core playback.</p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link href="/download/otya-player" className="cosmos-button rounded-full px-6 py-3.5 text-sm font-extrabold text-center">Download Otya Player</Link>
            <Link href="/help" className="otya-quiet-button rounded-full px-6 py-3.5 text-sm font-bold text-center">Help & support</Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs otya-muted"><span>Offline-first</span><span>Local music & video</span><span>Nearby Send</span><span>Sign-in optional</span></div>
        </div>
        <Image src="/brand/otya-app-preview.svg" alt="Otya Player Android interface showing Video, Music and Me" width={1200} height={820} priority className="w-full h-auto rounded-[30px] drop-shadow-2xl" />
      </section>

      <section className="border-y" style={{ borderColor: 'var(--cosmos-divider)', background: 'linear-gradient(120deg,color-mix(in srgb,var(--cosmos-primary) 7%,var(--cosmos-surface)),color-mix(in srgb,var(--cosmos-cyan) 6%,var(--cosmos-surface)))' }}>
        <div className="otya-shell py-10 sm:py-14">
          <div className="max-w-2xl mb-6"><div className="otya-kicker mb-2">One structure</div><h2 className="text-2xl sm:text-3xl font-extrabold">Video. Music. Me.</h2><p className="mt-2 text-sm otya-muted">Three predictable places. Advanced actions appear in context instead of becoming more home screens.</p></div>
          <div className="grid md:grid-cols-3 gap-3">
            <CoreCard title="Video" text="Your videos, folders, recent media and full player controls." />
            <CoreCard title="Music" text="Your local songs, artists, albums, playlists and now-playing experience." />
            <CoreCard title="Me" text="Send, Files, Private, account and settings in one personal area." />
          </div>
        </div>
      </section>

      <section className="otya-shell py-10 sm:py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map(([title,text]) => <div key={title} className="modern-card p-5"><h3 className="font-extrabold">{title}</h3><p className="mt-2 text-sm leading-relaxed otya-muted">{text}</p></div>)}
        </div>
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t pt-6" style={{ borderColor: 'var(--cosmos-divider)' }}>
          <div><div className="font-extrabold">The internet is an enhancement, not a requirement.</div><div className="mt-1 text-sm otya-muted">Local playback, library access and nearby sending remain at the center of Otya Player.</div></div>
          <Link href="/download/otya-player" className="cosmos-button rounded-full px-6 py-3 text-sm font-extrabold text-center shrink-0">Download Otya Player v{appVersion}</Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}

function CoreCard({ title, text }: { title: string; text: string }) {
  return <div className="modern-card p-5"><h3 className="text-xl font-extrabold">{title}</h3><p className="mt-2 text-sm leading-relaxed otya-muted">{text}</p></div>
}
