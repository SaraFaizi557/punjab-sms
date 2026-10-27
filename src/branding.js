/**
 * Single source for the Punjab-SMS brand mark: `public/app-brand-logo.png`
 * (transparent Digital Education Emblem; copied to `dist/` on build).
 * Companion icons (regenerate via `scripts/generate-app-icons.py`):
 * - `favicon.png` / `favicon.svg` (browser tab)
 * - `apple-touch-icon.png` (iOS home screen, navy plate)
 * - `pwa-icon-192.png` / `pwa-icon-512.png` (PWA install — navy plate)
 * - `pwa-icon-512-maskable.png` (Android adaptive / maskable — navy plate)
 *
 * `PWA_ASSET_REV` must match `public/pwa-asset-rev.json` so installed PWAs
 * fetch new icon URLs after each icon/deploy change.
 */
import revData from "./pwa-asset-rev.json";

const base = import.meta.env.BASE_URL || "./";
const withSlash = base.endsWith("/") ? base : `${base}/`;
export const PWA_ASSET_REV = String(revData?.rev || "1");
const v = `?v=${encodeURIComponent(PWA_ASSET_REV)}`;

export const APP_BRAND_LOGO_URL = `${withSlash}app-brand-logo.png${v}`;
export const APP_PWA_ICON_192_URL = `${withSlash}pwa-icon-192.png${v}`;
export const APP_PWA_ICON_512_URL = `${withSlash}pwa-icon-512.png${v}`;
