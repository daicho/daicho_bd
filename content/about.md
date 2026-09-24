::: label
ABOUT THIS SITE
:::

# このサイトについて

このサイトは、プロフィールと好きなものをまとめた個人サイトです。

## 技術構成

- **Firebase Hosting** で静的サイトとしてホスティングしています。
- `content/` のMarkdownをHTMLへ変換し、公開用の `dist/` を生成しています。
- GitHub Actionsが `main` へのpushを契機にビルドし、Firebase Hostingへデプロイします。
- ページやリンクカード、表などはMarkdownで編集できます。

コンテンツを追加・編集したい場合は、`content/` 内のMarkdownファイルを編集してください。ローカルでは `npm run build` で生成結果を確認できます。

## ライセンス

`content/` と `theme/` は Copyright © 2026 daicho, **All rights reserved** で、CC0の対象外です。それ以外の、作者が権利を持つ部分には [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.ja) が適用されます。

フォークして自分のサイトを作る場合は、元のプロフィールや画像、CSS・SVGを自分のものや利用許諾のある素材に置き換えてください。手順は[リポジトリのREADME](https://github.com/daicho/daicho_bd#readme)を参照してください。
