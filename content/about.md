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

サイトの**コンテンツ内容を除く部分**は [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.ja) です。ソースコード、テーマ、ビルドやデプロイの仕組みは、自由に複製・改変して使ってもらって構いません。

プロフィールや各ページに記載している文章・一覧などのコンテンツは、CC0の対象外です。
