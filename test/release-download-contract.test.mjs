import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('generic release downloads never silently select ARM64', () => {
  const latest = read('src/app/latest/route.ts')
  const workflow = read('src/release-workflow.mjs')
  const downloadPage = read('src/app/download/otya-player/DownloadButtons.tsx')

  assert.match(latest, /const DOWNLOAD_PAGE = 'https:\/\/petersmartlink\.com\/download\/otya-player'/)
  assert.match(latest, /auto:\s+DOWNLOAD_PAGE/)
  assert.doesNotMatch(latest, /auto:\s+ARM64_APK/)

  assert.match(workflow, /auto: `\$\{release\.workerUrl\}\/download\/otya-player`/)
  assert.match(workflow, /arm64: `\$\{release\.workerUrl\}\/apk\/arm64`/)
  assert.match(workflow, /arm32: `\$\{release\.workerUrl\}\/apk\/arm32`/)

  assert.match(downloadPage, /return \{isAndroid:true,abi:'unknown'\}/)
  assert.match(downloadPage, /Choose your Android build/)
  assert.match(downloadPage, /Otya Player will not guess/)
  assert.match(downloadPage, /download\('arm64'\)/)
  assert.match(downloadPage, /download\('arm32'\)/)
  assert.doesNotMatch(downloadPage, /\/android\/i\.test\(ua\) \? 'arm64' : 'unknown'/)
})

test('release workflow binds immutable build tag to public version and Android version code', () => {
  const workflow = read('src/release-workflow.mjs')

  assert.match(workflow, /const TAG_RE = \/\^v\\d\+\\\.\\d\+\\\.\\d\+\\\+\[1-9\]\\d\*\$\//)
  assert.match(workflow, /const tagVersion = tagIdentity\.slice\(0, separator\)/)
  assert.match(workflow, /const tagBuild = Number\(tagIdentity\.slice\(separator \+ 1\)\)/)
  assert.match(workflow, /tagVersion !== version/)
  assert.match(workflow, /tagBuild !== versionCode/)
  assert.match(workflow, /tag build and versionCode do not match/)
  assert.doesNotMatch(workflow, /tag !== `v\$\{version\}`/)
})

test('exact build downloads use immutable tag paths while legacy version links remain compatible', () => {
  const route = read('src/app/apk/[file]/route.ts')

  assert.match(route, /const BUILD_TAG_RE = \/\^v\\d\+\\\.\\d\+\\\.\\d\+\\\+\[1-9\]\\d\*\$\//)
  assert.match(route, /searchParams\.get\('tag'\)/)
  assert.match(route, /searchParams\.get\('v'\)/)
  assert.match(route, /Choose either tag or version, not both/)
  assert.match(route, /key = `releases\/\$\{tag\}\/Otya-\$\{file\}\.apk`/)
  assert.match(route, /key = `releases\/v\$\{version\}\/Otya-\$\{file\}\.apk`/)
})

test('release metadata uses the same latest aliases and preserves exact APK URLs', () => {
  const workflow = read('src/release-workflow.mjs')

  assert.match(workflow, /tag: release\.tag/)
  assert.match(workflow, /arm64: 'Otya-arm64\.apk'/)
  assert.match(workflow, /arm32: 'Otya-arm32\.apk'/)
  assert.match(workflow, /exactArm64: immutableApkUrl\(release\.workerUrl, 'arm64', release\.tag\)/)
  assert.match(workflow, /exactArm32: immutableApkUrl\(release\.workerUrl, 'arm32', release\.tag\)/)
  assert.match(workflow, /immutableApkUrl\(release\.workerUrl, 'arm64', release\.tag\)/)
  assert.doesNotMatch(workflow, /OtyaPlayer-arm64\.apk/)
  assert.doesNotMatch(workflow, /OtyaPlayer-arm32\.apk/)
})

test('a different release tag cannot reuse or decrease the Android version code', () => {
  const workflow = read('src/release-workflow.mjs')
  assert.match(workflow, /latest\.tag !== release\.tag/)
  assert.match(workflow, /Number\(latest\.version_code\) >= release\.versionCode/)
  assert.match(workflow, /Refusing non-monotonic version code/)
})

test('optional reporting cannot turn an already-published release into a false failure', () => {
  const workflow = read('src/release-workflow.mjs')
  assert.match(workflow, /Completion report failed/)
  assert.match(workflow, /Analytics write failed/)
  assert.match(workflow, /Push notification queue failed/)
  assert.match(workflow, /return \{ sent: false, error:/)
  assert.match(workflow, /return \{ written: false, error:/)
  assert.match(workflow, /queued: false,[\s\S]*?duplicate: false,[\s\S]*?error:/)
})
