/**
 * Force installed PWA home-screen icons to refresh when `pwa-asset-rev` changes.
 *
 * Android Chrome WebAPK: updates launcher icon when manifest icon *paths* change
 * and the installed app is opened.
 * iOS: OS freezes the Add-to-Home-Screen icon — we surface a one-time re-add tip.
 */
import { PWA_ASSET_REV } from "./branding.js";

const REV_KEY = "psms_icon_rev";
const IOS_HINT_KEY = "psms_ios_icon_readd";
const RELOAD_KEY = "psms_icon_path_reload";

const ICON_FILES = [
  "pwa-icon-192.png",
  "pwa-icon-512.png",
  "pwa-icon-512-maskable.png",
  "apple-touch-icon.png",
];

function withSlash(base) {
  const b = base || "/";
  return b.endsWith("/") ? b : `${b}/`;
}

export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true
  );
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");
}

function iconDir(base, rev) {
  return `${withSlash(base)}i/${encodeURIComponent(rev)}/`;
}

/** Point <head> links at the current versioned icon + manifest paths. */
export function applyIconHeadLinks(rev = PWA_ASSET_REV) {
  if (typeof document === "undefined") return;
  const base = withSlash(import.meta.env.BASE_URL || "/");
  const dir = iconDir(base, rev);
  const stamp = `?v=${encodeURIComponent(rev)}`;

  const ensureLink = (rel, href, attrs = {}) => {
    let el = document.querySelector(`link[rel="${rel}"]${attrs.sizes ? `[sizes="${attrs.sizes}"]` : ""}`);
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      document.head.appendChild(el);
    }
    Object.entries(attrs).forEach(([k, v]) => {
      if (v != null) el.setAttribute(k, v);
    });
    el.href = href;
  };

  ensureLink("manifest", `${base}manifest.webmanifest${stamp}`);
  ensureLink("apple-touch-icon", `${dir}apple-touch-icon.png`, { sizes: "180x180" });
  ensureLink("icon", `${dir}pwa-icon-192.png`, { type: "image/png", sizes: "192x192" });
  ensureLink("icon", `${dir}pwa-icon-512.png`, { type: "image/png", sizes: "512x512" });
}

async function prefetchVersionedIcons(base, rev) {
  const dir = iconDir(base, rev);
  await Promise.all(
    ICON_FILES.map(async (name) => {
      try {
        await fetch(`${dir}${name}`, { cache: "reload", mode: "same-origin" });
      } catch {
        /* offline */
      }
    }),
  );
}

async function forceServiceWorkerUpdate() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    await reg.update();
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
  } catch {
    /* ignore */
  }
}

/**
 * Call on every boot (prod). Returns whether the icon revision changed vs last launch.
 */
export async function syncPwaIcons() {
  if (typeof window === "undefined") return { changed: false, rev: PWA_ASSET_REV };

  const base = withSlash(import.meta.env.BASE_URL || "/");
  let remoteRev = PWA_ASSET_REV;

  try {
    const res = await fetch(`${base}pwa-asset-rev.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.rev) remoteRev = String(data.rev);
    }
  } catch {
    /* use bundled rev */
  }

  applyIconHeadLinks(remoteRev);
  await prefetchVersionedIcons(base, remoteRev);

  let prev = null;
  try {
    prev = localStorage.getItem(REV_KEY);
  } catch {
    /* ignore */
  }

  const changed = Boolean(prev && prev !== remoteRev);

  try {
    localStorage.setItem(REV_KEY, remoteRev);
  } catch {
    /* ignore */
  }

  if (changed) {
    await forceServiceWorkerUpdate();

    if (isIosDevice() && isStandalonePwa()) {
      try {
        localStorage.setItem(IOS_HINT_KEY, remoteRev);
      } catch {
        /* ignore */
      }
    }

    // Android / desktop: one reload so the WebAPK re-reads the new manifest icon paths.
    if (!isIosDevice()) {
      try {
        if (sessionStorage.getItem(RELOAD_KEY) !== remoteRev) {
          sessionStorage.setItem(RELOAD_KEY, remoteRev);
          window.location.reload();
          return { changed: true, rev: remoteRev, reloading: true };
        }
      } catch {
        window.location.reload();
        return { changed: true, rev: remoteRev, reloading: true };
      }
    }
  }

  return { changed, rev: remoteRev, reloading: false };
}

export function consumeIosIconReaddHint() {
  try {
    const rev = localStorage.getItem(IOS_HINT_KEY);
    if (!rev) return null;
    localStorage.removeItem(IOS_HINT_KEY);
    return rev;
  } catch {
    return null;
  }
}

export function peekIosIconReaddHint() {
  try {
    return localStorage.getItem(IOS_HINT_KEY);
  } catch {
    return null;
  }
}

export function dismissIosIconReaddHint() {
  try {
    localStorage.removeItem(IOS_HINT_KEY);
  } catch {
    /* ignore */
  }
}
