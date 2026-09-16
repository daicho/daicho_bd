import { createServer } from "node:http";
import { watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "dist");
const contentDir = path.join(root, "content");
const themeDir = path.join(root, "theme");
const configFile = path.join(root, "site.config.mjs");
const siteScript = path.join(root, "scripts", "site.mjs");
const port = Number(process.env.PORT || 4173);
const reloadClients = new Set();
let rebuildTimer;
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".pdf": "application/pdf",
};

function notifyReload() {
  for (const response of reloadClients) response.write("data: reload\n\n");
}

async function rebuild(change) {
  const cacheBust = `?v=${Date.now()}`;
  const [{ default: config }, { buildSite }] = await Promise.all([
    import(`../site.config.mjs${cacheBust}`),
    import(`./site.mjs${cacheBust}`),
  ]);
  const pages = await buildSite({ root, config });
  console.log(`Rebuilt ${pages.length} Markdown pages after ${change}.`);
  notifyReload();
}

await rebuild("startup");

function scheduleRebuild(change) {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    try {
      await rebuild(change || "a watched file change");
    } catch (error) {
      console.error(`Rebuild failed after ${change || "a watched file change"}:`);
      console.error(error);
    }
  }, 100);
}

watch(contentDir, { recursive: true }, (_eventType, filename) => {
  scheduleRebuild(filename?.toString() || "a content change");
});
watch(themeDir, { recursive: true }, (_eventType, filename) => {
  scheduleRebuild(filename?.toString() || "a theme change");
});
watch(root, (_eventType, filename) => {
  if (filename?.toString() === path.basename(configFile)) scheduleRebuild("site.config.mjs");
});
watch(path.dirname(siteScript), (_eventType, filename) => {
  if (filename?.toString() === path.basename(siteScript)) scheduleRebuild("scripts/site.mjs");
});

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/_site/live-reload") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write("\n");
      reloadClients.add(response);
      request.on("close", () => reloadClients.delete(response));
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(400).end("Invalid URL encoding");
      return;
    }
    const file = path.resolve(dist, `.${pathname}`);
    if (pathname.includes("\\") || pathname.includes("\0") || (file !== dist && !file.startsWith(`${dist}${path.sep}`))) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    let target = file;
    if ((await stat(target)).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        response.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
        return;
      }
      target = path.join(target, "index.html");
    }
    let body = await readFile(target);
    if (path.extname(target) === ".html") {
      body = Buffer.from(`${body.toString("utf8").replace(
        "</body>",
        '<script>const reload = new EventSource("/_site/live-reload");reload.onmessage = () => location.reload();</script></body>',
      )}`);
    }
    response.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(await readFile(path.join(dist, "404.html")));
      return;
    }
    console.error(error);
    response.writeHead(500).end("Preview server error");
  }
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Preview: http://127.0.0.1:${port}`);
  console.log("Content, theme, site.config.mjs, and scripts/site.mjs changes rebuild the site and reload the browser automatically.");
});
