import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../site.config.mjs";
import { buildSite } from "./site.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
await buildSite({ root, config });
const dist = path.join(root, "dist");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".pdf": "application/pdf",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
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
    const body = await readFile(target);
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
  console.log("After editing Markdown, run npm run build and refresh the browser.");
});
