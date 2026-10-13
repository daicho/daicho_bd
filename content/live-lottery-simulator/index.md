---
description: バンドリ！ライブのシリアル抽選について、当選確率をシミュレーションします。
og:
  image: ./image/graph.png
  imageAlt: 当選確率のグラフ
twitter:
  card: summary
---

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.css" integrity="sha384-3rdsX6e5mueWyoweR9NIVmtEsUkokpBT/0ALqKKIBMr9j4qhHkaIkAcGgsE6uVlp" crossorigin="anonymous">
<link rel="stylesheet" href="style.css">

::: label
LIVE LOTTERY SIMULATOR
:::

# バンドリ！ライブ当選確率シミュレーター

バンドリ！ライブのシリアル抽選について、当選確率をシミュレーションします。

## シミュレーション

<noscript>
  <p>このシミュレーターの利用にはJavaScriptが必要です。</p>
</noscript>
<div class="sim-field">
  <label class="sim-label" for="live">ライブ</label>
  <div class="sim-select"><select id="live"></select></div>
  <a class="sim-live-link" id="live-link" href="#" target="_blank" rel="noopener noreferrer" hidden>公式サイトを開く</a>
</div>
<div id="main-fields"></div>
<details class="sim-details">
  <summary>詳細パラメータ</summary>
  <div class="sim-details-body">
    <div id="detail-fields"></div>
    <p class="sim-subtitle">1人あたりの積み数の分布（負の二項分布）</p>
    <div class="sim-chart"><canvas id="dist-chart" role="img" aria-label="積み枚数の分布のグラフ"></canvas></div>
  </div>
</details>
<p class="sim-warning" id="warning" hidden></p>
<div class="sim-result" aria-live="polite">
  <span class="sim-result-label">当選確率</span>
  <span class="sim-result-value" id="result-prob">-</span>
</div>
<div class="sim-chart"><canvas id="win-chart" role="img" aria-label="積み枚数ごとの当選確率のグラフ"></canvas></div>
<dl class="sim-stats">
  <div>
    <dt>シリアル抽選での割り当て席数</dt>
    <dd id="stat-seats">-</dd>
  </div>
  <div>
    <dt>使用されるシリアル枚数</dt>
    <dd id="stat-serials">-</dd>
  </div>
  <div>
    <dt>推定応募者数</dt>
    <dd id="stat-people">-</dd>
  </div>
</dl>

<details class="sim-details">
<summary>計算方法</summary>
<div class="sim-details-body">

1人あたりの積み枚数の分布からシリアルを使う人数を推定し、当選者数と釣り合うシリアル1枚あたりの当選確率を求めて、積み枚数ごとの当選確率を計算します。なお、シリアル1枚で申し込む枠数は、当選確率には影響せず、当選時に消費する席数にのみ影響するものとします。

| 記号 | 意味 |
| --- | --- |
| `$C$` | キャパ |
| `$S$` | CD売上枚数 |
| `$\alpha$` | キャパに対するシリアル抽選での割り当て割合 |
| `$\beta$` | CD売上枚数に対するシリアル使用率 |
| `$m$` | 1シリアルあたりの平均申し込み枠数 |
| `$\mu,\ \sigma^2$` | 積み数の分布の平均と分散 |

### 1. 割り当て席数と使用シリアル数

シリアル抽選に割り当てられる席数 `$A$` と、使用されるシリアル数 `$U$` を求めます。

```math
A = C\alpha,\qquad U = S\beta
```

### 2. 積み枚数の分布

応募者（シリアルを1枚以上使う人）の積み枚数 `$K$` は、「最低1枚」に「追加で積む枚数 `$X$`」を足したもの（`$K = 1 + X$`）とし、`$X$` は負の二項分布に従うものとします。`$X$` の平均は `$\mu - 1$`、分散は `$\sigma^2$` です。

```math
r = \frac{(\mu-1)^2}{\sigma^2 - (\mu-1)}
```

として、`$K = k$` となる確率 `$q_k$` を次のように表します。

```math
q_k = \frac{\Gamma(k-1+r)}{(k-1)!\,\Gamma(r)}\left(\frac{r}{r+\mu-1}\right)^{r}\left(\frac{\mu-1}{r+\mu-1}\right)^{k-1}\qquad (k = 1, 2, \dots)
```

分散が `$\mu - 1$` 以下の場合は負の二項分布を定義できないため、ポアソン分布 `$q_k = e^{-(\mu-1)}(\mu-1)^{k-1} / (k-1)!$` で代用します。

### 3. 応募者数

使用されるシリアル数を、応募者1人あたりの平均積み枚数 `$\mu$` で割って、応募者数 `$N$` を求めます。

```math
N = \frac{U}{\mu}
```

### 4. シリアル1枚あたりの当選確率

当選したシリアルは、申し込んだ枠数ぶんの席を消費します。1シリアルあたりの平均申し込み枠数が `$m$` なので、当選者数 `$W$` は次のとおりです。

```math
W = \frac{A}{m}
```

シリアル1枚あたりの当選確率を `$p$` とします。枠数の多少にかかわらず、`$p$` は同じです。重複当選はしないため、当選者はすべて別人になります。当選者数の期待値が `$W$` と等しくなる `$p$` を求めます。

```math
N\left(1 - \sum_{j\ge 1} q_j\,(1-p)^{j}\right) = W
```

この方程式を `$p$` について二分法で解きます。ただし `$W \ge N$`（応募者全員が当選できる）の場合は `$p = 1$` とします。

### 5. 積み枚数ごとの当選確率

積み `$k$` 枚の人が、いずれかのシリアルで当選する確率 `$w(k)$` を求めます。

```math
w(k) = 1 - (1-p)^{k}
```

### 簡略化している点

- 各シリアルは互いに独立に、同じ確率 `$p$` で当選するものとします。
- 当選時に消費する席数は、平均 `$m$` 席として扱います。申し込み枠数が小数でも、そのまま扱います。
- 自分自身が応募者数や抽選結果に与える影響は、無視できるものとします。
- 落選者の再抽選や、公演・枠ごとの席数の違いなど、抽選方式の細かな違いは考慮していません。

</div>
</details>

## 免責事項

1. 本シミュレーターは、一般的な傾向をもとにした推定による参考情報の提供を目的としており、当選を予測・保証するものではありません。
2. 初期値として設定しているパラメータは、運営者による予測値であり、公式が発表した値ではありません。実際の抽選方法や応募状況とは異なる場合があります。
3. 本シミュレーターの結果と実際の抽選結果が異なった場合でも、運営者は一切の責任を負いません。
4. 本シミュレーターの利用により生じた損害（CDの購入などの判断に基づくものを含みます）について、運営者は一切の責任を負いません。
5. 本シミュレーターは個人が運営する非公式のものであり、公式およびバンドリ！プロジェクトの関係者とは一切関係ありません。
6. 本シミュレーターの内容は、予告なく変更・停止することがあります。

<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js" integrity="sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.js" integrity="sha384-QFFtAGzvvj+bfgCGxXJlNZZR1nXEZgvG8tDLCCY1F19xl20WlfTYgguB4VcNdxYk" crossorigin="anonymous"></script>
<script defer src="simulator.js"></script>
