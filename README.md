# Markdown profile & link site

Markdownからプロフィール・リンクサイトの静的HTMLを生成し、GitHub ActionsからFirebase Hostingへ公開するリポジトリです。

**公開先**: https://daicho-bd.web.app/

自分のサイトを作る場合は、**フォーク後に個人情報・Firebaseの接続先を自分用に変更**してください。

## フォークして自分のサイトを公開する

1. このリポジトリをフォークします。
2. `site.config.mjs` の `name`、`description`、`url`、`copyright` を自分用に設定します。
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

各Markdownの最後に変更されたコミットの日時をGit履歴から取得し、`sitemap.xml` の `lastmod` と各ページ末尾に反映します。ページでは日本時間（Asia/Tokyo）で「最終更新日時：yyyy/mm/dd hh:mm:ss」と右寄せで表示します。ファイル名を変更した場合は変更前の履歴も追跡します。

Gitリポジトリがない場合や、未コミットの新規ファイルなど履歴がない場合は、`lastmod` とページの更新日時表示を省略します。Gitが未インストールの場合も警告を表示して省略します。未コミットの編集や共通CSS・テンプレートだけの変更は、Markdownの更新日時には反映されません。その他のGitエラーはビルドエラーになります。

公開後、Google Search Consoleにサイトを登録し、`https://<your-project-id>.web.app/sitemap.xml`（独自ドメインの場合はそのドメインの `/sitemap.xml`）を送信してください。サイトマップの送信は検索エンジンによる発見を助けますが、検索結果への掲載や順位を保証するものではありません。

## Google Analyticsでアクセス解析する

`site.config.mjs` の `googleAnalyticsId` にGA4の測定IDを設定すると、404ページを含むすべての生成HTMLの `<head>` にGoogleタグ（gtag.js）を追加します。

自分のサイトで使う場合は、[Google Analytics](https://analytics.google.com/) でGA4プロパティとウェブデータストリームを作成し、表示される `G-` で始まる測定IDに変更してください。計測を無効にする場合は `googleAnalyticsId: ""` にするか、設定項目を削除します。不正な形式のIDはビルドエラーになります。

計測を有効にすると、閲覧時にGoogleへの外部通信が発生します。Google Analyticsの利用・Cookie・データ収集についてプライバシーポリシーに記載し、対象地域や適用される規則に応じて同意取得を設定してください。

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
