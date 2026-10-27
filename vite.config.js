import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handlePaperAi } from "./server/paperAi.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Vite `base`: `/` or `/subdir/` (leading slash, trailing slash for subpaths). */
function viteBase(mode) {
  const env = loadEnv(mode, process.cwd(), "");
  const raw = (env.VITE_BASE || "/").trim();
  if (!raw || raw === "/") return "/";
  const withSlash = raw.endsWith("/") ? raw : `${raw}/`;
  return withSlash.startsWith("/") ? withSlash : `/${withSlash}`;
}

/** Rewrite root-absolute links in `index.html` when hosting under a subpath. */
function paperAiDevPlugin(mode) {
  return {
    name: "psms-paper-ai",
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), "");
      console.log("[psms-paper-ai] route ready");
      server.middlewares.use((req, res, next) => {
        const pathOnly = String(req.url || "").split("?")[0];
        if (pathOnly !== "/api/generate-paper") return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            const result = await handlePaperAi(body, {
              apiKey: process.env.GEMINI_API_KEY || env.GEMINI_API_KEY,
              model: process.env.GEMINI_MODEL || env.GEMINI_MODEL,
            });
            res.statusCode = result.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result.body));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: error?.message || "Paper generation failed." }));
          }
        });
      });
    },
  };
}

function patchHtmlPublicLinks(base) {
  return {
    name: "psms-html-public-links",
    transformIndexHtml(html) {
      const rev = readPwaAssetRev();
      const iconBase = `/i/${rev}`;
      let next = html;
      // Path-versioned launcher icons (Android/iOS install capture)
      next = next.replace(
        /((?:href|src)=")\/?(?:i\/[^/]+\/)?apple-touch-icon\.png(?:\?v=[^"]*)?(")/g,
        `$1${iconBase}/apple-touch-icon.png$2`,
      );
      next = next.replace(
        /((?:href|src)=")\/?(?:i\/[^/]+\/)?pwa-icon-192\.png(?:\?v=[^"]*)?(")/g,
        `$1${iconBase}/pwa-icon-192.png$2`,
      );
      next = next.replace(
        /((?:href|src)=")\/?(?:i\/[^/]+\/)?pwa-icon-512\.png(?:\?v=[^"]*)?(")/g,
        `$1${iconBase}/pwa-icon-512.png$2`,
      );
      for (const name of ["favicon.png", "favicon.svg", "manifest.webmanifest", "app-brand-logo.png"]) {
        const re = new RegExp(`((?:href|src)="/${name.replace(".", "\\.")})(?:\\?v=[^"]*)?(")`, "g");
        next = next.replace(re, `$1?v=${encodeURIComponent(rev)}$2`);
      }
      if (base === "/") return next;
      return next
        .replaceAll(`href="/favicon.png?v=${rev}"`, `href="${base}favicon.png?v=${rev}"`)
        .replaceAll(`href="/favicon.svg?v=${rev}"`, `href="${base}favicon.svg?v=${rev}"`)
        .replaceAll(`href="${iconBase}/apple-touch-icon.png"`, `href="${base}i/${rev}/apple-touch-icon.png"`)
        .replaceAll(`href="/manifest.webmanifest?v=${rev}"`, `href="${base}manifest.webmanifest?v=${rev}"`)
        .replaceAll(`href="${iconBase}/pwa-icon-192.png"`, `href="${base}i/${rev}/pwa-icon-192.png"`)
        .replaceAll(`href="${iconBase}/pwa-icon-512.png"`, `href="${base}i/${rev}/pwa-icon-512.png"`)
        .replaceAll(`src="/app-brand-logo.png?v=${rev}"`, `src="${base}app-brand-logo.png?v=${rev}"`);
    },
  };
}

function readPwaAssetRev() {
  for (const rel of ["public/pwa-asset-rev.json", "src/pwa-asset-rev.json"]) {
    const file = path.resolve(rel);
    try {
      if (!fs.existsSync(file)) continue;
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      return String(data.rev || "1");
    } catch {
      /* try next */
    }
  }
  return "1";
}

function withAssetRev(src, rev) {
  if (typeof src !== "string" || !src) return src;
  const [pathPart] = src.split("?");
  return `${pathPart}?v=${encodeURIComponent(rev)}`;
}

const PWA_ICON_FILES = [
  "pwa-icon-192.png",
  "pwa-icon-512.png",
  "pwa-icon-512-maskable.png",
  "apple-touch-icon.png",
  "pwa-ico.png",
];

/** Copy launcher icons into /i/{rev}/ so Android WebAPK sees brand-new icon URLs. */
function publishVersionedIconDir(distRoot, rev) {
  const dest = path.join(distRoot, "i", rev);
  fs.mkdirSync(dest, { recursive: true });
  for (const name of PWA_ICON_FILES) {
    const src = path.join(distRoot, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, name));
  }
  return `/i/${rev}`;
}

function toVersionedIconSrc(src, rev, root) {
  if (typeof src !== "string") return src;
  const bare = src.split("?")[0];
  const file = bare.split("/").pop();
  if (!file || !PWA_ICON_FILES.includes(file) && file !== "apple-touch-icon.png") {
    // non-icon: keep query stamp
    const stamped = withAssetRev(bare.startsWith("/") ? bare : `/${bare}`, rev);
    const q = stamped.indexOf("?");
    const pathPart = q >= 0 ? stamped.slice(0, q) : stamped;
    const query = q >= 0 ? stamped.slice(q) : "";
    if (root && pathPart.startsWith(`${root}/`)) return stamped;
    return `${root}${pathPart}${query}`;
  }
  const pathPart = `${root}/i/${rev}/${file}`.replace(/\/{2,}/g, "/");
  // ensure leading slash when root is ""
  const normalized = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  return normalized.replace(/^\/+/, "/");
}

/** Align PWA manifest with `base` + path-versioned icons after copy to `dist/`. */
function patchManifestScope(base) {
  return {
    name: "psms-manifest-scope",
    closeBundle() {
      const rev = readPwaAssetRev();
      const distRoot = path.resolve("dist");
      const iconBase = publishVersionedIconDir(distRoot, rev);
      const file = path.resolve("dist/manifest.webmanifest");
      if (!fs.existsSync(file)) return;
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      data.start_url = base === "/" ? "/?source=pwa" : `${base}?source=pwa`;
      data.scope = base;
      data.id = base;
      const root = base === "/" ? "" : base.replace(/\/$/, "");
      const mapIcon = (src) => {
        if (typeof src !== "string") return src;
        const fileName = src.split("?")[0].split("/").pop();
        if (PWA_ICON_FILES.includes(fileName)) {
          return `${root}${iconBase}/${fileName}`;
        }
        return toVersionedIconSrc(src, rev, root);
      };
      if (Array.isArray(data.icons)) {
        data.icons = data.icons.map((icon) => ({ ...icon, src: mapIcon(icon.src) }));
      }
      if (Array.isArray(data.shortcuts)) {
        data.shortcuts = data.shortcuts.map((s) => ({
          ...s,
          url: typeof s.url === "string" && s.url.startsWith("/")
            ? `${root}${s.url}`
            : s.url,
          icons: Array.isArray(s.icons)
            ? s.icons.map((icon) => ({ ...icon, src: mapIcon(icon.src) }))
            : s.icons,
        }));
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 2));

      const swFile = path.resolve("dist/sw.js");
      if (fs.existsSync(swFile)) {
        let sw = fs.readFileSync(swFile, "utf8");
        sw = sw.replace(
          /const ASSET_REV = "[^"]*";/,
          `const ASSET_REV = ${JSON.stringify(rev)};`,
        );
        fs.writeFileSync(swFile, sw);
      }
    },
  };
}

/** Write + inline public cloud config so EVERY browser/device gets Cloud ON. */
function psmsCloudConfigPlugin(mode, base) {
  const runWrite = () => {
    const scriptPath = path.resolve(__dirname, "scripts/write-psms-config.mjs");
    if (!fs.existsSync(scriptPath)) {
      console.warn("[psms-cloud] write-psms-config.mjs missing — skipping config write");
      return;
    }
    try {
      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
      if (result.error) {
        console.warn("[psms-cloud] config write failed:", result.error.message || result.error);
        return;
      }
      if (result.status !== 0 && result.status != null) {
        console.warn(`[psms-cloud] config write exited with code ${result.status}`);
      }
    } catch (err) {
      console.warn("[psms-cloud] config write threw:", err?.message || err);
    }
  };

  const readPublicConfig = () => {
    // Vite loadEnv + process.env (Vercel injects VITE_* into the build env)
    const env = loadEnv(mode, process.cwd(), "");
    let url = String(
      process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || ""
    ).trim();
    let anonKey = String(
      process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ""
    ).trim();
    const jsonPath = path.resolve(process.cwd(), "public/psms-config.json");
    if (fs.existsSync(jsonPath)) {
      try {
        const j = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        url = url || String(j.url || "").trim();
        anonKey = anonKey || String(j.anonKey || "").trim();
      } catch {
        /* ignore */
      }
    }
    return { url, anonKey };
  };

  const marker = '<script src="/psms-config.js"></script>';

  return {
    name: "psms-cloud-config",
    buildStart() {
      runWrite();
    },
    configureServer() {
      runWrite();
    },
    transformIndexHtml(html) {
      const cfg = readPublicConfig();
      const scriptSrc = `${base}psms-config.js`;
      if (!cfg.url || !cfg.anonKey) {
        console.warn("[psms-cloud] No Supabase URL/key — Cloud will stay OFF");
        return html.replace(
          marker,
          `<script>window.__PSMS_CLOUD__=null;</script>\n    <script src="${scriptSrc}"></script>`
        );
      }
      const inline = `<script>window.__PSMS_CLOUD__=${JSON.stringify(cfg)};</script>`;
      console.log("[psms-cloud] Inlined cloud config into index.html");
      return html.replace(
        marker,
        `${inline}\n    <script src="${scriptSrc}"></script>`
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const base = viteBase(mode);
  const photosRoot = path.resolve(__dirname, "Photos");
  return {
    base,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    plugins: [
      tailwindcss(),
      react({
        babel: {
          presets: [["@babel/preset-react", { runtime: "automatic" }]],
        },
      }),
      psmsCloudConfigPlugin(mode, base),
      paperAiDevPlugin(mode),
      patchHtmlPublicLinks(base),
      patchManifestScope(base),
      {
        name: "psms-serve-photos",
        configureServer(server) {
          server.middlewares.use("/Photos-api", (req, res, next) => {
            try {
              const url = new URL(req.url || "/", "http://psms.local");
              const pathname = url.pathname || "";
              if (pathname === "/folder-exists" || pathname.endsWith("/folder-exists")) {
                const name = String(url.searchParams.get("name") || "").trim();
                const dir = path.normalize(path.join(photosRoot, name));
                const ok =
                  !!name &&
                  dir.startsWith(photosRoot) &&
                  fs.existsSync(dir) &&
                  fs.statSync(dir).isDirectory();
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ exists: ok }));
                return;
              }
              // Create Photos/<Class>/ folders (+ .gitkeep) when classes are added
              if (pathname === "/ensure-folders" || pathname.endsWith("/ensure-folders")) {
                if (req.method !== "POST" && req.method !== "PUT") {
                  res.statusCode = 405;
                  res.end("Method not allowed");
                  return;
                }
                const chunks = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", () => {
                  try {
                    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
                    const names = Array.isArray(body.folders)
                      ? body.folders
                      : Array.isArray(body.names)
                        ? body.names
                        : [];
                    const created = [];
                    const existing = [];
                    const failed = [];
                    if (!fs.existsSync(photosRoot)) fs.mkdirSync(photosRoot, { recursive: true });
                    for (const raw of names) {
                      const name = String(raw || "")
                        .trim()
                        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
                        .replace(/\s+/g, " ")
                        .replace(/[. ]+$/g, "")
                        .trim();
                      if (!name || name === "." || name === "..") continue;
                      const dir = path.normalize(path.join(photosRoot, name));
                      if (!dir.startsWith(photosRoot)) {
                        failed.push(name);
                        continue;
                      }
                      try {
                        if (!fs.existsSync(dir)) {
                          fs.mkdirSync(dir, { recursive: true });
                          created.push(name);
                        } else {
                          existing.push(name);
                        }
                        const keep = path.join(dir, ".gitkeep");
                        if (!fs.existsSync(keep)) fs.writeFileSync(keep, "");
                      } catch {
                        failed.push(name);
                      }
                    }
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ ok: true, created, existing, failed }));
                  } catch (err) {
                    res.statusCode = 400;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }));
                  }
                });
                return;
              }
              // List image files in a class folder (one call instead of dozens of 404 probes)
              if (pathname === "/list-folder" || pathname.endsWith("/list-folder")) {
                const name = String(url.searchParams.get("name") || "").trim();
                const dir = path.normalize(path.join(photosRoot, name));
                const imageExt =
                  /\.(jpe?g|jfif|jpe|png|webp|bmp|gif|heic|heif|avif|tiff?|ico|svg)$/i;
                let files = [];
                let dirExists = false;
                if (
                  name &&
                  dir.startsWith(photosRoot) &&
                  fs.existsSync(dir) &&
                  fs.statSync(dir).isDirectory()
                ) {
                  dirExists = true;
                  files = fs
                    .readdirSync(dir)
                    .map((f) => {
                      try {
                        const full = path.join(dir, f);
                        const st = fs.statSync(full);
                        if (!st.isFile() || !imageExt.test(f)) return null;
                        return { name: f, size: st.size, mtime: Math.floor(st.mtimeMs || 0) };
                      } catch {
                        return null;
                      }
                    })
                    .filter(Boolean);
                }
                const signature = files
                  .map((f) => `${f.name}:${f.size}:${f.mtime}`)
                  .sort()
                  .join("|");
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    exists: dirExists,
                    files,
                    signature,
                  }),
                );
                return;
              }
              next();
            } catch {
              next();
            }
          });
          server.middlewares.use("/Photos", (req, res, next) => {
            try {
              const rel = decodeURIComponent((req.url || "/").split("?")[0] || "/");
              const filePath = path.normalize(path.join(photosRoot, rel));
              if (!filePath.startsWith(photosRoot)) {
                res.statusCode = 403;
                res.end("Forbidden");
                return;
              }
              // Must 404 — do not fall through to SPA index.html (that was saved as "photos")
              if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.end("Not found");
                return;
              }
              const ext = path.extname(filePath).toLowerCase();
              const types = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".jpe": "image/jpeg",
                ".jfif": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".gif": "image/gif",
                ".bmp": "image/bmp",
                ".tif": "image/tiff",
                ".tiff": "image/tiff",
                ".heic": "image/heic",
                ".heif": "image/heif",
                ".avif": "image/avif",
                ".ico": "image/x-icon",
                ".svg": "image/svg+xml",
              };
              res.setHeader("Content-Type", types[ext] || "application/octet-stream");
              res.setHeader("Cache-Control", "no-cache");
              fs.createReadStream(filePath).pipe(res);
            } catch {
              res.statusCode = 500;
              res.end("Error");
            }
          });
        },
      },
    ],
    /**
     * Dev dependency pre-bundling needs esbuild (default). Disabling esbuild globally
     * or using `optimizeDeps.noDiscovery: true` without full `include` caused raw CJS
     * `react` / `react-dom` to load in the browser (no `createContext` / `createRoot`).
     */
    optimizeDeps: {
      // jspdf / jspdf-autotable ship ESM; forcing needsInterop breaks `import { jsPDF }` / constructor binding.
      needsInterop: ["jszip", "html2canvas"],
      // Do not prebundle @imgly / onnxruntime — they are dynamic-only and slow cold start.
    },
    worker: {
      format: "es",
    },
    server: {
      watch: {
        // Student photo files lock on Windows and crash Vite's watcher
        ignored: ["**/Photos/**", "**/node_modules/**"],
      },
    },
    build: {
      chunkSizeWarningLimit: 2500,
      minify: "esbuild",
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("xlsx")) return "vendor-xlsx";
            if (id.includes("jspdf")) return "vendor-jspdf";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("react-dom") || id.includes("/react/") || id.endsWith("\\react\\index.js")) {
              return "vendor-react";
            }
          },
        },
      },
    },
  };
});