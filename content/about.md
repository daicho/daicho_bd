::: label
ABOUT THIS SITE
:::

# このサイトについて

このサイトの構成とライセンスについて解説します（技術者向け）。

## 概要

このサイトは、Markdownで書かれたものを静的HTMLに変換してFirebase Hostingにデプロイしています。
Markdownで書いたページをGitHubにpushすると、以下のフローでデプロイされます。

1. Markdownでページを書く
2. GitHubにpushする
3. GitHub Actionsのワークフローが実行される
4. MarkdownがHTMLに変換される
5. HTMLがFirebase Hostingにデプロイされる

Markdownで書けるのと、Gitでバージョン管理ができるため、普段からこれらを使い慣れている方にはおすすめです。

もちろん無料で広告も表示されません。

## ソースコード

https://github.com/daicho/daicho_bd

サイトのコンテンツ以外は CC0 1.0 ライセンスなので、ご自由に利用、改変していただいて構いません。
フォーク、カスタマイズに方法については上記リポジトリの `README.md` をご覧ください。

## ライセンス

このサイトのコンテンツ（リポジトリの `content/`）については、すべての権利をだいちょが保有します。
それ以外の部分については CC0 1.0 が適用されます。
