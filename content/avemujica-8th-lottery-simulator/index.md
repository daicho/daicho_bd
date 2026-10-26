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
    <p class="sim-subtitle">積み数</p>
    <div id="stack-fields"></div>
    <p class="sim-subtitle">1人あたりの積み数の分布（負の二項分布）</p>
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
    <span class="sim-result-label"><span class="sim-swatch sim-swatch-t"></span>通し</span>
    <span class="sim-result-value" id="result-t">-</span>
  </div>
  <div class="sim-result">
    <span class="sim-result-label"><span class="sim-swatch sim-swatch-g"></span>一般</span>
    <span class="sim-result-value" id="result-g">-</span>
  </div>
</div>
<div class="sim-chart sim-chart-tall"><canvas id="win-chart" role="img" aria-label="積み枚数ごとの当選確率のグラフ"></canvas></div>
<dl class="sim-stats">
  <div>
    <dt>1公演あたりにいずれかの席で参加できる確率</dt>
    <dd id="result-total">-</dd>
  </div>
  <div>
    <dt>使用されるシリアル枚数</dt>
    <dd id="stat-serials">-</dd>
  </div>
  <div>
    <dt>推定応募者数</dt>
    <dd id="stat-people">-</dd>
  </div>
  <div>
    <dt>S/A受付に申し込まない人の割合</dt>
    <dd id="stat-none">-</dd>
  </div>
</dl>
<div class="sim-table-wrap">
  <table class="sim-table">
    <thead>
      <tr><th>抽選</th><th>割り当て席数</th><th>1シリアルあたりの当選確率</th><th>倍率</th></tr>
    </thead>
    <tbody>
      <tr><th>S席（第1希望）</th><td id="stage-s1-seats">-</td><td id="stage-s1-prob">-</td><td id="stage-s1-odds">-</td></tr>
      <tr><th>S席（第2希望）</th><td id="stage-s2-seats">-</td><td id="stage-s2-prob">-</td><td id="stage-s2-odds">-</td></tr>
      <tr><th>A席（第1希望）</th><td id="stage-a1-seats">-</td><td id="stage-a1-prob">-</td><td id="stage-a1-odds">-</td></tr>
      <tr><th>A席（第2希望）</th><td id="stage-a2-seats">-</td><td id="stage-a2-prob">-</td><td id="stage-a2-odds">-</td></tr>
      <tr><th>通し</th><td id="stage-t-seats">-</td><td id="stage-t-prob">-</td><td id="stage-t-odds">-</td></tr>
      <tr><th>一般</th><td id="stage-g-seats">-</td><td id="stage-g-prob">-</td><td id="stage-g-odds">-</td></tr>
    </tbody>
  </table>
</div>

<details class="sim-details">
<summary>計算方法</summary>
<div class="sim-details-body">

- 1人あたりの積み枚数の分布からシリアルを使う人数を推定し、S/A受付 → 通し → 一般の優先順位で、先の抽選で当選した人を除きながら、それぞれの当選者数と釣り合うシリアル1枚あたりの当選確率を順に求めます。
- 当選確率は、優先順位による最終的な選別の前の独立した確率を表示します。
- DAY1とDAY2は同じ条件とし、各日の抽選は互いに独立とします（実際にはDAY2の方が競争率が低い傾向にあります）。
- S/A受付はボストン方式（第1希望だけで先に抽選し、残った席を第2希望で抽選する方式）と仮定しています。

| 記号 | 意味 |
| --- | --- |
| `$C_S,\ C_A,\ C_G$` | S席・A席・一般指定席の席数（1公演あたり） |
| `$\tau$` | 一般指定席のうち通しに回す割合 |
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
A_S = C_S\alpha,\quad A_A = C_A\alpha,\quad A_T = C_G\tau\alpha,\quad A_G = C_G(1-\tau)\alpha,\qquad U = S\beta
```

通しの当選者は、両日それぞれで一般指定席を消費します。

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

### 6. 通し・一般

通しと一般には応募者全員が申し込むものとし、S/A受付 → 通し → 一般の優先順位で、先の抽選で当選した人を除いて抽選します。申し込みパターン `$j$` の人が、ある日のS/A受付で落選する確率 `$\ell_j(k)$` は次のとおりです。

```math
\ell_{SA}(k) = (1-p_{S1})^k(1-p_{A2})^k,\quad \ell_{AS}(k) = (1-p_{A1})^k(1-p_{S2})^k,\quad \ell_{S}(k) = (1-p_{S1})^k,\quad \ell_{A}(k) = (1-p_{A1})^k,\quad \ell_0(k) = 1
```

通しは、両日ともS/A受付で落選した人が対象です。

```math
p_T:\ n_k = Nq_k\sum_j r_j\,\ell_j(k)^2,\quad A = A_T
```

一般は、その日のS/A受付と通しの両方で落選した人が対象です。`$t(k) = 1 - (1-p_T)^k$` とすると、

```math
p_G:\ n_k = Nq_k\sum_j r_j\left(\ell_j(k) - \ell_j(k)^2\,t(k)\right),\quad A = A_G
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

通しと一般の当選確率は次のとおりです。

```math
w_T(k) = 1 - (1-p_T)^k,\qquad w_G(k) = 1 - (1-p_G)^k
```

S席・A席・一般は1公演あたりの確率です。また、優先順位による選別を考慮して、1公演あたりにいずれかの席で参加できる確率を求めます。自分がある日のS/A受付で落選する確率を `$\ell(k) = \bigl(1 - w_S(k)\bigr)\bigl(1 - w_A(k)\bigr)$` とすると、次のとおりです。

```math
1 - \ell(k) + \ell(k)^2\,w_T(k) + \bigl(\ell(k) - \ell(k)^2\,w_T(k)\bigr)\,w_G(k)
```

### 簡略化している点

- DAY1とDAY2は同じ条件とし、単日券には両日とも申し込み、各日の抽選は互いに独立に行われるものとします。
- 1人の持っているシリアルは、すべて同じ受付の組み合わせに申し込むものとします。
- 通しと一般には応募者全員が申し込むものとします。
- 申し込みパターンの割合と積み枚数は無関係とします。
- 当選時に消費する席数は、平均 `$m$` 席として扱います。小数でも、そのまま扱います。
- 自分自身が応募者数や抽選結果に与える影響は、無視できるものとします。
- 落選者の再抽選や、席の配置など、抽選方式の細かな違いは考慮していません。

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
