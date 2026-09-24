# Markdown profile & link site

Markdownからプロフィール・リンクサイトの静的HTMLを生成し、GitHub ActionsからFirebase Hostingへ公開するリポジトリです。

自分のサイトを作る場合は、**フォーク後に個人情報・Firebaseの接続先を自分用に変更**してください。

## フォークして自分のサイトを公開する

1. このリポジトリをフォークします。
2. `site.config.mjs` の `name`、`description`、`url`、`copyright` を自分用に設定します。
3. `content/` フォルダの内容を削除または自分の内容に置き換えます。
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

`dist` は自動生成専用です。直接編集せず、Gitの追跡対象にも含めません。

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

```markdown
::: note
ちょっとしたお知らせ。
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

### 見出しへのリンク

見出しには自動でIDが付きます。英字は小文字、空白は `-`、記号は除去され、日本語はそのままです。
重複時は `-2`、`-3` が付きます。

```markdown
[音楽の項目へ](song/favorites.md#music)
[ページ内へ](#好きな音楽)
```

ページの存在はチェックしますが、`#` 以降の見出しの存在や外部サイトのリンク切れまではチェックしません。

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

`content/` は Copyright © 2026 daicho, **All rights reserved**（CC0対象外）です。それ以外のこのリポジトリの作者が権利を持つ部分には [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/deed.ja) が適用されます。依存ライブラリ等の第三者の権利はそれぞれのライセンスに従います。

詳細は `LICENSE` を参照してください。
