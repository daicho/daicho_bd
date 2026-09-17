# daicho — Markdown link site

Markdownを書いて `main` にpushすると、HTMLに変換されてFirebase Hostingに公開される個人用リンクサイトです。
MyGO!!!!!をイメージした爽やかな水色、余白のあるシンプルなレイアウト、少量の黄色を使っています。公式のロゴ・画像・歌詞は使用していません。

**公開先（初回デプロイ後）:** https://daicho-bd.web.app

## 最初にすること

1. `content/index.md` の `https://x.com/your_handle` を自分のXのURLに変更します。プロフィール文章もサンプルなので自由に編集してください。
2. `site.config.mjs` の表示名・サイト説明を編集します。独自ドメインに変更する場合は `url` も変更してください。フッターには `Copyright © 2026 daicho` を中央に表示します。
3. 下記の「Firebase / GitHub の初回設定」を一度だけ行います。

## ローカルで表示する

Node.js 22以上（GitHub Actionsは24）を使用します。

```powershell
npm ci
npm run dev
```

http://127.0.0.1:4173 を開きます。終了は `Ctrl+C` です。
`dev` / `preview` は起動時にビルドします。起動後に `content` 内のMarkdown・画像・添付ファイル、`theme` 内のCSSなど、`site.config.mjs`、または `scripts/site.mjs` を保存すると、サイトを自動で再ビルドし、開いているブラウザーを自動で再読み込みします。Markdownの記法やリンクにエラーがある場合は、直前の正常な表示を維持しつつターミナルにエラーを表示します。開発サーバー自体を変更する `scripts/preview.mjs` の変更は、いったん `npm run dev` を終了して再起動してください。

```powershell
npm run build
```

`dist` は自動生成専用です。直接編集せず、Gitにも含めません。

## Markdownでページを作る

`content` 内の `.md` がすべてページになります。各ファイルに `# ページタイトル` を付けてください。最初のH1をページのタイトルとして使用します。すべてのページに共通ヘッダーとトップへのリンクが付きます。

| ファイル | 公開URL |
| --- | --- |
| `content/index.md` | `/` |
| `content/about.md` | `/about/` |
| `content/anime/favorites.md` | `/anime/favorites/` |
| `content/live/history.md` | `/live/history/` |

たとえば `content/notes/live.md` を追加します。

```markdown
# ライブの記録

ここに好きなだけMarkdownを書けます。

## 感想

**太字**、リスト、引用、画像、表、コードブロックなどが使えます。

[トップへ](../index.md)
[好きなアニメ](../anime/favorites.md)
```

トップページなどに `[ライブの記録](notes/live.md)` と書けば、ビルド時に `/notes/live/` に変換されます。
リンクは **Markdownファイルから見た相対パス**、または `content` をルートとした `/about.md` のようなパスで書きます。Markdown内のURL区切りは、Windowsでも `/` を使用してください。

リンクされていないMarkdownも公開されます。下書きや秘密情報は `content` に置かないでください。
存在しないローカルページ・画像・ファイルへのリンクや、同じURLになるファイル（例: `notes.md` と `notes/index.md`）はビルドエラーにします。

### ページラベル

`::: label` ブロックを置いた位置にページラベルを表示できます。ブロックを置かなければ、ページラベルは表示されません。

```markdown
::: label
MY FAVORITES
:::

# 好きなもの
```

### リンクカード

`markdown-it-container` の `link` コンテナーを使うと、そのブロックが大きなリンクカードになります。
カードごとにリンクを1つ置き、続く行に説明文を書きます。カード全体をタップできます。

```markdown
::: link
[X / Twitter](https://x.com/your_handle)
日々のこと、好きな音楽のこと。
:::

::: link
[自己紹介](about.md)
私について。
:::
```

### 補足ボックス

```markdown
::: note
ちょっとしたお知らせ。**太字**も使えます。
:::
```

### 画像・添付ファイル

画像やPDFは、たとえば `content/assets` に置きます（フォルダーは必要に応じて作成）。

```markdown
![プロフィール画像](assets/avatar.webp)
[PDFを見る](assets/profile.pdf)
```

`content` 内のMarkdown以外のファイルも、同じ相対パスで公開されます。ドットで始まるファイル・フォルダーは除外します。
`_site`、`404.html`、生成先の `index.html` は予約済みです。
HTMLの直接埋め込みは無効です。装飾はMarkdownとコンテナーで記述し、サイト全体の見た目は `theme/style.css` で調整します。外部画像はHTTPSを使用してください。

### 見出しへのリンク

見出しには自動でIDが付きます。英字は小文字、空白は `-`、記号は除去され、日本語はそのままです。
重複時は `-2`、`-3` が付きます。

```markdown
[音楽の項目へ](song/favorites.md#music)
[ページ内へ](#好きな音楽)
```

ページの存在はチェックしますが、`#` 以降の見出しの存在や外部サイトのリンク切れまではチェックしません。

## Firebase / GitHub の初回設定

Firebaseプロジェクト `daicho-bd` を使用する設定済みです。
Firebase Consoleの **Hosting** でデフォルトサイトが利用可能なことを確認してください。
認証情報は同梱していないため、初回公開には以下の準備が必要です。

### ローカルから手動で公開

```powershell
firebase login
npm run deploy
```

これでビルドして `daicho-bd` のHostingだけをデプロイします。Firestoreなどは変更しません。

### GitHub Actionsの認証を設定

既存の `.github/workflows/deploy.yml` は、リポジトリSecret **`FIREBASE_SERVICE_ACCOUNT_DAICHO_BD`** を参照します。

1. [Google Cloudのサービスアカウント画面](https://console.cloud.google.com/iam-admin/serviceaccounts?project=daicho-bd) で、`daicho-bd` にHostingデプロイ専用のサービスアカウントを作成します。プロジェクトへのロールは **Firebase Hosting Admin** (`roles/firebasehosting.admin`) と **API Keys Viewer** (`roles/serviceusage.apiKeysViewer`) を付与します。本サイトは本番Hostingのみを使うため、Firebase AuthenticationやCloud Runの管理権限は不要です。
2. 作成したサービスアカウントの「キー」からJSONキーを発行します。キーはリポジトリ外に保存し、内容をチャット・Markdown・ソースコードに貼らないでください。
3. [このリポジトリのActions Secrets](https://github.com/daicho/daicho_bd/settings/secrets/actions) で **New repository secret** を開き、Nameを `FIREBASE_SERVICE_ACCOUNT_DAICHO_BD`、SecretをJSONファイルの内容全体にして保存します。設定後、不要なローカルのキーのコピーは削除してください。

組織ポリシーでJSONキーの発行が禁止されている場合は、管理者に確認してください。キーをGitに含める方法で回避しないでください。

Firebase公式CLIの `firebase init hosting:github --project daicho-bd` でサービスアカウントとSecretを自動作成する方法もあります。ただし追加ワークフローが生成されるため、二重デプロイを避けるには既存の `deploy.yml` に一本化し、参照するSecret名を一致させてください。通常のセットアップでは上記の手動Secret設定だけで十分です。

参考: [Firebase公式のGitHub連携](https://firebase.google.com/docs/hosting/github-integration)、[公式Actionのサービスアカウント設定](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md)。

### pushで公開

Secret設定後、変更をコミットして `main` にpushします。

```powershell
git add .
git commit -m "Set up Markdown link site"
git push -u origin main
```

以降はMarkdownの変更をpushするだけです。

- **`main`へのpush:** 依存関係の導入 → HTML生成 → Firebase Hosting本番公開。
- **`main`向けPull Request:** HTML生成のみ。認証情報は使わず、本番にもプレビューにもデプロイしません。
- **Actionsから手動実行:** `main` を選ぶと本番公開できます。他のブランチはビルドのみです。

[Actions画面](https://github.com/daicho/daicho_bd/actions) で結果を確認できます。認証Secretが未設定なら、デプロイ工程が明示的に失敗します。ビルドが失敗した場合も、既存の公開サイトは更新されません。

Firebaseの設定はSPA用の全URL書き換えをせず、各ページのHTMLを配信します。存在しないページは、トップへのリンクを付けた404ページになります。

## ファイル構成

```text
content/                編集するMarkdown・画像
theme/                  共通CSS・favicon
scripts/                静的HTML生成・ローカルプレビュー
site.config.mjs         表示名・説明・公開URL
firebase.json           Hosting設定
.firebaserc             FirebaseプロジェクトID
.github/workflows/      push時の自動ビルド・デプロイ
dist/                   生成された公開ファイル（Git管理外）
```
