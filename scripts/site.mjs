import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import MarkdownIt from "markdown-it";
import container from "markdown-it-container";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

const encodePath = (value) => value.split("/").map(encodeURIComponent).join("/");

const isExternalLink = (href) => /^(?:https?:)?\/\//i.test(href);

export function pageUrl(file) {
  const stem = file.replace(/\.md$/i, "");
  const route = stem === "index" ? "" : stem.replace(/\/index$/, "");
  return route ? `/${encodePath(route)}/` : "/";
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${relative}`);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path.join(directory, entry.name), relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files.sort();
}

function rewriteLink(href, source, files) {
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(href)) return href;
  const [, encoded, suffix] = href.match(/^([^?#]*)(.*)$/);
  let decoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    throw new Error(`${source}: Invalid URL encoding in "${href}"`);
  }
  if (decoded.includes("\\")) throw new Error(`${source}: Use "/" in Markdown URLs: ${href}`);
  const target = path.posix.normalize(
    decoded.startsWith("/") ? decoded.slice(1) : path.posix.join(path.posix.dirname(source), decoded),
  );
  if (target === ".." || target.startsWith("../")) {
    throw new Error(`${source}: Link escapes the content directory: ${href}`);
  }
  if (/\.md$/i.test(target)) {
    if (!files.has(target)) throw new Error(`${source}: Markdown page not found: ${href}`);
    return pageUrl(target) + suffix;
  }
  if (files.has(target)) return `/${encodePath(target)}${suffix}`;
  const route = target.replace(/\/$/, "");
  if (target === "." || files.has(`${route}.md`) || files.has(`${route}/index.md`)) {
    return (target === "." ? "/" : `/${encodePath(route)}/`) + suffix;
  }
  throw new Error(`${source}: Local link or image not found: ${href}`);
}

function createMarkdown(files) {
  const md = new MarkdownIt({ breaks: true, html: false, linkify: true, typographer: false });
  for (const name of ["link", "note"]) {
    md.use(container, name, {
      validate: (params) => params.trim() === name,
      render: (tokens, index) => tokens[index].nesting === 1
        ? `<div class="${name === "link" ? "link-card" : "note"}">\n`
        : "</div>\n",
    });
  }
  md.use(container, "label", {
    validate: (params) => params.trim() === "label",
    render: (tokens, index) => tokens[index].nesting === 1
      ? '<div class="page-label"><span aria-hidden="true"></span>\n'
      : "</div>\n",
  });
  md.core.ruler.push("site-links-and-headings", (state) => {
    const usedIds = new Set();
    state.tokens.forEach((token, index) => {
      if (token.type === "heading_open") {
        const text = inlineText(state.tokens[index + 1]);
        const base = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s+/g, "-") || "section";
        let id = base;
        let count = 2;
        while (usedIds.has(id)) id = `${base}-${count++}`;
        usedIds.add(id);
        token.attrSet("id", id);
      }
      const visit = (child) => {
        for (const attr of ["href", "src"]) {
          const value = child.attrGet(attr);
          if (value !== null) child.attrSet(attr, rewriteLink(value, state.env.source, files));
        }
        if (child.type === "link_open" && isExternalLink(child.attrGet("href"))) {
          child.attrJoin("class", "external-link");
          child.attrSet("target", "_blank");
        }
        if (child.type === "image") {
          child.attrSet("loading", "lazy");
          child.attrSet("decoding", "async");
        }
        child.children?.forEach(visit);
      };
      visit(token);
    });
  });
  return md;
}

function inlineText(token) {
  return (token?.children ?? []).map((child) => {
    if (child.type === "image") return child.content;
    if (child.type === "softbreak" || child.type === "hardbreak") return " ";
    return child.type === "text" || child.type === "code_inline" ? child.content : "";
  }).join("");
}

function renderPage({ title, body, url, config, notFound = false }) {
  const home = url === "/";
  const documentTitle = home ? `${config.name}` : `${title} | ${config.name}`;
  const canonical = new URL(url, config.url).href;
  return `<!doctype html>
<html lang="${escapeHtml(config.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#e9f5fd">
  <title>${escapeHtml(documentTitle)}</title>
  <meta name="description" content="${escapeHtml(config.description)}">
  ${notFound ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${escapeHtml(canonical)}">`}
  <meta property="og:type" content="website">
  <meta property="og:locale" content="${escapeHtml(config.language === "ja" ? "ja_JP" : config.language)}">
  <meta property="og:site_name" content="${escapeHtml(config.name)}">
  <meta property="og:title" content="${escapeHtml(documentTitle)}">
  <meta property="og:description" content="${escapeHtml(config.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="/_site/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/_site/style.css">
</head>
<body>
  <a class="skip-link" href="#main">本文へスキップ</a>
  <div class="site-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="${escapeHtml(config.name)}">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>${escapeHtml(config.name)}</span>
      </a>
    </header>
    <main id="main" tabindex="-1">
      <article class="prose${home ? " home" : ""}">
${body}
      </article>
      ${home ? "" : '<a class="back-link" href="/"><span class="back-link-label">トップに戻る</span></a>'}
    </main>
    <footer class="site-footer">
      Copyright &copy; 2026 だいちょ
    </footer>
  </div>
</body>
</html>
`;
}

export async function buildSite({ root, config }) {
  const contentDir = path.join(root, "content");
  const outputDir = path.join(root, "dist");
  const files = new Set(await listFiles(contentDir));
  if (!files.has("index.md")) throw new Error("content/index.md is required.");
  const pages = [...files].filter((file) => /\.md$/i.test(file));
  const outputs = new Map();
  const claim = (output, source) => {
    const key = output.toLowerCase();
    for (const [existing, owner] of outputs) {
      if (key === existing || key.startsWith(`${existing}/`) || existing.startsWith(`${key}/`)) {
        throw new Error(`Output collision: ${source} and ${owner} (${output})`);
      }
    }
    outputs.set(key, source);
  };
  claim("404.html", "generated 404");
  claim("_site", "theme assets");
  for (const file of files) {
    const output = /\.md$/i.test(file)
      ? `${decodeURIComponent(pageUrl(file)).slice(1)}index.html`
      : file;
    claim(output, file);
  }
  const md = createMarkdown(files);
  const rendered = [];
  for (const source of pages) {
    const env = { source };
    const tokens = md.parse(await readFile(path.join(contentDir, source), "utf8"), env);
    const headingIndex = tokens.findIndex((token) => token.type === "heading_open" && token.tag === "h1");
    if (headingIndex < 0) throw new Error(`${source}: Add a "# Page title" heading.`);
    const title = inlineText(tokens[headingIndex + 1]);
    rendered.push({
      output: `${decodeURIComponent(pageUrl(source)).slice(1)}index.html`,
      html: renderPage({
        title, body: md.renderer.render(tokens, md.options, env), url: pageUrl(source), config,
      }),
    });
  }
  // Validate every page before replacing the previous successful build.
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(path.join(root, "theme"), path.join(outputDir, "_site"), { recursive: true });
  for (const file of files) {
    if (/\.md$/i.test(file)) continue;
    const destination = path.join(outputDir, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(contentDir, file), destination);
  }
  for (const { output, html } of rendered) {
    const destination = path.join(outputDir, output);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, html);
  }
  await writeFile(path.join(outputDir, "404.html"), renderPage({
    title: "ページが見つかりません",
    body: "<h1>ページが見つかりません</h1><p>このページは見つかりませんでした。</p>",
    url: "/404.html",
    config,
    notFound: true,
  }));
  return pages;
}
