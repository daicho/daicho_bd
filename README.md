# Markdown profile & link site

Markdownからプロフィール・リンクサイトの静的HTMLを生成し、GitHub ActionsからFirebase Hostingへ公開するリポジトリです。

自分のサイトを作る場合は、**フォーク後に個人情報・Firebaseの接続先を自分用に変更**してください。

## フォークして自分のサイトを公開する

1. このリポジトリをフォークします。
2. `content/` フォルダの内容を削除または自分の内容に置き換えます。
3. `site.config.mjs` の `name`、`description`、`url`、`copyright`（フッターの表示文言）を自分用に設定します。READMEやサイトの説明文に残る元のサイト向けの記述も見直します。
4. 次の「Firebase / GitHub の初回設定」に従い、**自分のFirebaseプロジェクト**を接続して公開します。

`LICENSE` のCC0は `content/` には適用されません。元の作者のプロフィールや画像などのコンテンツは自分のものに置き換えてください。`theme/` とその他の作者保有部分はCC0 1.0で利用できます。自分が追加した素材の権利表記は、自分の公開方針や各素材の権利に合わせて決めてください。

## ローカルで表示する

Node.js 22以上（GitHub Actionsは24）を使用します。フォークしたリポジトリのルートで実行してください。

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
HTTP(S) の外部リンクには外部リンクアイコンが表示され、新しいタブで開きます。サイト内リンクにはアイコンを表示せず、同じタブで開きます。

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

1. [Firebase Console](https://console.firebase.google.com/) で自分のFirebaseプロジェクトを作成し、**Hosting** を有効にします。FirebaseプロジェクトIDを控えます（以下では `<your-project-id>` と表記）。
2. フォーク内の `.firebaserc` の `projects.default` を `<your-project-id>` に変更します。手動デプロイもGitHub Actionsもこの値を使用するため、元の値 `daicho-bd` のままにしないでください。`firebase.json` は公開先ディレクトリ `dist` などのHosting設定で、通常は変更不要です。
3. `site.config.mjs` の `url` を `https://<your-project-id>.web.app`（または自分の独自ドメイン）に設定します。独自ドメインはFirebase Hosting側でも接続してください。
4. 以下の手順でGitHub Actions用の認証Secretを設定します。GitHubのフォークでは、元のリポジトリのSecretは引き継がれません。

### ローカルから手動で公開

Firebase CLIでログイン後、フォーク内で実行します。

```powershell
npm ci
firebase login
npm run deploy
```

Firebase CLIが未インストールの場合は `npm install -g firebase-tools` で導入してください。これでビルドして設定したプロジェクトのHostingだけをデプロイします。Firestoreなどは変更しません。手動デプロイだけを使う場合、GitHub Actions用のSecretは不要です。

### GitHub Actionsの認証を設定

既存の `.github/workflows/deploy.yml` は、リポジトリSecret **`FIREBASE_SERVICE_ACCOUNT_DAICHO_BD`** を参照します。フォークでもこの名前のまま使えます（名前を変える場合はワークフロー内の参照・エラーメッセージも合わせて変更してください）。

1. [Google Cloudのサービスアカウント画面](https://console.cloud.google.com/iam-admin/serviceaccounts) で、**自分のプロジェクト**にHostingデプロイ専用のサービスアカウントを作成します。プロジェクトへのロールは **Firebase Hosting Admin** (`roles/firebasehosting.admin`) と **API Keys Viewer** (`roles/serviceusage.apiKeysViewer`) を付与します。本サイトは本番Hostingのみを使うため、Firebase AuthenticationやCloud Runの管理権限は不要です。
2. 作成したサービスアカウントの「キー」からJSONキーを発行します。キーはリポジトリ外に保存し、内容をチャット・Markdown・ソースコードに貼らないでください。
3. **自分のフォーク**の Settings → Secrets and variables → Actions で **New repository secret** を開き、Nameを `FIREBASE_SERVICE_ACCOUNT_DAICHO_BD`、SecretをJSONファイルの内容全体にして保存します。設定後、不要なローカルのキーのコピーは削除してください。

組織ポリシーでJSONキーの発行が禁止されている場合は、管理者に確認してください。キーをGitに含める方法で回避しないでください。

Firebase公式CLIの `firebase init hosting:github --project <your-project-id>` でサービスアカウントとSecretを自動作成する方法もあります。ただし追加ワークフローが生成されるため、二重デプロイを避けるには既存の `deploy.yml` に一本化し、参照するSecret名を一致させてください。通常のセットアップでは上記の手動Secret設定だけで十分です。

参考: [Firebase公式のGitHub連携](https://firebase.google.com/docs/hosting/github-integration)、[公式Actionのサービスアカウント設定](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md)。

### pushで公開

フォークのActionsが有効になっていることとSecretの設定を確認し、変更をコミットしてフォークの `main` にpushします。**元のコンテンツを置き換え終えてから**pushしてください。Secretが未設定のままpushするとビルドは成功してもデプロイは失敗します。

```powershell
git add .
git commit -m "Customize my site"
git push origin main
```

以降はMarkdownの変更をpushするだけです。

- **`main`へのpush:** 依存関係の導入 → HTML生成 → Firebase Hosting本番公開。
- **`main`向けPull Request:** HTML生成のみ。認証情報は使わず、本番にもプレビューにもデプロイしません。
- **Actionsから手動実行:** `main` を選ぶと本番公開できます。他のブランチはビルドのみです。

フォークの **Actions** 画面で結果を確認し、`https://<your-project-id>.web.app` にアクセスしてください。認証Secretが未設定なら、デプロイ工程が明示的に失敗します。ビルドが失敗した場合も、既存の公開サイトは更新されません。

Firebaseの設定はSPA用の全URL書き換えをせず、各ページのHTMLを配信します。存在しないページは、トップへのリンクを付けた404ページになります。

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

`content/` は Copyright © 2026 daicho, **All rights reserved**（CC0対象外）です。`theme/` を含む、それ以外のこのリポジトリの作者が権利を持つ部分には [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/deed.ja) が適用されます。詳細は `LICENSE` を参照してください。依存ライブラリ等の第三者の権利はそれぞれのライセンスに従います。
