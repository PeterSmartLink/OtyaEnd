import { NextResponse } from 'next/server'

// Sample posts are intentionally not seeded in production.
// PeterSmart Journal articles are created only through the protected /api/blog publishing API.
export async function POST() {
  return NextResponse.json({ error: 'Sample article seeding is disabled.' }, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  })
}
