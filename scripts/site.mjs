import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import MarkdownIt from "markdown-it";
import container from "markdown-it-container";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

const encodePath = (value) => value.split("/").map(encodeURIComponent).join("/");

const isExternalLink = (href) => /^(?:https?:)?\/\//i.test(href);

const execFileAsync = promisify(execFile);
const updatedDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tokyo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

async function pageUpdates(root, pages) {
  // ファイル名を Git のパターンとして解釈させず、更新日時をコミット履歴から取得する
  const runGit = (args) => execFileAsync("git", ["--literal-pathspecs", "-C", root, ...args], {
    env: { ...process.env, LC_ALL: "C" },
  });
  const updates = new Map();
  // Git が使えない環境やコミットのないリポジトリでは更新日時を付けない
  try {
    await runGit(["rev-parse", "--show-toplevel"]);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn("Git is unavailable; page update dates will be omitted.");
      return updates;
    }
    if (error.code === 128 && error.stderr?.includes("not a git repository")) return updates;
    throw error;
  }
  try {
    await runGit(["rev-parse", "--verify", "--quiet", "HEAD"]);
  } catch (error) {
    if (error.code === 1) return updates;
    throw error;
  }
  for (const source of pages) {
    // 改名前の履歴も追跡し、表示用の日時だけ日本時間へ変換する
    const { stdout } = await runGit(["log", "-1", "--follow", "--format=%cI", "--", `content/${source}`]);
    const timestamp = stdout.trim();
    if (!timestamp) continue;
    const date = new Date(timestamp);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)
      || Number.isNaN(date.getTime())) {
      throw new Error(`${source}: Invalid Git commit timestamp: ${timestamp}`);
    }
    const parts = Object.fromEntries(updatedDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
    updates.set(source, {
      timestamp,
      display: `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`,
    });
  }
  return updates;
}

export function pageUrl(file) {
  // index.md は親ディレクトリの URL に、それ以外は拡張子なしのディレクトリ URL にする
  const stem = file.replace(/\.md$/i, "");
  const route = stem === "index" ? "" : stem.replace(/\/index$/, "");
  return route ? `/${encodePath(route)}/` : "/";
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    // content の外部を参照する可能性があるシンボリックリンクは扱わない
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
  // 外部 URL やページ内参照は維持し、ローカル参照だけ存在確認と公開 URL への変換を行う
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(href)) return href;
  const [, encoded, suffix] = href.match(/^([^?#]*)(.*)$/);
  let decoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    throw new Error(`${source}: Invalid URL encoding in "${href}"`);
  }
  if (decoded.includes("\\")) throw new Error(`${source}: Use "/" in Markdown URLs: ${href}`);
  // Markdown のパスは実行環境に関係なくスラッシュ区切りで解決する
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
  const md = new MarkdownIt({ breaks: true, html: true, linkify: true, typographer: false });
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
  md.use(container, "tweet", { validate: (params) => params.trim() === "tweet" });
  // tweet ブロックは投稿 URL 一つだけを許可し、埋め込み用 HTML に置き換える
  md.core.ruler.push("site-tweets", (state) => {
    for (let index = 0; index < state.tokens.length; index++) {
      const token = state.tokens[index];
      if (token.type !== "container_tweet_open") continue;
      const content = state.tokens[index + 2];
      const match = content?.content.trim().match(
        /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([a-z\d_]{1,15}|i\/web)\/status\/([1-9]\d*)\/?(?:[?#][^\s]*)?$/i,
      );
      if (state.tokens[index + 1]?.type !== "paragraph_open"
        || content?.type !== "inline"
        || state.tokens[index + 3]?.type !== "paragraph_close"
        || state.tokens[index + 4]?.type !== "container_tweet_close"
        || !match) {
        throw new Error(`${state.env.source}:${token.map[0] + 1}: A "tweet" block must contain exactly one X/Twitter post URL.`);
      }
      const href = escapeHtml(`https://twitter.com/${match[1]}/status/${match[2]}`);
      const embed = new state.Token("html_block", "", 0);
      embed.block = true;
      embed.content = `<div class="tweet-embed">
<blockquote class="twitter-tweet" data-dnt="true"><a class="external-link" href="${href}" target="_blank" rel="noopener noreferrer">Xでポストを見る</a></blockquote>
</div>\n`;
      state.tokens.splice(index, 5, embed);
      state.env.hasTweets = true;
    }
  });
  md.core.ruler.push("site-links-and-headings", (state) => {
    const usedIds = new Set();
    state.tokens.forEach((token, index) => {
      if (token.type === "heading_open") {
        const text = inlineText(state.tokens[index + 1]);
        const base = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s+/g, "-") || "section";
        let id = base;
        let count = 2;
        // 同じ見出しが複数あってもページ内リンクの ID が重複しないよう連番を付ける
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
          child.attrSet("rel", "noopener noreferrer");
        }
        if (child.type === "image") {
          child.attrSet("loading", "lazy");
          child.attrSet("decoding", "async");
        }
        // インライン要素内のリンクや画像も処理対象にする
        child.children?.forEach(visit);
      };
      visit(token);
    });
  });
  return md;
}

function inlineText(token) {
  // 装飾のマークアップを除き、画像の代替テキストと改行を含む見出しの文字列を取り出す
  return (token?.children ?? []).map((child) => {
    if (child.type === "image") return child.content;
    if (child.type === "softbreak" || child.type === "hardbreak") return " ";
    return child.type === "text" || child.type === "code_inline" ? child.content : "";
  }).join("");
}

function renderPage({ title, body, url, config, notFound = false, hasTweets = false, updated }) {
  // 共通レイアウトにページ情報を埋め込み、404 は検索対象から外す
  const home = url === "/";
  const documentTitle = home ? `${config.name}` : `${title} | ${config.name}`;
  const canonical = new URL(url, config.url).href;
  return `<!doctype html>
<html lang="${escapeHtml(config.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(documentTitle)}</title>
  ${notFound ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${escapeHtml(canonical)}">`}
  <meta property="og:type" content="website">
  <meta property="og:locale" content="${escapeHtml(config.language === "ja" ? "ja_JP" : config.language)}">
  <meta property="og:site_name" content="${escapeHtml(config.name)}">
  <meta property="og:title" content="${escapeHtml(documentTitle)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="/_site/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/_site/style.css">
${config.googleAnalyticsId ? `  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${config.googleAnalyticsId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', '${config.googleAnalyticsId}');
  </script>
` : ""}</head>
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
      ${updated ? `<p class="page-updated">最終更新日時：<time datetime="${escapeHtml(updated.timestamp)}">${escapeHtml(updated.display)}</time></p>` : ""}
      ${home ? "" : '<a class="back-link" href="/"><span class="back-link-label">トップに戻る</span></a>'}
    </main>
    <footer class="site-footer">
      <nav aria-label="サイト情報">
        <ul class="footer-links">
          <li><a href="/privacy/">プライバシーポリシー</a></li>
          <li><a href="/about/">このサイトについて</a></li>
        </ul>
      </nav>
      ${escapeHtml(config.copyright)}
    </footer>
  </div>
${hasTweets ? '  <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>\n' : ""}</body>
</html>
`;
}

export async function buildSite({ root, config }) {
  if (config.googleAnalyticsId !== undefined && config.googleAnalyticsId !== "" &&
      (typeof config.googleAnalyticsId !== "string" || !/^G-[A-Z0-9]+$/.test(config.googleAnalyticsId))) {
    throw new Error("site.config.mjs: googleAnalyticsId must be a G- prefixed measurement ID or an empty string.");
  }
  const siteUrl = new URL(config.url);
  if (!["http:", "https:"].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) {
    throw new Error("site.config.mjs: url must be an absolute HTTP(S) URL without credentials.");
  }
  const contentDir = path.join(root, "content");
  const outputDir = path.join(root, "dist");
  const files = new Set(await listFiles(contentDir));
  if (!files.has("index.md")) throw new Error("content/index.md is required.");
  const pages = [...files].filter((file) => /\.md$/i.test(file));
  const outputs = new Map();
  const claim = (output, source) => {
    // 大文字と小文字の違いやファイルとディレクトリの競合も出力先の衝突として検出する
    const key = output.toLowerCase();
    for (const [existing, owner] of outputs) {
      if (key === existing || key.startsWith(`${existing}/`) || existing.startsWith(`${key}/`)) {
        throw new Error(`Output collision: ${source} and ${owner} (${output})`);
      }
    }
    outputs.set(key, source);
  };
  claim("404.html", "generated 404");
  claim("sitemap.xml", "generated sitemap");
  claim("robots.txt", "generated robots");
  claim("_site", "theme assets");
  for (const file of files) {
    const output = /\.md$/i.test(file)
      ? `${decodeURIComponent(pageUrl(file)).slice(1)}index.html`
      : file;
    claim(output, file);
  }
  const updates = await pageUpdates(root, pages);
  const md = createMarkdown(files);
  const rendered = [];
  for (const source of pages) {
    const env = { source };
    const tokens = md.parse(await readFile(path.join(contentDir, source), "utf8"), env);
    // 最初の H1 をページタイトルとして使い、見出しのないページはビルドエラーにする
    const headingIndex = tokens.findIndex((token) => token.type === "heading_open" && token.tag === "h1");
    if (headingIndex < 0) throw new Error(`${source}: Add a "# Page title" heading.`);
    const title = inlineText(tokens[headingIndex + 1]);
    rendered.push({
      output: `${decodeURIComponent(pageUrl(source)).slice(1)}index.html`,
      html: renderPage({
        title, body: md.renderer.render(tokens, md.options, env), url: pageUrl(source), config,
        hasTweets: env.hasTweets,
        updated: updates.get(source),
      }),
    });
  }
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((source) => {
    const updated = updates.get(source);
    return `  <url><loc>${escapeHtml(new URL(pageUrl(source), siteUrl).href)}</loc>${updated ? `<lastmod>${escapeHtml(updated.timestamp)}</lastmod>` : ""}</url>`;
  }).join("\n")}
</urlset>
`;
  const robots = `User-agent: *
Allow: /

Sitemap: ${new URL("/sitemap.xml", siteUrl).href}
`;
  // 全ページの検証とレンダリングが成功してから前回のビルド結果を置き換える
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
  await writeFile(path.join(outputDir, "sitemap.xml"), sitemap);
  await writeFile(path.join(outputDir, "robots.txt"), robots);
  return pages;
}
