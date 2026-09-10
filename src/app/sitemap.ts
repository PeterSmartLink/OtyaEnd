import type { MetadataRoute } from 'next'

const BASE = 'https://petersmartlink.com'
const NOW = new Date()

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                           lastModified: NOW, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/otya-player`,          lastModified: NOW, changeFrequency: 'weekly',  priority: 0.95 },
    { url: `${BASE}/music`,                lastModified: NOW, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/ask`,                  lastModified: NOW, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE}/download/otya-player`, lastModified: NOW, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE}/official`,             lastModified: NOW, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/help`,                 lastModified: NOW, changeFrequency: 'monthly', priority: 0.65 },
    { url: `${BASE}/contact`,              lastModified: NOW, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy`,              lastModified: NOW, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${BASE}/terms`,                lastModified: NOW, changeFrequency: 'yearly',  priority: 0.4 },
  ]
}
