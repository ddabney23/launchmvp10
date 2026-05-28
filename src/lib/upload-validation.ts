const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const PDF_MIMES = new Set(['application/pdf'])

const BUCKET_RULES: Record<
  string,
  { mimes: Set<string>; extensions: Set<string> }
> = {
  avatars: { mimes: IMAGE_MIMES, extensions: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']) },
  posts: { mimes: IMAGE_MIMES, extensions: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']) },
  listings: { mimes: IMAGE_MIMES, extensions: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']) },
  stories: {
    mimes: new Set([...IMAGE_MIMES, ...VIDEO_MIMES]),
    extensions: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov']),
  },
  'store-banners': { mimes: IMAGE_MIMES, extensions: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']) },
  'vendor-assets': { mimes: IMAGE_MIMES, extensions: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']) },
  'vendor-docs': {
    mimes: new Set([...IMAGE_MIMES, ...PDF_MIMES]),
    extensions: new Set(['jpg', 'jpeg', 'png', 'pdf']),
  },
}

export function validateUploadFile(
  bucket: string,
  file: File
): { ok: true } | { ok: false; message: string } {
  const rules = BUCKET_RULES[bucket]
  if (!rules) {
    return { ok: false, message: 'Invalid bucket' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!rules.extensions.has(ext)) {
    return { ok: false, message: `File type .${ext} is not allowed for bucket ${bucket}` }
  }

  if (!rules.mimes.has(file.type)) {
    return { ok: false, message: `MIME type ${file.type} is not allowed for bucket ${bucket}` }
  }

  return { ok: true }
}
