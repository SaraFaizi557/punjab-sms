/**
 * Single source for the Punjab-SMS brand mark: `public/app-brand-logo.png`
 * (transparent Digital Education Emblem; copied to `dist/` on build).
 * Companion icons (regenerate via `scripts/generate-app-icons.py`):
 * - `favicon.png` / `favicon.svg` (browser tab)
 * - `apple-touch-icon.png` (iOS home screen, navy plate)
 * - `pwa-icon-192.png` / `pwa-icon-512.png` (PWA any — transparent)
 * - `pwa-icon-512-maskable.png` (Android adaptive / maskable — navy plate)
 */
const base = import.meta.env.BASE_URL || "./";
const withSlash = base.endsWith("/") ? base : `${base}/`;
export const APP_BRAND_LOGO_URL = `${withSlash}app-brand-logo.png`;
export const APP_PWA_ICON_192_URL = `${withSlash}pwa-icon-192.png`;
export const APP_PWA_ICON_512_URL = `${withSlash}pwa-icon-512.png`;
