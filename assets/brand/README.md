# Brand assets

`varsha-logo-source.jpg` — company logo supplied by Yash (owner), 11 Aug 2026.
Source resolution: 328x370, JPEG, opaque white background.

This is the *source of record*. Everything else (app icon, adaptive icon,
splash, notification icon, in-app header logo) should be derived from it
rather than re-supplied, so they never drift apart.

Not yet wired up anywhere — the files in `assets/` are still placeholder art
and `EXPO_PUBLIC_LOGO_URL` is empty, so `components/Header.tsx` still renders
its fallback orange "F" square. Awaiting instructions before deriving assets.

## Known constraint before deriving

At 328x370 this is smaller than several required outputs, most notably the
1024x1024 app icon. Upscaling will look visibly soft on modern displays.
A higher-resolution original (ideally vector — SVG/AI/EPS/PDF — or a PNG at
1024px or larger, with a transparent background) is worth getting before
these are generated. The wordmark in particular degrades badly when scaled up.
