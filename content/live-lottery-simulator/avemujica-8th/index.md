---
description: Ave Mujica 8th LIVE「Discrimen Fati」の最速先行抽選について、当選確率をシミュレーションします。
---

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.css" integrity="sha384-3rdsX6e5mueWyoweR9NIVmtEsUkokpBT/0ALqKKIBMr9j4qhHkaIkAcGgsE6uVlp" crossorigin="anonymous">
<link rel="stylesheet" href="style.css">

::: label
LIVE LOTTERY SIMULATOR
:::

# Ave Mujica 8th LIVE「Discrimen Fati」 当選確率シミュレーター

[Ave Mujica 8th LIVE「Discrimen Fati」](https://bang-dream.com/events/avemujica-8th/) の最速先行抽選について、当選確率をシミュレーションします。

## シミュレーション

<noscript>
  <p>このシミュレーターの利用にはJavaScriptが必要です。</p>
</noscript>
<div id="main-fields"></div>
<label class="sim-check"><input type="checkbox" id="a-first">A席を第1希望にする</label>
<details class="sim-details">
  <summary>詳細パラメータ</summary>
  <div class="sim-details-body">
    <p class="sim-subtitle">席数</p>
    <div id="seat-fields"></div>
    <p class="sim-subtitle">応募</p>
    <div id="entry-fields"></div>
    <p class="sim-subtitle">1人あたりの積み数の分布（負の二項分布）</p>
    <div id="stack-fields"></div>
    <div class="sim-chart"><canvas id="dist-chart" role="img" aria-label="積み枚数の分布のグラフ"></canvas></div>
  </div>
</details>
<p class="sim-warning" id="warning" hidden></p>
<div class="sim-results sim-results-grid" aria-live="polite">
  <div class="sim-result">
    <span class="sim-result-label"><span class="sim-swatch sim-swatch-s"></span>S席</span>
    <span class="sim-result-value" id="result-s">-</span>
  </div>
  <div class="sim-result">
    <span class="sim-result-label"><span class="sim-swatch sim-swatch-a"></span>A席</span>
    <span class="sim-result-value" id="result-a">-</span>
  </div>
  <div class="sim-result">
    <span class="sim-result-label"><span class="sim-swatch sim-swatch-g"></span>一般</span>
    <span class="sim-result-value" id="result-g">-</span>
  </div>
</div>
<div class="sim-chart sim-chart-tall"><canvas id="win-chart" role="img" aria-label="積み枚数ごとの当選確率のグラフ"></canvas></div>
<dl class="sim-stats">
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

- 1人あたりの積み枚数の分布からシリアルを使う人数を推定し、当選者数と釣り合うシリアル1枚あたりの当選確率を求めて、積み枚数ごとの当選確率を計算します。
- シリアル1枚で申し込む枠数は、当選確率には影響せず、当選時に消費する席数にのみ影響するものとします。
- 当選確率は、優先順位による選別が行われた後の最終的な確率ではなく、選別前の独立した確率を表示します。
- DAY1とDAY2は同じ条件とし、各日の抽選は互いに独立とします（実際にはDAY2の方が競争率が低い傾向にあります）。
- S/A受付はボストン方式（第1希望だけで先に抽選し、残った席を第2希望で抽選する方式）と仮定しています。

| 記号 | 意味 |
| --- | --- |
| `$C_S,\ C_A,\ C_G$` | S席・A席・一般指定席の席数（1公演あたり） |
| `$\alpha$` | 最速先行に割り当てる割合 |
| `$S$` | CD売上枚数 |
| `$\beta$` | CD売上枚数に対するシリアル使用率 |
| `$r_{SA},\ r_{AS},\ r_{S},\ r_{A}$` | 応募者のうち、S第1・A第2希望、A第1・S第2希望、Sのみ、Aのみの人の割合 |
| `$r_0$` | S/A受付に申し込まない人の割合（`$1 - r_{SA} - r_{AS} - r_S - r_A$`） |
| `$m$` | 1申し込みあたりの平均枚数 |
| `$\mu,\ \sigma^2$` | 積み数の分布の平均と分散 |

### 1. 割り当て席数と使用シリアル数

最速先行で各抽選に割り当てられる席数（1公演あたり）と、使用されるシリアル数 `$U$` を求めます。

```math
A_S = C_S\alpha,\quad A_A = C_A\alpha,\quad A_G = C_G\alpha,\qquad U = S\beta
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

### 3. 応募者数

使用されるシリアル数を、応募者1人あたりの平均積み枚数 `$\mu$` で割って、応募者数 `$N$` を求めます。

```math
N = \frac{U}{\mu}
```

### 4. 各抽選の解き方

それぞれの抽選について、積み `$k$` 枚の対象者数の期待値を `$n_k$`、割り当て席数を `$A$` とします。当選したシリアルは平均 `$m$` 席を消費し、同じ日に重複当選はしないため、当選者数は `$W = A/m$` です。シリアル1枚あたりの当選確率 `$p$` は、当選者数の期待値が `$W$` と等しくなるように決めます。

```math
\sum_{k\ge 1} n_k\left(1 - (1-p)^{k}\right) = W
```

この方程式を `$p$` について二分法で解きます。ただし `$W \ge \sum_k n_k$`（対象者全員が当選できる）の場合は `$p = 1$` とし、当選者数は `$\sum_k n_k$` とします。

### 5. S/A受付（ボストン方式）

まず、第1希望だけで抽選します。S席第1希望の当選確率 `$p_{S1}$` と、A席第1希望の当選確率 `$p_{A1}$` を、それぞれ次の条件で求めます。

```math
p_{S1}:\ n_k = Nq_k\,(r_{SA} + r_S),\quad A = A_S
```

```math
p_{A1}:\ n_k = Nq_k\,(r_{AS} + r_A),\quad A = A_A
```

第1希望の当選者数を `$W_{S1},\ W_{A1}$` とすると、残った席 `$A_S - mW_{S1}$`、`$A_A - mW_{A1}$` を、第1希望で落選した人の第2希望で抽選します。S席第2希望の当選確率 `$p_{S2}$` と、A席第2希望の当選確率 `$p_{A2}$` は次のとおりです。

```math
p_{S2}:\ n_k = Nq_k\,r_{AS}(1-p_{A1})^{k},\quad A = A_S - mW_{S1}
```

```math
p_{A2}:\ n_k = Nq_k\,r_{SA}(1-p_{S1})^{k},\quad A = A_A - mW_{A1}
```

### 6. 一般

一般には応募者全員が申し込むものとし、S/A受付で当選した人を除いて抽選します。申し込みパターン `$j$` の人が、ある日のS/A受付で落選する確率 `$\ell_j(k)$` は次のとおりです。

```math
\ell_{SA}(k) = (1-p_{S1})^k(1-p_{A2})^k,\quad \ell_{AS}(k) = (1-p_{A1})^k(1-p_{S2})^k,\quad \ell_{S}(k) = (1-p_{S1})^k,\quad \ell_{A}(k) = (1-p_{A1})^k,\quad \ell_0(k) = 1
```

一般は、その日のS/A受付で落選した人が対象です。

```math
p_G:\ n_k = Nq_k\sum_j r_j\,\ell_j(k),\quad A = A_G
```

### 7. 積み枚数ごとの当選確率

積み `$k$` 枚の自分が、すべての受付に申し込んだ場合の、最終的な選別前の当選確率を求めます。各受付の当選確率は、その抽選の対象として残っている場合に当選する確率とし、ほかの受付での当落とは独立に扱います。第2希望の当選確率も、第1希望で落選したかどうかにかかわらず、第2希望の抽選で当選する確率として表示します。S席を第1希望にする場合は次のとおりです。

```math
w_S(k) = 1 - (1-p_{S1})^k,\qquad w_A(k) = 1 - (1-p_{A2})^k
```

A席を第1希望にする場合は次のとおりです。

```math
w_A(k) = 1 - (1-p_{A1})^k,\qquad w_S(k) = 1 - (1-p_{S2})^k
```

一般の当選確率は次のとおりです。

```math
w_G(k) = 1 - (1-p_G)^k
```

S席・A席・一般は1公演あたりの確率です。

### 簡略化している点

- DAY1とDAY2は同じ条件とし、単日券には両日とも申し込み、各日の抽選は互いに独立に行われるものとします。
- 一般指定席は2DAYS通しチケットと区別せず、一般指定席のみとして扱います。
- 1人の持っているシリアルは、すべて同じ受付の組み合わせに申し込むものとします。
- 一般指定席には応募者全員が申し込むものとします。
- 自分自身が応募者数や抽選結果に与える影響は、無視できるものとします。
- 免責のため、確率が100%の場合も99.9%と表示します。

</div>
</details>

## 免責事項

1. 本シミュレーターは、一般的な傾向をもとにした推定による参考情報の提供を目的としており、当選を予測・保証するものではありません。
2. 初期値として設定しているパラメータや抽選方式は、運営者による予測・仮定であり、公式が発表したものではありません。実際の抽選方法や応募状況とは異なる場合があります。
3. 本シミュレーターの結果と実際の抽選結果が異なった場合でも、運営者は一切の責任を負いません。
4. 本シミュレーターの利用により生じた損害（CDの購入などの判断に基づくものを含みます）について、運営者は一切の責任を負いません。
5. 本シミュレーターは個人が運営する非公式のものであり、公式およびバンドリ！プロジェクトの関係者とは一切関係ありません。
6. 本シミュレーターの内容は、予告なく変更・停止することがあります。

<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js" integrity="sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.js" integrity="sha384-QFFtAGzvvj+bfgCGxXJlNZZR1nXEZgvG8tDLCCY1F19xl20WlfTYgguB4VcNdxYk" crossorigin="anonymous"></script>
<script defer src="simulator.js"></script>
