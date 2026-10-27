import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./responsive.css";
import Root from "./Root.jsx";
import { initSupabaseCloud } from "./lib/supabase.js";

/** Keys left by the removed Finance module (see git: FinanceContext + docs). */
function removeLegacyFinanceStorageKeys() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === "financeData" || k.startsWith("finance:") || k.startsWith("finance_")) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore private mode / quota */
  }
}
removeLegacyFinanceStorageKeys();

const isProduction = import.meta.env.PROD;
const base = import.meta.env.BASE_URL || "/";
const withSlash = base.endsWith("/") ? base : `${base}/`;
const swUrl = `${withSlash}sw.js`;

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    // Dev: clear any leftover production SW so HMR stays clean
    if (!isProduction) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => undefined);
      return;
    }

    // New SW (new ASSET_REV / icons) claims → reload so every device loads the
    // versioned manifest + icon URLs Chrome/Android use for the home-screen mark.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register(swUrl, { scope: withSlash, updateViaCache: "none" })
      .then((reg) => {
        const check = () => {
          try {
            void reg.update();
          } catch {
            /* ignore */
          }
        };
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });
        window.addEventListener("online", check);
        // Idle / background PWAs still discover icon + shell updates.
        window.setInterval(check, 30 * 60 * 1000);
        check();

        const activateWaiting = (worker) => {
          if (!worker) return;
          worker.postMessage({ type: "SKIP_WAITING" });
        };
        if (reg.waiting) activateWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              activateWaiting(worker);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service worker registration failed", err);
      });
  });
}

registerServiceWorker();

function boot() {
  // Paint immediately — do not await cloud/network before first React frame.
  // HTML #psms-boot-splash inside #root is replaced when React commits.
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );

  // Cloud config is usually already inlined (psms-config.js / __PSMS_CLOUD__).
  // Finish init in the background; login still awaits ensureCloudReady().
  void initSupabaseCloud().catch((err) => {
    console.warn("Cloud init failed", err);
  });
}

boot();
