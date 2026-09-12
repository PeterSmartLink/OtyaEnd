import type { MetadataRoute } from 'next'

const BASE = 'https://petersmartlink.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                           changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/company`,              changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/apps`,                 changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/otya-player`,          changeFrequency: 'weekly',  priority: 0.95 },
    { url: `${BASE}/music`,                changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/ask`,                  changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE}/download/otya-player`, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE}/official`,             changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/press`,                changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/help`,                 changeFrequency: 'monthly', priority: 0.65 },
    { url: `${BASE}/contact`,              changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy`,              changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${BASE}/terms`,                changeFrequency: 'yearly',  priority: 0.4 },
  ]
}
