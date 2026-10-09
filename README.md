# Markdown profile & link site

Markdownからプロフィール・リンクサイトの静的HTMLを生成し、GitHub ActionsからFirebase Hostingへ公開するリポジトリです。

**公開先**: https://daicho-bd.web.app/

自分のサイトを作る場合は、**フォーク後に個人情報・Firebaseの接続先を自分用に変更**してください。

## フォークして自分のサイトを公開する

1. このリポジトリをフォークします。
2. `site.config.mjs` の `name`、`author`、`description`、`url`、`copyright` を自分用に設定します。
   `googleAnalyticsId` も自分のGA4測定IDに変更するか、計測しない場合は空文字列にしてください。
3. `content/` の内容を削除または自分の内容に置き換えます。
4. サイト全体の見た目は `theme/style.css` で調整します。
5. HTMLテンプレートなど細かい設定は `scripts/site.mjs` で変更します。
6. 「Firebase / GitHub の初回設定」に従い、自分のFirebaseプロジェクトを接続して公開します。

## ローカルで表示する

Node.jsを使用します。フォークしたリポジトリのルートで実行してください。

```powershell
npm ci
npm run dev
```

http://127.0.0.1:4173 を開きます。終了は `Ctrl+C` です。

`dev` は起動時にビルドします。起動後にサイトの内容を変更すると、自動で再ビルドし、開いているブラウザーを再読み込みします。
Markdownの記法やリンクにエラーがある場合は、ターミナルにエラーを表示します。

## Markdownでページを作る

`content` 内の `.md` がすべてページになります。各ファイルに `# ページタイトル` を付けてください。最初のH1をページのタイトルとして使用します。

| ファイル | 公開URL |
| --- | --- |
| `content/index.md` | `/` |
| `content/hoge/fuga.md` | `/hoge/fuga/` |
| `content/piyo/index.md` | `/piyo/` |

存在しないページは、トップへのリンクを付けた404ページになります。

### Front Matter（ページごとのメタデータ）

Markdownの**先頭**に `---` で囲んだYAMLを書くと、descriptionやOGP、X（Twitter）カードを設定できます。Front Matter自体は本文には表示されません。

```markdown
---
title: 自己紹介 | だいちょ
description: 趣味や好きなものを紹介するページです。
og:
  type: profile
  title: だいちょの自己紹介
  description: 好きな音楽や作品をまとめました。
  image: assets/profile.jpg
  imageAlt: プロフィール画像
twitter:
  card: summary_large_image
  site: "@your_handle"
  creator: "@your_handle"
---

# 自己紹介
```

| 項目 | 用途・未指定時の動作 |
| --- | --- |
| `title` | HTMLのタイトルをそのまま指定。未指定なら従来どおり、トップはサイト名、それ以外は最初のH1とサイト名。本文のH1は変更しません。 |
| `description` | `meta name="description"`。未指定なら `site.config.mjs` の `description` を使用し、どちらもなければ省略。 |
| `og.title` / `og.description` | OGP専用のタイトル・説明。未指定ならHTMLのタイトル・description。 |
| `og.type` | `website`（既定）、`article`、`profile`。 |
| `og.image` / `og.imageAlt` | OGP画像と代替テキスト。画像未指定なら画像タグは省略。 |
| `twitter.title` / `twitter.description` | Xカード専用のタイトル・説明。未指定ならOGPの値。 |
| `twitter.image` / `twitter.imageAlt` | Xカード専用の画像と代替テキスト。画像未指定ならOGP画像・代替テキストを使用。別画像を指定した場合、代替テキストも別途指定してください。 |
| `twitter.card` | `summary` または `summary_large_image`。未指定なら画像がある場合は `summary_large_image`、なければ `summary`。 |
| `twitter.site` / `twitter.creator` | サイト・作者のXアカウント。`"@your_handle"` のように引用符で囲みます。未指定なら省略。 |

すべての項目は任意です。Front Matterがなくても、これまでのMarkdownはそのまま使えます。`# ページタイトル` は引き続き必要です。

画像はMarkdownからの相対パス、`content` をルートとした `/assets/profile.jpg`、またはHTTP(S)の外部URLで指定できます。ローカルファイルの存在を確認し、共有用に絶対URLへ変換します。外部画像の存在は確認しません。
`og:url` とcanonicalは公開URLから、`og:site_name` と `og:locale` はサイト設定から自動生成します。

不正なYAML、未対応の項目、文字列以外や空の値、不正なカード種別・画像パスはファイル名付きのビルドエラーになります。複数行の説明にはYAMLの `>-` が使えます。

### リンク

例えば、`[ライブの記録](notes/live.md)` と書けば、ビルド時に `/notes/live/` に変換されます。
リンクは **Markdownファイルから見た相対パス**、または `content` をルートとした `/about.md` のようなパスで書きます。

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

`::: link` ブロックを使うと、そのブロックが大きなリンクカードになります。
カードごとにリンクを1つ置き、続く行に説明文を書きます。カード全体をタップできます。

HTTP(S) の外部リンクには外部リンクアイコンが表示され、新しいタブで開きます。
サイト内リンクの場合は外部リンクアイコンを表示せず、同じタブで開きます。

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

`::: note` ブロックを使うと、補足用のボックスが表示されます。

```markdown
::: note
ちょっとしたお知らせ。
:::
```

### Xのポストの埋め込み

`::: tweet` ブロック内にポストのURLを1つだけ書くと、X公式の埋め込みを表示します。APIキーは不要です。

```markdown
::: tweet
https://x.com/your_handle/status/1234567890123456789
:::
```

`twitter.com` のURLにも対応します。共有URLのクエリパラメーターは取り除きます。
ポスト以外のURLや、URL以外の文章・複数のURLを含むブロックはビルドエラーになります。

埋め込みがあるページだけX公式のスクリプトを読み込み、閲覧時にXへの外部通信が発生します。
JavaScriptが無効・ブロックされている場合は「Xでポストを見る」リンクが表示されます。

### 画像・添付ファイル

画像やPDFは、たとえば `content/assets` に置きます（フォルダーは必要に応じて作成）。

```markdown
![プロフィール画像](assets/avatar.webp)
[PDFを見る](assets/profile.pdf)
```

`content` 内のMarkdown以外のファイルも、同じ相対パスで公開されます。ドットで始まるファイル・フォルダーは除外します。
`_site`、`404.html`、`sitemap.xml`、`robots.txt`、生成先の `index.html` は予約済みです。

### 見出しへのリンク

見出しには自動でIDが付きます。英字は小文字、空白は `-`、記号は除去され、日本語はそのままです。
重複時は `-2`、`-3` が付きます。

```markdown
[音楽の項目へ](song/favorites.md#music)
[ページ内へ](#好きな音楽)
```

ページの存在はチェックしますが、`#` 以降の見出しの存在や外部サイトのリンク切れまではチェックしません。

## サイトマップと検索エンジン向け設定

ビルド時に `dist/sitemap.xml` と `dist/robots.txt` を自動生成します。どちらも通常のデプロイに含まれるため、手動で作成・更新する必要はありません。

- **`sitemap.xml`**: すべての公開Markdownページの正規URLを掲載します。404ページや画像などの添付ファイルは含めません。ページの追加・削除は次回ビルド時に反映されます。
- **`robots.txt`**: すべてのクローラーにサイト全体の巡回を許可し、サイトマップのURLを案内します。

URLは `site.config.mjs` の `url` を基準に生成します。

### JSON-LD（構造化データ）

公開Markdownページの `<head>` にJSON-LDを自動生成します。サイトは `WebSite`、通常ページは `WebPage`、`og.type: profile` のページは `ProfilePage` として出力し、`og.type: article` のページには `Article` も追加します。タイトル・説明・画像はOGPと同じ値を使用します。404ページには出力しません。

`site.config.mjs` の `author`（例: `author: "だいちょ"`）を、サイト・各ページ・記事の `author` と `publisher` に同じ `Person` 型で出力します。`publisher` の個別設定は不要です。`author` が未指定なら両方を省略し、空文字列や文字列以外はビルドエラーになります。ページと記事の `datePublished`・`dateModified` は以下のGit履歴から取得します。

### 公開日時・更新日時

各Markdownの最初のコミット日時を公開日時、最後に変更されたコミット日時を更新日時として取得します。いずれもコミッター日時を使用し、ファイル名を変更した場合は変更前の履歴も追跡します。公開日時は実際のデプロイ日時ではなく、Git履歴上でファイルが最初に記録された日時です。

各ページ末尾には、日本時間（Asia/Tokyo）で「最終更新日時：yyyy/mm/dd hh:mm:ss」を右寄せで表示します。

Gitリポジトリがない場合や、未コミットの新規ファイルなど履歴がない場合は、JSON-LDの日時、`lastmod` とページの日時表示を省略します。Gitが未インストールの場合も警告を表示して省略します。未コミットの編集や共通CSS・テンプレートだけの変更は、Markdownの日時には反映されません。その他のGitエラーはビルドエラーになります。浅いクローンでは公開日時が不正確になるため、Git履歴全体を取得してください。

公開後、Google Search Consoleにサイトを登録し、`https://<your-project-id>.web.app/sitemap.xml`（独自ドメインの場合はそのドメインの `/sitemap.xml`）を送信してください。サイトマップの送信は検索エンジンによる発見を助けますが、検索結果への掲載や順位を保証するものではありません。

## Google Analyticsでアクセス解析する

`site.config.mjs` の `googleAnalyticsId` にGA4の測定IDを設定すると、404ページを含むすべての生成HTMLの `<head>` にGoogleタグ（gtag.js）を追加します。

自分のサイトで使う場合は、[Google Analytics](https://analytics.google.com/) でGA4プロパティとウェブデータストリームを作成し、表示される `G-` で始まる測定IDに変更してください。計測を無効にする場合は `googleAnalyticsId: ""` にするか、設定項目を削除します。不正な形式のIDはビルドエラーになります。

計測を有効にすると、閲覧時にGoogleへの外部通信が発生します。Google Analyticsの利用・Cookie・データ収集についてプライバシーポリシーに記載してください。

## フッターとサイト情報

すべての生成ページのフッターに「プライバシーポリシー」と「このサイトについて」へのリンクを横並びで表示します。それぞれ `content/privacy.md`（`/privacy/`）と `content/about.md`（`/about/`）を編集すると、ページの内容を変更できます。

フォークして利用する場合は、プライバシーポリシーの運営者・問い合わせ先・利用サービス・情報の取り扱い・制定日を自分のサイトの実態に合わせて変更してください。

## Firebase / GitHub の初回設定

1. [Firebase Console](https://console.firebase.google.com/) で自分のFirebaseプロジェクトを作成し、**Hosting** を有効にします。FirebaseプロジェクトIDを控えます（以下では `<your-project-id>` と表記）。
2. フォーク内の `.firebaserc` の `projects.default` を `<your-project-id>` に変更します。
3. `site.config.mjs` の `url` を `https://<your-project-id>.web.app`（または自分の独自ドメイン）に設定します。
4. 以下の手順でGitHub Actions用の認証Secretを設定します。

### GitHub Actionsの認証を設定

既存の `.github/workflows/deploy.yml` は、リポジトリSecret **`FIREBASE_SERVICE_ACCOUNT`** を参照します。

1. [Google Cloudのサービスアカウント画面](https://console.cloud.google.com/iam-admin/serviceaccounts) で、**自分のプロジェクト**にHostingデプロイ専用のサービスアカウントを作成します。プロジェクトへのロールは **Firebase Hosting Admin** (`roles/firebasehosting.admin`) と **API Keys Viewer** (`roles/serviceusage.apiKeysViewer`) を付与します。
2. 作成したサービスアカウントの「キー」からJSONキーを発行します。
3. フォークしたリポジトリの Settings → Secrets and variables → Actions で **New repository secret** を開き、Nameを `FIREBASE_SERVICE_ACCOUNT`、SecretをJSONファイルの内容全体にして保存します。

### ローカルから手動で公開

Firebase CLIでログイン後、以下のコマンドを実行します。

```powershell
npm ci
firebase login
npm run deploy
```

Firebase CLIが未インストールの場合は `npm install -g firebase-tools` で導入してください。これでビルドして設定したプロジェクトのHostingだけをデプロイします。

手動デプロイだけを使う場合、GitHub Actions用のSecretは不要です。

### pushで公開

フォークのActionsが有効になっていることとSecretの設定を確認し、`main` にpushします。**元のコンテンツを置き換え終えてから**pushしてください。

以降はMarkdownの変更をpushするだけです。

- **`main`へのpush:** 依存関係の導入 → HTML生成 → Firebase Hosting本番公開。
- **`main`向けPull Request:** HTML生成のみ。認証情報は使わず、本番にもプレビューにもデプロイしません。
- **Actionsから手動実行:** `main` を選ぶと本番公開できます。他のブランチはビルドのみです。

フォークの **Actions** 画面で結果を確認し、`https://<your-project-id>.web.app` にアクセスしてください。認証Secretが未設定なら、デプロイ工程が明示的に失敗します。ビルドが失敗した場合も、既存の公開サイトは更新されません。

## ファイル構成

```text
content/                編集するMarkdown・画像
theme/                  共通CSS・favicon
scripts/                静的HTML生成・ローカルプレビュー
site.config.mjs         表示名・説明・公開URL・フッターの著作権表示
firebase.json           Hosting設定
.firebaserc             FirebaseプロジェクトID
.github/workflows/      push時の自動ビルド・デプロイ
dist/                   生成された公開ファイル（Git管理外）
```

## ライセンス

`content/` の内容についてはすべての権利をだいちょが保有します。それ以外の部分については CC0 1.0 が適用されます。

詳細は `LICENSE` を参照してください。
