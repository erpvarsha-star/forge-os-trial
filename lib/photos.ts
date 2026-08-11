import { supabase } from './supabase'

/**
 * Photo upload for 5S submissions and maintenance observations.
 *
 * Files land in the private `submission-photos` bucket created by
 * scripts/PATCH_13_photo_storage_11Aug2026.sql, under the path shape
 *
 *     <employee_id>/<kind>/<timestamp>-<random>.jpg
 *
 * The leading employee_id segment is load-bearing: the storage RLS policy
 * checks `(storage.foldername(name))[1] = current_employee_id()` on insert, so
 * changing this shape without changing PATCH_13 breaks every upload.
 */

export type PhotoKind = '5s' | 'obs'

const BUCKET = 'submission-photos'

/**
 * Decodes base64 to bytes without pulling in a dependency.
 *
 * React Native has no `atob`, no `Buffer`, and no `Blob` that Supabase's
 * storage client can read from, so the usual browser/node paths are all
 * unavailable. The alternative was adding `expo-file-system` or a base64
 * package — this project has a documented history of dependency bumps
 * silently breaking the build (see CLAUDE.md: nativewind/reanimated,
 * expo-linking), so 20 lines of arithmetic is the safer trade.
 */
function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  // Strip any data-URI prefix and padding before decoding.
  const clean = base64.replace(/^data:[^,]+,/, '').replace(/=+$/, '')

  const bytes = new Uint8Array((clean.length * 3) / 4 | 0)
  let byteIndex = 0
  let buffer = 0
  let bitsCollected = 0

  for (let i = 0; i < clean.length; i++) {
    const value = chars.indexOf(clean[i])
    if (value === -1) continue // ignore newlines/whitespace
    buffer = (buffer << 6) | value
    bitsCollected += 6
    if (bitsCollected >= 8) {
      bitsCollected -= 8
      bytes[byteIndex++] = (buffer >> bitsCollected) & 0xff
    }
  }

  // The computed length can overshoot by a byte when padding was stripped.
  return byteIndex === bytes.length ? bytes : bytes.subarray(0, byteIndex)
}

export interface UploadResult {
  path: string | null
  error: string | null
}

/**
 * Uploads a captured photo and returns its storage path (NOT a URL).
 *
 * The path is what gets written to `photo_url`. The bucket is private, so
 * readers resolve it through `getSignedPhotoUrl` at display time rather than
 * storing a URL that would expire.
 */
export async function uploadSubmissionPhoto(
  employeeId: string,
  base64: string,
  kind: PhotoKind
): Promise<UploadResult> {
  try {
    const bytes = base64ToBytes(base64)
    if (bytes.length === 0) return { path: null, error: 'EMPTY_PHOTO' }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`
    const path = `${employeeId}/${kind}/${filename}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false })

    if (error) return { path: null, error: error.message }
    return { path, error: null }
  } catch (err) {
    return { path: null, error: err instanceof Error ? err.message : 'UPLOAD_FAILED' }
  }
}

/**
 * Turns a stored path into a temporary viewable URL.
 *
 * Tolerates rows written before this feature existed: those hold the literal
 * 'https://placeholder.com/...' string (or any other absolute URL), which is
 * not a storage path and must not be signed — returned as-is so old rows fail
 * visibly as a broken image rather than throwing.
 */
export async function getSignedPhotoUrl(pathOrUrl: string | null, expiresInSeconds = 3600): Promise<string | null> {
  if (!pathOrUrl) return null
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pathOrUrl, expiresInSeconds)
  if (error) return null
  return data?.signedUrl ?? null
}
