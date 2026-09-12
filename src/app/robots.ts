import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/account',
          '/my-account',
          '/sign-in',
          '/telegram',
          '/auth/',
          '/apk/',
          '/apps/played',
          '/apps/otya-player/changelog',
        ],
      },
    ],
    sitemap: 'https://petersmartlink.com/sitemap.xml',
  }
}
