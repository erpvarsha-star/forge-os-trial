#!/usr/bin/env node
/**
 * Regenerates every derived brand asset in assets/ from the single source
 * logo at assets/brand/varsha-logo-source.jpg.
 *
 * Usage:
 *   npm install --no-save sharp        # installed ad hoc, on purpose
 *   node scripts/generate-brand-assets.mjs
 *
 * sharp is deliberately NOT a devDependency: the generated assets are
 * committed, so this script only ever runs by hand when the source logo
 * changes. Listing it would make every CI APK build install a heavy native
 * package it never uses — and .github/workflows/build-apk.yml runs
 * `npm ci --ignore-scripts`, which is exactly the kind of thing that has
 * silently broken this project's build before (see CLAUDE.md).
 *
 * Why this exists: assets/brand/README.md designates the source JPEG as the
 * one file of record. Everything downstream (app icon, adaptive icon,
 * splash, notification icon, favicon) is generated from it so the outputs
 * never drift apart, and so a higher-resolution source can be dropped in
 * later with a single rerun (see the caveat below).
 *
 * ---------------------------------------------------------------------
 * KNOWN LIMITATION: the source is only 328x370px. Every target here is
 * larger (icon/adaptive-icon are 1024x1024), so every output beyond the
 * favicon is an upscale and will look visibly soft on a modern screen,
 * especially the "VARSHA" wordmark's thin strokes in splash.png. This
 * script uses sharp's lanczos3 kernel (best available upscale quality)
 * and deliberately does NOT apply any sharpening, which would just turn
 * softness into visible ringing/artifacts. If a higher-res or vector
 * source (SVG/AI/EPS/PNG >=1024px, transparent bg) arrives, replace
 * assets/brand/varsha-logo-source.jpg (or point SOURCE below at the new
 * file), re-measure the bounding boxes below against the new pixels, and
 * rerun. Nothing else in the app needs to change.
 * ---------------------------------------------------------------------
 */
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SOURCE = path.join(ROOT, 'assets/brand/varsha-logo-source.jpg')
const OUT_DIR = path.join(ROOT, 'assets')

const WHITE_OPAQUE = { r: 255, g: 255, b: 255, alpha: 1 }
const TRANSPARENT = { r: 255, g: 255, b: 255, alpha: 0 }
const KERNEL = sharp.kernel.lanczos3

// Hand-measured against the 328x370 source by scanning rows/columns for
// pixels that deviate from white background (see git history of this file
// for the scan script if the source ever changes and these need redoing).
//
//   sphere-only logomark:  x 56-278, y 21-239  (~222 x 218, near-circular)
//   sphere + "VARSHA":     x 37-284, y 21-294
//
// Boxes below add a little breathing room around those measurements.
const SPHERE_BOX = { left: 56, top: 21, width: 222, height: 218 }
const LOCKUP_BOX = { left: 30, top: 12, width: 260, height: 285 }

/**
 * Extracts just the sphere logomark and returns it as a PNG buffer with a
 * transparent (alpha-masked) circular cutout — the source crop is a square
 * containing opaque white corner triangles around the round logo, so a
 * plain crop would show a white box instead of transparency once composited
 * onto anything non-white (this matters for adaptive-icon.png).
 */
async function sphereCutout(targetSize) {
  const opaque = await sharp(SOURCE)
    .extract(SPHERE_BOX)
    .resize(targetSize, targetSize, { fit: 'inside', kernel: KERNEL })
    .toBuffer()
  const { width, height } = await sharp(opaque).metadata()
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="#fff"/>
    </svg>`
  )
  return sharp(opaque)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer()
}

/** Sphere + "VARSHA" wordmark lockup, as a plain (opaque, white-bg) PNG buffer. */
async function lockupBuffer(targetWidth) {
  const targetHeight = Math.round(targetWidth * (LOCKUP_BOX.height / LOCKUP_BOX.width))
  return sharp(SOURCE)
    .extract(LOCKUP_BOX)
    .resize(targetWidth, targetHeight, { fit: 'inside', kernel: KERNEL })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer()
}

/**
 * In-app logo used by components/BrandLogo.tsx (header + login/change-pin
 * screens). Unlike lockupBuffer() above (used only for the opaque
 * white-background splash screen), this needs a genuinely transparent
 * background: BrandLogo renders both inside the white header bar and
 * directly on screen content, so an opaque white square would show a
 * visible edge. The source has no alpha channel (opaque JPEG), so we
 * chroma-key it: alpha is derived per-pixel from how far each color is
 * from pure white, ramped over a small tolerance band. That makes the
 * white background (and the white padding 'contain' adds) fully
 * transparent, feathers the sphere/wordmark edges smoothly instead of
 * leaving hard jaggies, and leaves the near-white swoosh highlight only
 * lightly translucent — invisible in practice since both places this
 * asset is used (header bar, login/change-pin screens) are white anyway.
 */
async function writeTransparentLockup({ file, size }) {
  const { data, info } = await sharp(SOURCE)
    .extract(LOCKUP_BOX)
    .resize(size, size, { fit: 'contain', kernel: KERNEL, background: WHITE_OPAQUE })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const WHITE_TOLERANCE = 40 // pixels within this of pure white fade to transparent
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0, p = 0; i < data.length; i += channels, p += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const deviationFromWhite = Math.max(255 - r, 255 - g, 255 - b)
    const alpha = Math.max(0, Math.min(255, Math.round((deviationFromWhite / WHITE_TOLERANCE) * 255)))
    rgba[p] = r
    rgba[p + 1] = g
    rgba[p + 2] = b
    rgba[p + 3] = alpha
  }

  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(path.join(ROOT, file))
  console.log(`  wrote ${file} (${width}x${height}, transparent chroma-keyed lockup)`)
}

async function writeIcon({ file, size, fillRatio, background }) {
  const logoSize = Math.round(size * fillRatio)
  const logo = await sphereCutout(logoSize)
  const { width, height } = await sharp(logo).metadata()
  const left = Math.round((size - width) / 2)
  const top = Math.round((size - height) / 2)
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, left, top }])
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(path.join(OUT_DIR, file))
  console.log(`  wrote ${file} (${size}x${size}, logo ${width}x${height})`)
}

async function writeSplash({ file, width, height, widthRatio }) {
  const logoWidth = Math.round(width * widthRatio)
  const logo = await lockupBuffer(logoWidth)
  const meta = await sharp(logo).metadata()
  const left = Math.round((width - meta.width) / 2)
  const top = Math.round((height - meta.height) / 2)
  await sharp({ create: { width, height, channels: 4, background: WHITE_OPAQUE } })
    .composite([{ input: logo, left, top }])
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(path.join(OUT_DIR, file))
  console.log(`  wrote ${file} (${width}x${height}, logo ${meta.width}x${meta.height})`)
}

/**
 * Android notification icons MUST be a flat white silhouette on a
 * transparent background — the OS renders anything else (including a
 * recolored version of a gradient/glossy photo) as a grey blob, per the
 * platform docs. Thresholding the source photo's pixels doesn't produce a
 * clean result here either: the logo's swoosh detail is itself grey/white,
 * so a naive "non-white -> opaque" mask punches transparent holes through
 * the middle of the disc. Instead we deliberately derive a simplified
 * silhouette from the sphere's shape (a filled circle, matching the
 * near-circular bounding box measured above) rather than the photo's
 * pixels — a clean, crisp, resolution-independent shape that reads
 * correctly at the tiny sizes Android actually renders this at.
 */
async function writeNotificationIcon({ file, size, fillRatio }) {
  const radius = Math.round((size * fillRatio) / 2)
  const cx = size / 2
  const cy = size / 2
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#ffffff"/>
  </svg>`
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, effort: 10 }).toFile(path.join(OUT_DIR, file))
  console.log(`  wrote ${file} (${size}x${size}, white circle r=${radius} on transparent)`)
}

async function main() {
  console.log(`Generating brand assets from ${path.relative(ROOT, SOURCE)}...`)

  // App icon (iOS + Android launcher fallback): logomark only, generous
  // white padding since most launchers add their own rounding/masking.
  await writeIcon({ file: 'icon.png', size: 1024, fillRatio: 0.8, background: WHITE_OPAQUE })

  // Android adaptive icon foreground: Android masks this to a circle/
  // squircle and crops ~25% at the edges, so the logo must sit well inside
  // the center ~66%. Transparent background — app.json's adaptiveIcon
  // .backgroundColor (#ffffff) supplies the background layer.
  await writeIcon({ file: 'adaptive-icon.png', size: 1024, fillRatio: 0.56, background: TRANSPARENT })

  // Favicon: same treatment as the app icon, just smaller.
  await writeIcon({ file: 'favicon.png', size: 48, fillRatio: 0.8, background: WHITE_OPAQUE })

  // Splash screen: full sphere + "VARSHA" wordmark lockup, centered on white.
  await writeSplash({ file: 'splash.png', width: 1284, height: 2778, widthRatio: 0.58 })

  // Notification icon: white silhouette on transparent, per Android rules.
  await writeNotificationIcon({ file: 'notification-icon.png', size: 96, fillRatio: 0.62 })

  // In-app logo (components/BrandLogo.tsx): small, transparent-background,
  // sized for the largest on-screen render (128px) at 2x for high-DPI —
  // deliberately NOT the 1024x1024 launcher icon.png, which would make
  // Android decode ~4MB of ARGB_8888 for a 32-128px on-screen image.
  await writeTransparentLockup({ file: 'assets/brand/logo-256.png', size: 256 })

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
