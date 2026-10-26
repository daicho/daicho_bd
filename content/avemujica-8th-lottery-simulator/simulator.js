// 初期値。席数は1公演あたり、割合系は %、stackMean / stackVariance は積み数の分布（1 + 負の二項分布）の平均と分散です。
const DEFAULTS = {
  cdSales: 25000,
  stack: 1,
  seatsS: 4000,
  seatsA: 5000,
  seatsG: 11000,
  throughRate: 50,
  allocationRate: 80,
  useRate: 75,
  rateSA: 50,
  rateAS: 10,
  rateSOnly: 5,
  rateAOnly: 10,
  slotsPerSerial: 1.5,
  stackMean: 2.5,
  stackVariance: 20.0,
};

(() => {
  "use strict";

  const FIELDS = [
    { key: "cdSales", group: "main", label: "CD売上枚数", unit: "枚", hardMin: 1, hardMax: 1e7, sMin: 1000, sMax: 50000, step: 1000 },
    { key: "stack", group: "main", label: "積み枚数", unit: "枚", hardMin: 1, hardMax: 1000, sMin: 1, sMax: 100, step: 1, int: true },
    { key: "seatsS", group: "seat", label: "S席の席数（1公演あたり）", unit: "席", hardMin: 0, hardMax: 1e5, sMin: 0, sMax: 20000, step: 100 },
    { key: "seatsA", group: "seat", label: "A席の席数（1公演あたり）", unit: "席", hardMin: 0, hardMax: 1e5, sMin: 0, sMax: 20000, step: 100 },
    { key: "seatsG", group: "seat", label: "一般指定席の席数（1公演あたり）", unit: "席", hardMin: 0, hardMax: 1e5, sMin: 0, sMax: 20000, step: 100 },
    { key: "throughRate", group: "seat", label: "一般指定席のうち通しに回す割合", unit: "%", hardMin: 0, hardMax: 100, sMin: 0, sMax: 100, step: 1 },
    { key: "allocationRate", group: "seat", label: "最速先行に割り当てる割合", unit: "%", hardMin: 0, hardMax: 100, sMin: 0, sMax: 100, step: 1 },
    { key: "useRate", group: "entry", label: "CD売上枚数に対するシリアル使用率", unit: "%", hardMin: 0, hardMax: 100, sMin: 0, sMax: 100, step: 1 },
    { key: "rateSA", group: "entry", label: "応募者のうち、S第1希望・A第2希望の人の割合", unit: "%", hardMin: 0, hardMax: 100, sMin: 0, sMax: 100, step: 1 },
    { key: "rateAS", group: "entry", label: "応募者のうち、A第1希望・S第2希望の人の割合", unit: "%", hardMin: 0, hardMax: 100, sMin: 0, sMax: 100, step: 1 },
    { key: "rateSOnly", group: "entry", label: "応募者のうち、Sのみの人の割合", unit: "%", hardMin: 0, hardMax: 100, sMin: 0, sMax: 100, step: 1 },
    { key: "rateAOnly", group: "entry", label: "応募者のうち、Aのみの人の割合", unit: "%", hardMin: 0, hardMax: 100, sMin: 0, sMax: 100, step: 1 },
    { key: "slotsPerSerial", group: "entry", label: "1申し込みあたりの平均枚数", unit: "枚", hardMin: 1, hardMax: 10, sMin: 1, sMax: 4, step: 0.1 },
    { key: "stackMean", group: "stack", label: "1人あたりの積み数の平均", unit: "枚", hardMin: 1, hardMax: 100, sMin: 1, sMax: 10, step: 0.1 },
    { key: "stackVariance", group: "stack", label: "1人あたりの積み数の分散", unit: "", hardMin: 0, hardMax: 1000, sMin: 0, sMax: 100, step: 0.1 },
  ];
  const MAX_K = 20000;
  const BLUE = "#12659d";
  const BLUE_SOFT = "#5da7d9";
  const BLUE_PALE = "#a9d0eb";
  const YELLOW = "#f6dc31";
  const LINES = [
    { key: "s", label: "S席", color: "#c2185b" },
    { key: "a", label: "A席", color: "#e8501f" },
    { key: "t", label: "通し", color: "#6a3fb5" },
    { key: "g", label: "一般", color: BLUE },
  ];

  const $ = (id) => document.getElementById(id);
  const state = { ...DEFAULTS, aFirst: false };
  const inputs = {};
  let model = null;
  let winChart = null;
  let distChart = null;

  const fmtPct = (x) => {
    const v = x * 100;
    return `${v > 0 && v < 0.1 ? v.toFixed(2) : v.toFixed(1)}%`;
  };
  const fmtNum = (x, digits = 0) => x.toLocaleString("ja-JP", { maximumFractionDigits: digits });
  // (1-p)^k と 1-(1-p)^k を、p が小さいときも精度よく計算する
  const lose = (p, k) => (p >= 1 ? 0 : Math.exp(k * Math.log1p(-p)));
  const win = (p, k) => (p >= 1 ? 1 : -Math.expm1(k * Math.log1p(-p)));

  // 積み枚数 K = 1 + X とし、X が負の二項分布に従うものとする。平均は 1 + E[X]、分散は Var[X] なので、
  // 入力された平均 mean と分散 variance から、X の平均 μ = mean - 1 と r = μ² / (variance - μ) が決まる。
  function buildDistribution(mean, variance) {
    const mu = mean - 1;
    let notice = "";
    let r = 0;
    let ratio = 0;
    let p = 1;
    if (mu > 0) {
      if (variance <= mu * (1 + 1e-9)) {
        notice = `分散が小さすぎるため、負の二項分布を定義できません（平均−1 = ${mu.toFixed(2)} より大きい値が必要です）。ポアソン分布で代用して計算しています。`;
        p = Math.exp(-mu);
      } else {
        r = (mu * mu) / (variance - mu);
        ratio = mu / (r + mu);
        p = Math.exp(r * Math.log(r / (r + mu)));
      }
    }
    const q = [0];
    let sum = 0;
    for (let x = 0; x < MAX_K; x++) {
      q.push(p);
      sum += p;
      if (mu <= 0 || (x > mu && p < 1e-15)) break;
      p *= r > 0 ? ((x + r) / (x + 1)) * ratio : mu / (x + 1);
    }
    return { q: q.map((v) => v / sum), notice };
  }

  // 積み k 枚の対象者数の期待値 weights[k] と当選者数 winners から、
  // 当選者数の期待値が winners と等しくなるシリアル1枚あたりの当選確率 p を二分法で求める
  function solve(weights, winners) {
    const total = weights.reduce((a, b) => a + b, 0);
    if (winners <= 0) return { p: 0, winners: 0 };
    // 対象者が席数以下なら全員当選（対象者がいなくても、席が残っていれば当選できるものとする）
    if (winners >= total) return { p: 1, winners: total };
    const expected = (p) => {
      const z = 1 - p;
      let zk = 1;
      let sum = 0;
      for (let k = 1; k < weights.length; k++) {
        zk *= z;
        sum += weights[k] * (1 - zk);
      }
      return sum;
    };
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (expected(mid) < winners) lo = mid; else hi = mid;
    }
    return { p: (lo + hi) / 2, winners };
  }

  function calculate() {
    const alloc = state.allocationRate / 100;
    const through = state.throughRate / 100;
    const m = state.slotsPerSerial;
    const serials = (state.cdSales * state.useRate) / 100;
    const { q, notice: distNotice } = buildDistribution(state.stackMean, state.stackVariance);
    const people = serials / state.stackMean;
    const notices = distNotice ? [distNotice] : [];

    let rates = [state.rateSA, state.rateAS, state.rateSOnly, state.rateAOnly].map((v) => v / 100);
    const rateSum = rates.reduce((a, b) => a + b, 0);
    if (rateSum > 1) {
      notices.push(`S/A受付の申し込みパターンの割合の合計が${fmtNum(rateSum * 100, 1)}%で、100%を超えています。合計が100%になるように縮小して計算しています。`);
      rates = rates.map((v) => v / rateSum);
    }
    const [rSA, rAS, rS, rA] = rates;
    const rNone = Math.max(0, 1 - rates.reduce((a, b) => a + b, 0));

    const weights = (fn) => q.map((qk, k) => (k === 0 ? 0 : people * qk * fn(k)));
    const seatsS = state.seatsS * alloc;
    const seatsA = state.seatsA * alloc;
    const seatsT = state.seatsG * through * alloc;
    const seatsG = state.seatsG * (1 - through) * alloc;

    // S/A受付（ボストン方式）：第1希望だけで抽選し、残った席を第2希望で抽選する
    const s1 = solve(weights(() => rSA + rS), seatsS / m);
    const a1 = solve(weights(() => rAS + rA), seatsA / m);
    const leftS = Math.max(0, seatsS - s1.winners * m);
    const leftA = Math.max(0, seatsA - a1.winners * m);
    const s2 = solve(weights((k) => rAS * lose(a1.p, k)), leftS / m);
    const a2 = solve(weights((k) => rSA * lose(s1.p, k)), leftA / m);

    // 申し込みパターンごとの、その日のS/A受付で落選する確率
    const patterns = [
      [rSA, (k) => lose(s1.p, k) * lose(a2.p, k)],
      [rAS, (k) => lose(a1.p, k) * lose(s2.p, k)],
      [rS, (k) => lose(s1.p, k)],
      [rA, (k) => lose(a1.p, k)],
      [rNone, () => 1],
    ];
    const mix = (fn) => (k) => patterns.reduce((sum, [rate, ell]) => sum + rate * fn(ell(k), k), 0);

    // 通し：両日ともS/A受付で落選した人が対象
    const t = solve(weights(mix((ell) => ell * ell)), seatsT / m);
    // 一般：その日のS/A受付と通しの両方で落選した人が対象
    const g = solve(weights(mix((ell, k) => ell - ell * ell * win(t.p, k))), seatsG / m);

    // 自分の当選確率は、ほかの受付での当落とは独立な、最終的な選別前の確率として扱う
    const winProbs = (k) => {
      const [s, a] = state.aFirst ? [win(s2.p, k), win(a1.p, k)] : [win(s1.p, k), win(a2.p, k)];
      const tw = win(t.p, k);
      const gw = win(g.p, k);
      const ell = (1 - s) * (1 - a);
      return { s, a, t: tw, g: gw, total: 1 - ell + ell * ell * tw + (ell - ell * ell * tw) * gw };
    };

    const stages = [
      { id: "s1", seats: seatsS, ...s1 },
      { id: "s2", seats: leftS, ...s2 },
      { id: "a1", seats: seatsA, ...a1 },
      { id: "a2", seats: leftA, ...a2 },
      { id: "t", seats: seatsT, ...t },
      { id: "g", seats: seatsG, ...g },
    ];
    return { serials, people, rNone, stages, winProbs, q, notice: notices.join("\n") };
  }

  function chartRange() {
    let cumulative = 0;
    let quantile = 1;
    for (let k = 1; k < model.q.length; k++) {
      cumulative += model.q[k];
      quantile = k;
      if (cumulative >= 0.995) break;
    }
    return Math.max(10, state.stack, Math.min(quantile, 60));
  }

  function createCharts() {
    if (typeof Chart === "undefined") return;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = "#5a7a8f";
    Chart.defaults.borderColor = "rgba(196, 222, 240, .7)";

    const baseOptions = () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(22, 59, 83, .92)",
          padding: 10,
          displayColors: false,
          callbacks: { title: (items) => `積み${items[0].label}枚` },
        },
      },
      scales: {
        x: { title: { display: true, text: "積み枚数（枚）" }, grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 8 } },
        y: { beginAtZero: true },
      },
    });

    const winOptions = baseOptions();
    winOptions.scales.y.max = 100;
    winOptions.scales.y.ticks = { callback: (v) => `${v}%` };
    winOptions.scales.y.title = { display: true, text: "当選確率" };
    winOptions.plugins.legend = { display: true, labels: { boxWidth: 14, boxHeight: 2 } };
    winOptions.plugins.tooltip.displayColors = true;
    winOptions.plugins.tooltip.callbacks.label = (item) => `${item.dataset.label}: ${fmtPct(item.parsed.y / 100)}`;
    winChart = new Chart($("win-chart"), {
      type: "line",
      data: {
        labels: [],
        datasets: LINES.map((line) => ({
          label: line.label,
          data: [],
          borderColor: line.color,
          backgroundColor: line.color,
          borderWidth: 2.5,
          fill: false,
          tension: 0.25,
          pointBorderColor: line.color,
          pointBorderWidth: 2,
        })),
      },
      options: winOptions,
    });

    const distOptions = baseOptions();
    distOptions.scales.y.ticks = { callback: (v) => `${v}%` };
    distOptions.plugins.tooltip.callbacks.label = (item) => `割合: ${fmtPct(item.parsed.y / 100)}`;
    distChart = new Chart($("dist-chart"), {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], borderRadius: 2 }] },
      options: distOptions,
    });

    $("dist-chart").closest("details").addEventListener("toggle", () => distChart.resize());
  }

  function updateCharts() {
    if (!winChart) return;
    const xmax = chartRange();
    const ks = Array.from({ length: xmax }, (_, i) => i + 1);
    const isCurrent = (k) => k === state.stack;
    const probs = ks.map((k) => model.winProbs(k));

    winChart.data.labels = ks;
    LINES.forEach((line, i) => {
      const dataset = winChart.data.datasets[i];
      dataset.data = probs.map((p) => p[line.key] * 100);
      dataset.pointRadius = ks.map((k) => (isCurrent(k) ? 6 : xmax <= 30 ? 2.5 : 0));
      dataset.pointHoverRadius = ks.map((k) => (isCurrent(k) ? 7 : 5));
      dataset.pointBackgroundColor = ks.map((k) => (isCurrent(k) ? YELLOW : "#fff"));
    });
    winChart.update();

    const dist = distChart.data.datasets[0];
    distChart.data.labels = ks;
    dist.data = ks.map((k) => (model.q[k] ?? 0) * 100);
    dist.backgroundColor = ks.map((k) => (isCurrent(k) ? BLUE : BLUE_PALE));
    dist.hoverBackgroundColor = ks.map((k) => (isCurrent(k) ? BLUE : BLUE_SOFT));
    distChart.update();
  }

  function render() {
    const probs = model.winProbs(state.stack);
    for (const line of LINES) $(`result-${line.key}`).textContent = fmtPct(probs[line.key]);
    $("result-total").textContent = fmtPct(probs.total);
    $("stat-serials").textContent = `${fmtNum(model.serials)}枚`;
    $("stat-people").textContent = `${fmtNum(model.people)}人`;
    $("stat-none").textContent = fmtPct(model.rNone);
    for (const stage of model.stages) {
      $(`stage-${stage.id}-seats`).textContent = `${fmtNum(stage.seats, 1)}席`;
      $(`stage-${stage.id}-prob`).textContent = fmtPct(stage.p);
      $(`stage-${stage.id}-odds`).textContent = stage.p > 0 ? `${fmtNum(1 / stage.p, 1)}倍` : "-";
    }
    $("win-chart").setAttribute("aria-label", `積み枚数ごとの当選確率のグラフ。積み${state.stack}枚で${
      LINES.map((line) => `${line.label}${fmtPct(probs[line.key])}`).join("、")}`);
    const warning = $("warning");
    warning.hidden = !model.notice;
    warning.textContent = model.notice;
    updateCharts();
  }

  function update() {
    model = calculate();
    render();
  }

  function setValue(key, value, source) {
    state[key] = value;
    const { range, number } = inputs[key];
    if (source !== range) range.value = value;
    if (source !== number) number.value = value;
    const span = range.max - range.min;
    range.style.setProperty("--pct", `${Math.min(100, Math.max(0, ((value - range.min) / span) * 100))}%`);
  }

  function createField(field) {
    const id = `field-${field.key}`;
    const wrapper = document.createElement("div");
    wrapper.className = "sim-field";
    wrapper.innerHTML = `<label class="sim-label" for="${id}">${field.label}</label>
<div class="sim-control">
<input class="sim-slider" type="range" aria-label="${field.label}（スライダー）" min="${field.sMin}" max="${field.sMax}" step="${field.step}">
<div class="sim-num"><input type="number" id="${id}" inputmode="decimal" min="${field.hardMin}" max="${field.hardMax}" step="${field.step}"><span class="sim-unit">${field.unit}</span></div>
</div>`;
    const [range, number] = wrapper.querySelectorAll("input");
    inputs[field.key] = { range, number };
    range.addEventListener("input", () => {
      setValue(field.key, Number(range.value), range);
      number.removeAttribute("aria-invalid");
      update();
    });
    number.addEventListener("input", () => {
      const value = Number(number.value);
      const valid = number.value.trim() !== "" && Number.isFinite(value)
        && value >= field.hardMin && value <= field.hardMax && (!field.int || Number.isInteger(value));
      number.setAttribute("aria-invalid", String(!valid));
      if (!valid) return;
      setValue(field.key, value, number);
      update();
    });
    number.addEventListener("change", () => {
      number.removeAttribute("aria-invalid");
      number.value = state[field.key];
    });
    $(`${field.group}-fields`).append(wrapper);
    setValue(field.key, state[field.key]);
  }

  // Markdownでは、```math のコードブロックを数式ブロック、`$...$` のインラインコードを行内数式として KaTeX で描画する
  function renderMath() {
    if (typeof katex === "undefined") return;
    for (const code of document.querySelectorAll(".prose code")) {
      const block = code.parentElement.tagName === "PRE" && code.classList.contains("language-math");
      const inline = !block && code.parentElement.tagName !== "PRE" && /^\$[\s\S]+\$$/.test(code.textContent);
      if (!block && !inline) continue;
      const target = block ? code.parentElement : code;
      const element = document.createElement(block ? "div" : "span");
      katex.render(block ? code.textContent : code.textContent.slice(1, -1), element, { displayMode: block, throwOnError: false });
      target.replaceWith(element);
    }
  }

  FIELDS.forEach(createField);
  const aFirst = $("a-first");
  aFirst.checked = state.aFirst;
  aFirst.addEventListener("change", () => {
    state.aFirst = aFirst.checked;
    update();
  });
  createCharts();
  update();

  renderMath();
})();
