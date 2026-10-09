import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import MarkdownIt from "markdown-it";
import container from "markdown-it-container";
import { parseDocument } from "yaml";

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

function parseFrontMatter(markdown, source) {
  // ファイル先頭の YAML だけを本文から分離し、BOM・CRLF にも対応する
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0] !== "---") return { body: markdown, metadata: {}, lineOffset: 0 };
  const end = lines.findIndex((line, index) => index > 0 && line === "---");
  if (end < 0) throw new Error(`${source}: Front Matter must end with "---".`);
  const document = parseDocument(lines.slice(1, end).join("\n"), { schema: "core" });
  if (document.errors.length || document.warnings.length) {
    throw new Error(`${source}: Invalid Front Matter: ${(document.errors[0] ?? document.warnings[0]).message}`);
  }
  let metadata;
  try {
    // 空の Front Matter は許可するが、YAML エイリアスの展開は許可しない
    metadata = document.contents === null ? {} : document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new Error(`${source}: Invalid Front Matter: ${error.message}`, { cause: error });
  }
  // 設定の誤記を見逃さないよう、対応項目と値の型を入れ子も含めて検証する
  const validate = (value, fields, prefix) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${source}: ${prefix || "Front Matter"} must be a mapping.`);
    }
    for (const [key, entry] of Object.entries(value)) {
      const field = `${prefix}${key}`;
      if (!fields.includes(key)) throw new Error(`${source}: Unknown Front Matter field: ${field}`);
      if (key === "og") {
        validate(entry, ["title", "description", "type", "image", "imageAlt"], "og.");
      } else if (key === "twitter") {
        validate(entry, ["card", "title", "description", "image", "imageAlt", "site", "creator"], "twitter.");
      } else if (typeof entry !== "string" || !entry.trim()) {
        throw new Error(`${source}: ${field} must be a non-empty string.`);
      }
    }
  };
  validate(metadata, ["title", "description", "og", "twitter"], "");
  if (metadata.og?.type && !["website", "article", "profile"].includes(metadata.og.type)) {
    throw new Error(`${source}: og.type must be website, article, or profile.`);
  }
  if (metadata.twitter?.card && !["summary", "summary_large_image"].includes(metadata.twitter.card)) {
    throw new Error(`${source}: twitter.card must be summary or summary_large_image.`);
  }
  for (const field of ["site", "creator"]) {
    if (metadata.twitter?.[field] && !/^@[a-z\d_]{1,15}$/i.test(metadata.twitter[field])) {
      throw new Error(`${source}: twitter.${field} must be an @ prefixed X account name.`);
    }
  }
  // 除いた行数を保持し、Markdown のエラー位置を元ファイルの行番号で報告する
  return { body: lines.slice(end + 1).join("\n"), metadata, lineOffset: end + 1 };
}

function metadataImage(href, source, files, siteUrl) {
  // 本文と同じ規則でローカルパスを解決し、ページではなく添付ファイルか確認する
  if (href === undefined) return undefined;
  let resolved = href;
  if (!/^(?:https?:\/\/|\/\/)/i.test(href)) {
    if (/^(?:[a-z][a-z\d+.-]*:|#|\?)/i.test(href)) {
      throw new Error(`${source}: Metadata images must use HTTP(S) URLs or local image paths.`);
    }
    resolved = rewriteLink(href, source, files);
    const target = decodeURIComponent(resolved.split(/[?#]/)[0]).slice(1);
    if (!files.has(target) || /\.md$/i.test(target)) {
      throw new Error(`${source}: Metadata image must reference an asset: ${href}`);
    }
  }
  // SNS が取得できる絶対 URL に揃え、認証情報付き URL や HTTP(S) 以外を拒否する
  let image;
  try {
    image = new URL(resolved, siteUrl);
  } catch (error) {
    throw new Error(`${source}: Invalid metadata image URL: ${href}`, { cause: error });
  }
  if (!["http:", "https:"].includes(image.protocol) || image.username || image.password) {
    throw new Error(`${source}: Metadata images must use HTTP(S) URLs without credentials.`);
  }
  return image.href;
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
        throw new Error(`${state.env.source}:${token.map[0] + 1 + state.env.lineOffset}: A "tweet" block must contain exactly one X/Twitter post URL.`);
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

function renderPage({ title, body, url, config, metadata = {}, notFound = false, hasTweets = false, updated }) {
  // 共通レイアウトにページ情報を埋め込み、404 は検索対象から外す
  const home = url === "/";
  const documentTitle = metadata.title ?? (home ? `${config.name}` : `${title} | ${config.name}`);
  const canonical = new URL(url, config.url).href;
  // ページ設定を優先し、description はサイト設定、OGP・X は共通の値を引き継ぐ
  const description = metadata.description ?? config.description;
  const og = metadata.og ?? {};
  const twitter = metadata.twitter ?? {};
  const ogTitle = og.title ?? documentTitle;
  const ogDescription = og.description ?? description;
  const twitterImage = twitter.image ?? og.image;
  // X 専用画像には、別画像の OGP 代替テキストを流用しない
  const twitterImageAlt = twitter.imageAlt ?? (twitter.image === undefined ? og.imageAlt : undefined);
  // 未設定のタグは省略し、メタデータを HTML 属性として安全に埋め込む
  const meta = (attribute, name, value) => value === undefined || value === ""
    ? "" : `  <meta ${attribute}="${name}" content="${escapeHtml(value)}">\n`;
  const websiteId = new URL("/#website", config.url).href;
  const pageId = `${canonical}#webpage`;
  const author = config.author ? { "@type": "Person", name: config.author } : undefined;
  const pageData = {
    "@type": og.type === "profile" ? "ProfilePage" : "WebPage",
    "@id": pageId,
    url: canonical,
    name: ogTitle,
    description: ogDescription || undefined,
    inLanguage: config.language,
    isPartOf: { "@id": websiteId },
    image: og.image,
    dateModified: updated?.timestamp,
    author,
  };
  const graph = [
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: new URL("/", config.url).href,
      name: config.name,
      inLanguage: config.language,
      author,
    },
    pageData,
  ];
  if (og.type === "article") {
    const articleId = `${canonical}#article`;
    pageData.mainEntity = { "@id": articleId };
    graph.push({
      "@type": "Article",
      "@id": articleId,
      url: canonical,
      headline: ogTitle,
      description: ogDescription || undefined,
      inLanguage: config.language,
      image: og.image,
      dateModified: updated?.timestamp,
      mainEntityOfPage: { "@id": pageId },
      author,
    });
  }
  // script 内は HTML エンティティではなく JSON のエスケープで閉じタグを無害化する
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": graph })
    .replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${escapeHtml(config.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(documentTitle)}</title>
${meta("name", "description", description)}\
  ${notFound ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${escapeHtml(canonical)}">`}
  <meta property="og:type" content="${escapeHtml(og.type ?? "website")}">
  <meta property="og:locale" content="${escapeHtml(config.language === "ja" ? "ja_JP" : config.language)}">
  <meta property="og:site_name" content="${escapeHtml(config.name)}">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
${meta("property", "og:description", ogDescription)}\
${meta("property", "og:image", og.image)}\
${meta("property", "og:image:alt", og.image ? og.imageAlt : undefined)}\
  <meta name="twitter:card" content="${escapeHtml(twitter.card ?? (twitterImage ? "summary_large_image" : "summary"))}">
${meta("name", "twitter:title", twitter.title ?? ogTitle)}\
${meta("name", "twitter:description", twitter.description ?? ogDescription)}\
${meta("name", "twitter:image", twitterImage)}\
${meta("name", "twitter:image:alt", twitterImage ? twitterImageAlt : undefined)}\
${meta("name", "twitter:site", twitter.site)}\
${meta("name", "twitter:creator", twitter.creator)}\
${notFound ? "" : `  <script type="application/ld+json">${jsonLd}</script>\n`}\
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
  if (config.author !== undefined && (typeof config.author !== "string" || !config.author.trim())) {
    throw new Error("site.config.mjs: author must be a non-empty string.");
  }
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
    // Front Matter を本文のパース前に取り出し、共有画像を検証してからレンダリングする
    const { body, metadata, lineOffset } = parseFrontMatter(await readFile(path.join(contentDir, source), "utf8"), source);
    for (const group of ["og", "twitter"]) {
      if (metadata[group]?.image !== undefined) {
        metadata[group].image = metadataImage(metadata[group].image, source, files, siteUrl);
      }
    }
    const env = { source, lineOffset };
    const tokens = md.parse(body, env);
    // 最初の H1 をページタイトルとして使い、見出しのないページはビルドエラーにする
    const headingIndex = tokens.findIndex((token) => token.type === "heading_open" && token.tag === "h1");
    if (headingIndex < 0) throw new Error(`${source}: Add a "# Page title" heading.`);
    const title = inlineText(tokens[headingIndex + 1]);
    rendered.push({
      output: `${decodeURIComponent(pageUrl(source)).slice(1)}index.html`,
      html: renderPage({
        title, body: md.renderer.render(tokens, md.options, env), url: pageUrl(source), config, metadata,
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
