// ライブごとの初期値。ライブを追加するときは、ここに項目を足してください。
// allocationRate / useRate は %、stackMean / stackVariance は積み数の分布（1 + 負の二項分布）の平均と分散、cdPrice は CD 1枚あたりの価格（円）です。
const DEFAULT_STACK = 1;
const LIVES = [
  {
    id: "millsage-001",
    name: "millsage LIVE 001「極夜」",
    url: "https://bang-dream.com/events/millsage_1st/",
    params: {
      capacity: 500,
      cdSales: 20000,
      allocationRate: 80,
      useRate: 75,
      slotsPerSerial: 1.5,
      stackMean: 3.0,
      stackVariance: 20.0,
      cdPrice: 1650,
    },
  },
  {
    id: "ikka-dumb-rock-1st",
    name: "一家Dumb Rock! 1st GIG「ピース＆グルーヴ」",
    url: "https://bang-dream.com/events/ikka-dumb-rock_1st/",
    params: {
      capacity: 700,
      cdSales: 18000,
      allocationRate: 80,
      useRate: 75,
      slotsPerSerial: 1.5,
      stackMean: 3.0,
      stackVariance: 20.0,
      cdPrice: 1650,
    },
  },
];

(() => {
  "use strict";

  const FIELDS = [
    { key: "capacity", group: "main", label: "キャパ", unit: "人", hardMin: 1, hardMax: 1e6, sMin: 100, sMax: 50000, step: 10 },
    { key: "cdSales", group: "main", label: "CD売上枚数", unit: "枚", hardMin: 1, hardMax: 1e7, sMin: 1000, sMax: 100000, step: 100 },
    { key: "stack", group: "main", label: "積み枚数", unit: "枚", hardMin: 1, hardMax: 1000, sMin: 1, sMax: 50, step: 1, int: true },
    { key: "cdPrice", group: "loss", label: "CD単価", unit: "円", hardMin: 0, hardMax: 100000, sMin: 0, sMax: 10000, step: 10 },
    { key: "allocationRate", group: "detail", label: "キャパに対するシリアル抽選での割り当て割合", unit: "%", hardMin: 0, hardMax: 100, sMin: 0, sMax: 100, step: 1 },
    { key: "useRate", group: "detail", label: "CD売上枚数に対するシリアル使用率", unit: "%", hardMin: 0, hardMax: 100, sMin: 0, sMax: 100, step: 1 },
    { key: "slotsPerSerial", group: "detail", label: "1シリアルあたりの平均申し込み枠数", unit: "枠", hardMin: 1, hardMax: 10, sMin: 1, sMax: 4, step: 0.1 },
    { key: "stackMean", group: "detail", label: "1人あたりの積み数の平均", unit: "枚", hardMin: 1, hardMax: 100, sMin: 1, sMax: 10, step: 0.1 },
    { key: "stackVariance", group: "detail", label: "1人あたりの積み数の分散", unit: "", hardMin: 0, hardMax: 1000, sMin: 0, sMax: 100, step: 0.1 },
  ];
  const MAX_K = 20000;
  const BLUE = "#12659d";
  const BLUE_SOFT = "#5da7d9";
  const BLUE_PALE = "#a9d0eb";
  const YELLOW = "#f6dc31";
  const ORANGE = "#e8501f";

  const $ = (id) => document.getElementById(id);
  const select = $("live");
  const state = { stack: DEFAULT_STACK, showLoss: false, ...LIVES[0].params };
  const inputs = {};
  let model = null;
  let winChart = null;
  let distChart = null;

  const fmtPct = (x) => {
    const v = x * 100;
    return `${v > 0 && v < 0.1 ? v.toFixed(2) : v.toFixed(1)}%`;
  };
  const fmtNum = (x, digits = 0) => x.toLocaleString("ja-JP", { maximumFractionDigits: digits });
  const fmtYen = (x) => `${fmtNum(Math.round(x))}円`;

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

  function calculate() {
    const seats = (state.capacity * state.allocationRate) / 100;
    const serials = (state.cdSales * state.useRate) / 100;
    const { q, notice } = buildDistribution(state.stackMean, state.stackVariance);
    const people = serials / state.stackMean;
    const m = state.slotsPerSerial;
    // 当選したシリアルは平均 m 席を消費するため、当選者数は seats / m になる
    const winners = seats / m;

    const expectedWinners = (entryProb) => {
      const z = 1 - entryProb;
      let zk = 1;
      let pgf = 0;
      for (let k = 1; k < q.length; k++) {
        zk *= z;
        pgf += q[k] * zk;
      }
      return people * (1 - pgf);
    };

    let entryProb;
    if (winners <= 0) {
      entryProb = 0;
    } else if (winners >= people) {
      entryProb = 1;
    } else {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (expectedWinners(mid) < winners) lo = mid; else hi = mid;
      }
      entryProb = (lo + hi) / 2;
    }

    const winProb = (k) => (entryProb >= 1 ? 1 : -Math.expm1(k * Math.log1p(-entryProb)));
    // 落選すると積んだCDの代金がすべて無駄になるとみなしたときの、無駄になる金額の期待値
    const expectedLoss = (k) => state.cdPrice * k * (1 - winProb(k));
    const odds = entryProb > 0 ? 1 / entryProb : null;
    return { seats, winners, serials, people, entryProb, odds, winProb, expectedLoss, q, notice };
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
    winOptions.scales.y1 = {
      position: "right",
      beginAtZero: true,
      grid: { drawOnChartArea: false },
      title: { display: true, text: "期待損失額" },
      ticks: { callback: (v) => `${fmtNum(v)}円` },
    };
    winOptions.plugins.legend = { display: false, labels: { boxWidth: 14, boxHeight: 2 } };
    winOptions.plugins.tooltip.displayColors = true;
    winOptions.plugins.tooltip.callbacks.label = (item) => (item.datasetIndex === 0
      ? `当選確率: ${fmtPct(item.parsed.y / 100)}`
      : `期待損失額: ${fmtYen(item.parsed.y)}`);
    winChart = new Chart($("win-chart"), {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "当選確率", yAxisID: "y", data: [], borderColor: BLUE, borderWidth: 2.5, backgroundColor: "rgba(93, 167, 217, .2)", fill: true, tension: 0.25, pointBorderColor: BLUE, pointBorderWidth: 2 },
          { label: "期待損失額", yAxisID: "y1", data: [], borderColor: ORANGE, borderWidth: 2, backgroundColor: ORANGE, fill: false, tension: 0.25, pointBorderColor: ORANGE, pointBorderWidth: 2 },
        ],
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

    const win = winChart.data.datasets[0];
    winChart.data.labels = ks;
    win.data = ks.map((k) => model.winProb(k) * 100);
    win.pointRadius = ks.map((k) => (isCurrent(k) ? 7 : xmax <= 30 ? 3 : 0));
    win.pointHoverRadius = ks.map((k) => (isCurrent(k) ? 8 : 5));
    win.pointBackgroundColor = ks.map((k) => (isCurrent(k) ? YELLOW : "#fff"));
    const loss = winChart.data.datasets[1];
    loss.hidden = !state.showLoss;
    winChart.options.scales.y1.display = state.showLoss;
    winChart.options.plugins.legend.display = state.showLoss;
    loss.data = ks.map((k) => model.expectedLoss(k));
    loss.pointRadius = ks.map((k) => (isCurrent(k) ? 7 : xmax <= 30 ? 3 : 0));
    loss.pointHoverRadius = ks.map((k) => (isCurrent(k) ? 8 : 5));
    loss.pointBackgroundColor = ks.map((k) => (isCurrent(k) ? YELLOW : "#fff"));
    winChart.update();

    const dist = distChart.data.datasets[0];
    distChart.data.labels = ks;
    dist.data = ks.map((k) => (model.q[k] ?? 0) * 100);
    dist.backgroundColor = ks.map((k) => (isCurrent(k) ? BLUE : BLUE_PALE));
    dist.hoverBackgroundColor = ks.map((k) => (isCurrent(k) ? BLUE : BLUE_SOFT));
    distChart.update();
  }

  function render() {
    const prob = model.winProb(state.stack);
    const loss = model.expectedLoss(state.stack);
    $("result-prob").textContent = fmtPct(prob);
    $("result-loss").textContent = fmtYen(loss);
    $("result-loss-card").hidden = !state.showLoss;
    $("stat-seats").textContent = `${fmtNum(model.seats, 1)}席`;
    $("stat-serials").textContent = `${fmtNum(model.serials)}枚`;
    $("stat-people").textContent = `${fmtNum(model.people)}人`;
    $("stat-serial-prob").textContent = fmtPct(model.entryProb);
    $("stat-odds").textContent = model.odds === null ? "-" : `${fmtNum(model.odds, 1)}倍`;
    $("win-chart").setAttribute("aria-label", state.showLoss
      ? `積み枚数ごとの当選確率と期待損失額のグラフ。積み${state.stack}枚で当選確率${fmtPct(prob)}、期待損失額${fmtYen(loss)}`
      : `積み枚数ごとの当選確率のグラフ。積み${state.stack}枚で${fmtPct(prob)}`);
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
      onEdited(field);
    });
    number.addEventListener("input", () => {
      const value = Number(number.value);
      const valid = number.value.trim() !== "" && Number.isFinite(value)
        && value >= field.hardMin && value <= field.hardMax && (!field.int || Number.isInteger(value));
      number.setAttribute("aria-invalid", String(!valid));
      if (!valid) return;
      setValue(field.key, value, number);
      onEdited(field);
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

  function onEdited() {
    update();
  }

  function applyLive(live) {
    for (const [key, value] of Object.entries(live.params)) setValue(key, value);
    for (const { number } of Object.values(inputs)) number.removeAttribute("aria-invalid");
    $("live-link").hidden = false;
    $("live-link").href = live.url;
    update();
  }

  select.innerHTML = LIVES.map((live) => `<option value="${live.id}">${live.name}</option>`)  .join("");
  select.addEventListener("change", () => {
    const live = LIVES.find((item) => item.id === select.value);
    if (live) applyLive(live);
  });
  FIELDS.forEach(createField);
  const showLoss = $("show-loss");
  const applyShowLoss = () => {
    state.showLoss = showLoss.checked;
    $("loss-fields").classList.toggle("is-disabled", !state.showLoss);
    for (const input of $("loss-fields").querySelectorAll("input")) input.disabled = !state.showLoss;
  };
  showLoss.addEventListener("change", () => {
    applyShowLoss();
    update();
  });
  applyShowLoss();
  createCharts();
  select.value = LIVES[0].id;
  applyLive(LIVES[0]);

  renderMath();
})();
