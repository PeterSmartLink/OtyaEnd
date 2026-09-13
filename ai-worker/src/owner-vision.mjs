const DEFAULT_VISION_MODEL = '@cf/moondream/moondream3.1-9B-A2B'
const MAX_IMAGE_DATA_URI_CHARS = 5_700_000
const IMAGE_PREFIXES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
  'data:image/webp;base64,',
]

const clean = (value, max = 5000) => String(value ?? '')
  .replace(/[\u0000-\u001f]/g, ' ')
  .trim()
  .slice(0, max)

export function isOwnerImageContext(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && clean(value.kind, 40) === 'local_image'
}

function validatedImageContext(value) {
  if (!isOwnerImageContext(value)) return null
  const image = String(value.text ?? '').trim()
  if (!image || image.length > MAX_IMAGE_DATA_URI_CHARS) return null
  if (!IMAGE_PREFIXES.some(prefix => image.startsWith(prefix))) return null
  return {
    image,
    title: clean(value.title, 240),
    source: clean(value.source, 800),
  }
}

export async function analyzeOwnerWorkspaceImage(env, message, value) {
  const context = validatedImageContext(value)
  if (!context) throw new TypeError('Invalid owner image context')
  if (!env?.AI?.run) throw new Error('AI binding unavailable')

  const question = clean(message, 1800)
    || 'Describe what is important in this image for the OTYA owner.'
  const result = await env.AI.run(
    env.OTYA_VISION_MODEL || DEFAULT_VISION_MODEL,
    {
      task: 'query',
      image: context.image,
      question,
      reasoning: false,
      temperature: 0.1,
      max_tokens: 1200,
      stream: false,
    },
  )
  const answer = clean(result?.answer, 12000)
  if (!answer) throw new Error('Vision model returned no answer')
  return {
    answer,
    title: context.title,
    source: context.source,
  }
}
