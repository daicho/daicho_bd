import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildSite, pageUrl } from "../scripts/site.mjs";

const config = {
  name: 'daicho & "links"',
  tagline: "好きなものを、好きな言葉で。",
  description: 'A <small> site & "notes"',
  language: "ja",
  url: "https://daicho-bd.web.app",
};

async function fixture(t, files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "daicho-site-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "theme"), { recursive: true });
  await writeFile(path.join(root, "theme", "style.css"), "body { color: blue; }");
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, "content", name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return root;
}

test("maps root, nested, index and Japanese Markdown paths", () => {
  assert.equal(pageUrl("index.md"), "/");
  assert.equal(pageUrl("about.md"), "/about/");
  assert.equal(pageUrl("notes/live.md"), "/notes/live/");
  assert.equal(pageUrl("notes/index.md"), "/notes/");
  assert.equal(pageUrl("音楽.md"), "/%E9%9F%B3%E6%A5%BD/");
});

test("builds pages, containers, assets, metadata and home navigation", async (t) => {
  const root = await fixture(t, {
    "index.md": "# Home\n\n::: links\n- [About](about.md)\n  Read about me.\n:::\n\n::: note\n**Hello**\n:::\n",
    "about.md": "# About *me*\n\n[Home](index.md)\n\n![Cover](assets/cover.svg)\n",
    "assets/cover.svg": "<svg></svg>",
  });
  assert.deepEqual(await buildSite({ root, config }), ["about.md", "index.md"]);
  const home = await readFile(path.join(root, "dist", "index.html"), "utf8");
  const about = await readFile(path.join(root, "dist", "about", "index.html"), "utf8");
  assert.match(home, /class="link-cards"/);
  assert.match(home, /href="\/about\/"/);
  assert.match(home, /class="note"/);
  assert.match(home, /<strong>Hello<\/strong>/);
  assert.match(home, /<html lang="ja">/);
  assert.match(home, /daicho &amp; &quot;links&quot;/);
  assert.match(home, /content="A &lt;small&gt; site &amp; &quot;notes&quot;"/);
  assert.match(about, /<title>About me \|/);
  assert.match(about, /<header[\s\S]*href="\/"[\s\S]*<\/header>/);
  assert.match(about, /class="back-link" href="\/"/);
  assert.match(about, /src="\/assets\/cover.svg"/);
  assert.match(about, /loading="lazy"/);
  assert.match(about, /href="https:\/\/daicho-bd.web.app\/about\/"/);
  assert.equal(await readFile(path.join(root, "dist", "assets", "cover.svg"), "utf8"), "<svg></svg>");
  assert.match(await readFile(path.join(root, "dist", "_site", "style.css"), "utf8"), /color: blue/);
  const missing = await readFile(path.join(root, "dist", "404.html"), "utf8");
  assert.match(missing, /name="robots" content="noindex"/);
  assert.match(missing, /class="back-link" href="\/"/);
});

test("rewrites relative nested links, queries and fragments without changing external URLs", async (t) => {
  const root = await fixture(t, {
    "index.md": "# Home",
    "音楽.md": "# 音楽",
    "notes/index.md": "# Notes",
    "notes/live.md": `# Live
[Home](../index.md)
[Music](../音楽.md?from=notes#音楽)
[Notes](index.md)
[Root-relative](/音楽.md)
[Clean URL](/notes/)
[Self](#live)
[Query](?view=all)
[X](https://x.com/your_handle)
[Mail](mailto:hello@example.com)
![Cover](../assets/cover.svg)
`,
    "assets/cover.svg": "<svg></svg>",
  });
  await buildSite({ root, config });
  const html = await readFile(path.join(root, "dist", "notes", "live", "index.html"), "utf8");
  assert.match(html, /href="\/">Home/);
  assert.match(html, /href="\/%E9%9F%B3%E6%A5%BD\/\?from=notes#%E9%9F%B3%E6%A5%BD"/);
  assert.match(html, /href="\/notes\/">Notes/);
  assert.match(html, /href="\/notes\/">Clean URL/);
  assert.match(html, /href="#live"/);
  assert.match(html, /href="\?view=all"/);
  assert.match(html, /href="https:\/\/x.com\/your_handle"/);
  assert.match(html, /href="mailto:hello@example.com"/);
  assert.match(html, /src="\/assets\/cover.svg"/);
});

test("escapes raw HTML, rejects executable links and assigns unique heading anchors", async (t) => {
  const root = await fixture(t, {
    "index.md": `# Hello
<script>alert("bad")</script>

[Unsafe](javascript:alert(1))

## 好きな音楽
## 好きな音楽
## Hello *world*
## Hello world
`,
  });
  await buildSite({ root, config });
  const html = await readFile(path.join(root, "dist", "index.html"), "utf8");
  assert.doesNotMatch(html, /<script>|href="javascript:/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /id="好きな音楽"/);
  assert.match(html, /id="好きな音楽-2"/);
  assert.match(html, /id="hello-world"/);
  assert.match(html, /id="hello-world-2"/);
});

test("preserves the five exclamation marks in MyGO!!!!!", async (t) => {
  const root = await fixture(t, {
    "index.md": "# MyGO!!!!!\n\n**MyGO!!!!!** が好き。",
  });
  await buildSite({ root, config });
  const html = await readFile(path.join(root, "dist", "index.html"), "utf8");
  assert.match(html, /<h1 id="mygo">MyGO!!!!!<\/h1>/);
  assert.match(html, /<strong>MyGO!!!!!<\/strong>/);
});

for (const [name, files, error] of [
  ["missing home", { "about.md": "# About" }, /index.md is required/],
  ["missing title", { "index.md": "No title" }, /Page title/],
  ["broken page", { "index.md": "# Home\n[Missing](missing.md)" }, /Markdown page not found/],
  ["broken image", { "index.md": "# Home\n![Missing](assets/missing.png)" }, /Local link or image not found/],
  ["broken clean URL", { "index.md": "# Home\n[Missing](/missing/)" }, /Local link or image not found/],
  ["escaping content", { "index.md": "# Home\n[Outside](../outside.md)" }, /escapes the content/],
  ["invalid encoding", { "index.md": "# Home\n[Invalid](bad%FF.md)" }, /Invalid URL encoding/],
  ["duplicate routes", { "index.md": "# Home", "notes.md": "# Notes", "notes/index.md": "# Notes" }, /Output collision/],
  ["case collisions", { "index.md": "# Home", "About.md": "# About", "about/index.md": "# About" }, /Output collision/],
  ["reserved asset path", { "index.md": "# Home", "_site/style.css": "" }, /Output collision/],
  ["page asset collision", { "index.md": "# Home", "index.html": "" }, /Output collision/],
  ["reserved 404", { "index.md": "# Home", "404.html": "" }, /Output collision/],
]) {
  test(`fails explicitly for ${name}`, async (t) => {
    const root = await fixture(t, files);
    await assert.rejects(buildSite({ root, config }), error);
  });
}

test("removes stale outputs but preserves the previous build on invalid Markdown", async (t) => {
  const root = await fixture(t, { "index.md": "# Home", "old.md": "# Old" });
  await buildSite({ root, config });
  await rm(path.join(root, "content", "old.md"));
  await buildSite({ root, config });
  await assert.rejects(readFile(path.join(root, "dist", "old", "index.html")), { code: "ENOENT" });
  const previous = await readFile(path.join(root, "dist", "index.html"), "utf8");
  await writeFile(path.join(root, "content", "index.md"), "# Home\n[Broken](missing.md)");
  await assert.rejects(buildSite({ root, config }), /Markdown page not found/);
  assert.equal(await readFile(path.join(root, "dist", "index.html"), "utf8"), previous);
});
