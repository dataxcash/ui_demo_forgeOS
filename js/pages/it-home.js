import {
  getItDashboard,
  getItServices,
  getItCompute,
  getItAispaceCap,
  getItRemote,
  getItStorage,
  restartItService,
} from "../api-mock.js?v=nav55";
import { confirmDialog } from "../confirm.js?v=nav55";
import { esc } from "../esc.js?v=nav55";
import { iconForNavKey, pageTitleHtml } from "../icons.js?v=nav55";

export const roles = ["it"];
export const title = "系统管理";

function headHtml(navKey, title, sub) {
  const ico = iconForNavKey(navKey);
  return `<div class="page-head">
    <h1>${pageTitleHtml(ico, esc(title))}</h1>
    <p>${esc(sub)}</p>
  </div>`;
}

function resolveView(url) {
  const file = url.pathname.split("/").pop() || "";
  let view = url.searchParams.get("view") || "";
  if (!view) {
    if (file === "it-job.html") view = "services";
    else view = "dashboard";
  }
  return view;
}

export function activeKey(url) {
  const view = resolveView(url);
  if (view === "services") return "it-services";
  if (view === "compute") return "it-compute";
  if (view === "aispace") return "it-aispace";
  if (view === "remote") return "it-remote";
  if (view === "storage") return "it-storage";
  return "it-dashboard";
}

export async function activate({ account, url, root }) {
  const view = resolveView(url);
  const q0 = url.searchParams.get("q") || "";

  async function go(nextView, push, extra = {}) {
    const { softNavigate } = await import("../soft-nav.js?v=nav55");
    const u = new URL("./it-home.html", location.href);
    u.searchParams.set("view", nextView);
    if (extra.q) u.searchParams.set("q", extra.q);
    await softNavigate(u, { push });
  }

  if (view === "services") return paintServices();
  if (view === "compute") return paintCompute();
  if (view === "aispace") return paintAispace();
  if (view === "remote") return paintRemote(q0);
  if (view === "storage") return paintStorage();
  return paintDashboard();

  function overallClass(s) {
    if (s === "就绪" || s === "正常") return "ok";
    if (s === "未就绪" || s === "失败" || s === "掉线" || s === "异常")
      return "danger";
    return "warn";
  }

  async function paintDashboard() {
    document.title = "运行状态 · 系统管理";
    const d = await getItDashboard();
    const ranges = ["5m", "1h", "6h", "24h"];
    let range =
      new URL(location.href).searchParams.get("range") ||
      d.defaultRange ||
      "5m";
    if (!ranges.includes(range)) range = "5m";

    function lineChart(seriesList, opts = {}) {
      const w = opts.w || 560;
      const h = opts.h || 90;
      const pad = 4;
      const series = (seriesList || []).map((s) => ({
        vals: (s.vals || []).map(Number),
        cls: s.cls || "it-chart-a",
      }));
      const n = Math.max(...series.map((s) => s.vals.length), 1);
      const step = n > 1 ? (w - pad * 2) / (n - 1) : 0;
      const lines = series
        .map((s) => {
          if (!s.vals.length) return "";
          const max = Math.max(...s.vals, 1);
          const min = Math.min(...s.vals, 0);
          const span = Math.max(max - min, 1);
          const pts = s.vals
            .map((v, i) => {
              const x = pad + i * step;
              const y = h - pad - ((v - min) / span) * (h - pad * 2);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          return `<polyline class="${s.cls}" fill="none" stroke-width="1.5" points="${pts}"/>`;
        })
        .join("");
      return `<svg class="it-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>`;
    }

    function render() {
      const r = d.resources || {};
      const inf = d.inference || {};
      const ser = (d.series && d.series[range]) || {};
      const alerts = (d.alerts || []).slice(0, 2);
      const ico = iconForNavKey("it-dashboard");

      root.innerHTML = `
        <div class="flash" id="flash"></div>
        <div class="page-head it-run-head">
          <div>
            <h1>${pageTitleHtml(ico, "运行状态")}</h1>
            <p>System &amp; Inference · 截至 ${esc(d.asOf || "")}</p>
          </div>
          <div class="it-range" role="tablist" aria-label="时间范围">
            ${ranges
              .map(
                (x) =>
                  `<button type="button" class="it-range-btn${
                    x === range ? " active" : ""
                  }" data-range="${x}" role="tab" aria-selected="${
                    x === range
                  }">${x}</button>`
              )
              .join("")}
          </div>
        </div>

        <div class="it-res-row">
          <div class="it-res-strip">
            ${resCell("GPU", `${r.gpu ?? "—"}%`)}
            ${resCell("CPU", `${r.cpu ?? "—"}%`)}
            ${resCell("MEM", `${r.mem ?? "—"}%`)}
            ${resCell("KV", `${r.kvCache ?? "—"}%`)}
          </div>
          <div class="it-alert-strip" id="alerts">
            ${
              alerts.length
                ? alerts
                    .map(
                      (a) =>
                        `<a class="it-alert-item ${
                          a.level === "danger" ? "danger" : "warn"
                        }" href="${esc(a.href)}"><i class="it-alert-dot" aria-hidden="true"></i><span>${esc(
                          a.text
                        )}</span></a>`
                    )
                    .join("")
                : `<span class="muted small">暂无须处理</span>`
            }
          </div>
        </div>

        <h2 class="it-sec-title">SYSTEM</h2>
        <div class="card it-chart-card">
          <div class="it-chart-meta">
            <span class="dash-k">GPU Util / VRAM</span>
            <span class="it-chart-legend">
              <i class="it-leg-a"></i> Util %
              <i class="it-leg-b"></i> VRAM %
            </span>
          </div>
          ${lineChart([
            { vals: ser.gpuUtil, cls: "it-chart-a" },
            { vals: ser.gpuVram, cls: "it-chart-b" },
          ])}
        </div>

        <h2 class="it-sec-title">INFERENCE</h2>
        <div class="it-kpi-row">
          <div class="it-kpi">
            <div class="dash-k">TTFT</div>
            <div class="it-metric-v">${inf.ttftP50Ms ?? "—"}<span class="it-kpi-unit">ms</span></div>
            <div class="muted small">p50 · p95 ${inf.ttftP95Ms ?? "—"} ms</div>
          </div>
          <div class="it-kpi">
            <div class="dash-k">TOK/S</div>
            <div class="it-metric-v">${fmtNum(inf.tokPerSecAgg ?? 0)}</div>
            <div class="muted small">整机 · 单请求 ${inf.tokPerSecPerReq ?? "—"}</div>
          </div>
          <div class="it-kpi">
            <div class="dash-k">进行中</div>
            <div class="it-metric-v">${inf.active ?? "—"}</div>
            <div class="muted small">Active requests</div>
          </div>
          <div class="it-kpi">
            <div class="dash-k">排队</div>
            <div class="it-metric-v">${inf.queue ?? "—"}</div>
            <div class="muted small">Queue</div>
          </div>
        </div>
        <div class="it-inf-charts">
          <div class="card it-chart-card">
            <div class="it-chart-meta">
              <span class="dash-k">TTFT p50</span>
              <span class="muted small">ms</span>
            </div>
            ${lineChart([{ vals: ser.ttftP50, cls: "it-chart-a" }])}
          </div>
          <div class="card it-chart-card">
            <div class="it-chart-meta">
              <span class="dash-k">TOK/S</span>
              <span class="muted small">整机</span>
            </div>
            ${lineChart([{ vals: ser.tokPerSec, cls: "it-chart-a" }])}
          </div>
        </div>

        <h2 class="it-sec-title">MODELS</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Model</th>
              <th>TTFT</th>
              <th>TOK/S</th>
              <th>Active</th>
              <th>Queue</th>
            </tr>
          </thead>
          <tbody>
            ${(d.models || [])
              .map(
                (m) => `<tr>
              <td><strong>${esc(m.name)}</strong></td>
              <td>${m.ttftP50Ms ?? "—"} ms</td>
              <td>${m.tokPerSec ?? "—"}</td>
              <td>${m.active ?? "—"}</td>
              <td>${m.queue ?? "—"}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>`;

      root.querySelector(".it-range").onclick = (e) => {
        const btn = e.target.closest("[data-range]");
        if (!btn) return;
        range = btn.getAttribute("data-range");
        const u = new URL(location.href);
        u.searchParams.set("view", "dashboard");
        u.searchParams.set("range", range);
        history.replaceState({}, "", u);
        render();
      };
    }

    function resCell(label, value) {
      return `<div class="it-res">
        <span class="dash-k">${esc(label)}</span>
        <strong>${esc(String(value))}</strong>
      </div>`;
    }

    render();
  }

  function metric(label, value, href) {
    return `<a class="it-metric" href="${esc(href)}">
      <div class="dash-k">${esc(label)}</div>
      <div class="it-metric-v">${esc(value)}</div>
    </a>`;
  }

  function capMetric(label, value) {
    return `<div class="it-metric" style="cursor:default">
      <div class="dash-k">${esc(label)}</div>
      <div class="it-metric-v">${esc(value)}</div>
    </div>`;
  }

  async function paintServices() {
    document.title = "服务状态 · 系统管理";
    const s = await getItServices();
    const domains = s.domains || [];
    const all = domains.flatMap((d) => d.services || []);
    const nameById = Object.fromEntries(all.map((x) => [x.id, x.name]));
    const nRun = all.filter((x) => svcOk(x.status)).length;
    const nBad = all.filter((x) => svcBad(x.status)).length;
    const nDeg = all.filter((x) => !svcOk(x.status) && !svcBad(x.status)).length;
    const platform =
      nBad > 0 ? "异常" : nDeg > 0 ? "降级" : "正常";
    const audit = s.audit || {};

    root.innerHTML = `
      <div class="flash" id="flash"></div>
      ${headHtml(
        "it-services",
        "服务状态",
        `Runtime & Dependencies · 截至 ${s.asOf || ""}`
      )}

      <div class="it-res-row it-svc-summary">
        <div class="it-res-strip">
          <div class="it-res">
            <span class="dash-k">平台状态</span>
            <strong><span class="pill ${overallClass(platform)}">${esc(
              platform
            )}</span></strong>
          </div>
          <div class="it-res"><span class="dash-k">运行中</span><strong>${nRun}</strong></div>
          <div class="it-res"><span class="dash-k">异常</span><strong>${nBad}</strong></div>
          <div class="it-res"><span class="dash-k">降级</span><strong>${nDeg}</strong></div>
        </div>
      </div>

      <h2 class="it-sec-title">CORE RUNTIME</h2>
      <div class="it-svc-domains" id="domains"></div>

      <h2 class="it-sec-title">AUDIT</h2>
      <div class="it-kpi-row it-audit-kpi">
        <div class="it-kpi">
          <div class="dash-k">审计服务</div>
          <div class="it-metric-v" style="font-size:16px">
            <span class="pill ${statusPill(audit.serviceStatus)}">${esc(
              audit.serviceStatus || "—"
            )}</span>
          </div>
        </div>
        <div class="it-kpi">
          <div class="dash-k">写入</div>
          <div class="it-metric-v" style="font-size:16px">
            <span class="pill ${statusPill(audit.writeStatus)}">${esc(
              audit.writeStatus || "—"
            )}</span>
          </div>
        </div>
        <div class="it-kpi">
          <div class="dash-k">积压</div>
          <div class="it-metric-v">${audit.backlog ?? "—"}</div>
        </div>
        <div class="it-kpi">
          <div class="dash-k">最近写入</div>
          <div class="it-metric-v" style="font-size:15px">${esc(
            audit.lastWriteAt || "—"
          )}</div>
        </div>
        <div class="it-kpi">
          <div class="dash-k">审计存储</div>
          <div class="it-metric-v" style="font-size:16px">
            <span class="pill ${statusPill(audit.storeStatus)}">${esc(
              audit.storeStatus || "—"
            )}</span>
          </div>
        </div>
      </div>

      <h2 class="it-sec-title">SCHEDULED JOBS</h2>
      <table class="table">
        <thead><tr><th>作业</th><th>状态</th><th>开始</th><th>说明</th></tr></thead>
        <tbody id="jobs"></tbody>
      </table>`;

    const domainsEl = root.querySelector("#domains");
    domainsEl.innerHTML = domains
      .map((d) => {
        const rows = (d.services || [])
          .map((c) => {
            const deps = (c.dependsOn || [])
              .map((id) => nameById[id] || id)
              .join("、");
            return `<div class="it-svc-row-lite" data-svc="${esc(c.id)}">
              <div class="it-svc-row-main">
                <span class="pill ${statusPill(c.status)}">${esc(c.status)}</span>
                <strong>${esc(c.name)}</strong>
                ${
                  deps
                    ? `<span class="muted small">依赖 ${esc(deps)}</span>`
                    : ""
                }
                <div class="muted small">${esc(c.detail || "")}</div>
              </div>
              <div class="it-svc-actions">
                ${
                  c.canRestart
                    ? `<button type="button" class="btn" data-restart="${esc(
                        c.id
                      )}">重启</button>`
                    : ""
                }
              </div>
            </div>`;
          })
          .join("");
        return `<section class="it-svc-domain">
          <h3 class="it-svc-domain-title">${esc(d.title)}</h3>
          ${rows}
        </section>`;
      })
      .join("");

    root.querySelector("#jobs").innerHTML = (s.jobs || [])
      .map((j) => {
        const cls =
          j.status === "失败" ? "danger" : j.status === "成功" ? "ok" : "warn";
        return `<tr>
          <td><strong>${esc(j.name)}</strong><div class="muted small">${esc(j.id)}</div></td>
          <td><span class="pill ${cls}">${esc(j.status)}</span></td>
          <td class="small">${esc(j.started)}</td>
          <td class="small">${esc(j.log)}</td>
        </tr>`;
      })
      .join("");

    domainsEl.onclick = async (e) => {
      const btn = e.target.closest("[data-restart]");
      if (!btn) return;
      const id = btn.getAttribute("data-restart");
      const ok = await confirmDialog({
        title: "重启该服务？",
        body: "重启可能短暂影响相关能力。推理请求会按网关策略排队或降级。",
        confirmText: "确认重启",
      });
      if (!ok) return;
      await restartItService(id);
      const flash = root.querySelector("#flash");
      flash.textContent = `已提交重启：${id}`;
      flash.classList.add("show");
    };

    function svcOk(st) {
      return st === "就绪" || st === "运行中" || st === "正常" || st === "成功";
    }
    function svcBad(st) {
      return st === "失败" || st === "有失败" || st === "未就绪" || st === "掉线";
    }
  }

  function statusPill(st) {
    if (st === "就绪" || st === "运行中" || st === "成功" || st === "正常")
      return "ok";
    if (st === "失败" || st === "有失败" || st === "未就绪" || st === "掉线")
      return "danger";
    return "warn";
  }

  function sparkline(points, key = "used", opts = {}) {
    const w = opts.w || 160;
    const h = opts.h || 36;
    const vals = points.map((p) => Number(p[key]) || 0);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const span = Math.max(max - min, 1);
    const step = vals.length > 1 ? w / (vals.length - 1) : w;
    const coords = vals
      .map((v, i) => {
        const x = i * step;
        const y = h - ((v - min) / span) * (h - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const last = vals[vals.length - 1] || 0;
    const prev = vals[vals.length - 2] || last;
    const delta = last - prev;
    const deltaCls = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const deltaTxt =
      delta === 0 ? "持平" : delta > 0 ? `↑ ${fmtNum(delta)}` : `↓ ${fmtNum(-delta)}`;
    return {
      svg: `<svg class="it-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="1.5" points="${coords}"/></svg>`,
      deltaCls,
      deltaTxt,
      last,
      max,
    };
  }

  function fmtNum(n) {
    return Number(n).toLocaleString();
  }

  function trendLabel(points, key = "used") {
    if (!points?.length) return { text: "—", cls: "" };
    const vals = points.map((p) => Number(p[key]) || 0);
    const recent = vals.slice(-3);
    const earlier = vals.slice(-6, -3);
    if (!earlier.length) return { text: "样本不足", cls: "" };
    const a = earlier.reduce((s, x) => s + x, 0) / earlier.length;
    const b = recent.reduce((s, x) => s + x, 0) / recent.length;
    const pct = a ? Math.round(((b - a) / a) * 100) : 0;
    if (Math.abs(pct) < 5) return { text: "近三日波动不大", cls: "flat" };
    if (pct > 0) return { text: `近三日偏高约 ${pct}%`, cls: "up" };
    return { text: `近三日偏低约 ${-pct}%`, cls: "down" };
  }

  async function paintCompute() {
    document.title = "算力与 GPU · 系统管理";
    const c = await getItCompute();
    const models = [...(c.models || [])].sort(
      (a, b) => b.todayUsed - a.todayUsed
    );
    const total = c.tokenA.todayUsed || 1;
    const pct = Math.round((c.tokenA.todayUsed / c.tokenA.todayQuota) * 100);
    const overallSpark = sparkline(c.tokenA.historyDays || [], "used", {
      w: 220,
      h: 44,
    });
    const overallTrend = trendLabel(c.tokenA.historyDays || [], "used");
    let selected =
      new URL(location.href).searchParams.get("model") || models[0]?.id || "";

    function render() {
      const m = models.find((x) => x.id === selected) || models[0];
      const cap = c.capacity || {};
      const npu =
        cap.npuTops == null
          ? "—"
          : `${Number(cap.npuTops).toLocaleString()} TOPS`;
      root.innerHTML = `
        ${headHtml(
          "it-compute",
          "算力与 GPU",
          `Usage & Capacity · 截至 ${c.asOf || ""}`
        )}

        <h2 class="it-sec-title">${esc(cap.title || "静态能力 / 容量")}</h2>
        <p class="muted small" style="margin:-4px 0 8px">${esc(
          cap.note || "这台机器理论上有什么能力；运行态请看「运行状态」。"
        )}</p>
        <div class="it-metrics">
          ${capMetric(
            "CPU",
            cap.cpu ? `${cap.cpu.cores} 核 / ${cap.cpu.threads} 线程` : "—"
          )}
          ${capMetric("内存", cap.memGb != null ? `${cap.memGb} GB` : "—")}
          ${capMetric(
            "最大可用显存",
            cap.vramGb != null ? `${cap.vramGb} GB` : "—"
          )}
          ${capMetric(
            "显存带宽",
            cap.vramBwTBs != null ? `${cap.vramBwTBs} TB/s` : "—"
          )}
          ${capMetric(
            "PCIe 带宽",
            cap.pcieBwGBs != null ? `${cap.pcieBwGBs} GB/s` : "—"
          )}
          ${capMetric("SSD 存储", cap.ssdTb != null ? `${cap.ssdTb} TB` : "—")}
          ${capMetric(
            "GPU 算力",
            cap.gpuTops != null ? `${cap.gpuTops} TOPS` : "—"
          )}
          ${capMetric("NPU 算力", npu)}
        </div>

        <div class="card" style="margin-top:14px">
          <div class="it-svc-row">
            <div>
              <div class="dash-k">全模型合计 · 今日 Token</div>
              <div class="stat">${fmtNum(c.tokenA.todayUsed)}
                <span class="stat-label">/ ${fmtNum(c.tokenA.todayQuota)}</span></div>
              <p class="muted small" style="margin:4px 0 0">配额已用 ${pct}%
                · <span class="it-trend ${overallTrend.cls}">${esc(
                  overallTrend.text
                )}</span>
                · 较昨日 ${esc(overallSpark.deltaTxt)}</p>
            </div>
            <div class="it-spark-wrap" title="近 14 日合计消耗">${overallSpark.svg}</div>
          </div>
          <div class="it-bar"><i style="width:${pct}%"></i></div>
        </div>

        <h2 class="it-sec-title">一、按模型</h2>
        <p class="muted small" style="margin:-4px 0 8px">点选查看趋势与部门拆分。驻留 = 当前占显存。</p>
        <div class="it-model-list" id="model-list"></div>

        <div id="model-detail"></div>

        <h2 class="it-sec-title">二、按部门 · Token 用量</h2>
        <table class="table">
          <thead><tr><th>部门</th><th>今日 Token</th><th>占比</th><th>配额</th><th></th></tr></thead>
          <tbody>
            ${(c.byDeptToday || [])
              .map((r) => {
                const share = Math.round((r.used / total) * 100);
                const quota =
                  r.quota != null ? fmtNum(r.quota) : "—";
                return `<tr>
                  <td>${esc(r.name)}</td>
                  <td>${fmtNum(r.used)}</td>
                  <td>${share}%</td>
                  <td class="muted">${quota}</td>
                  <td style="min-width:120px"><div class="it-bar"><i style="width:${share}%"></i></div></td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>

        <h2 class="it-sec-title">三、GPU 资源</h2>
        <div id="gpus"></div>`;

      root.querySelector("#model-list").innerHTML = models
        .map((mod) => {
          const share = Math.round((mod.todayUsed / total) * 100);
          const sp = sparkline(mod.historyDays || [], "used");
          const tr = trendLabel(mod.historyDays || [], "used");
          const active = mod.id === (m?.id || "") ? " active" : "";
          return `<button type="button" class="it-model-row${active}" data-model="${esc(
            mod.id
          )}">
            <div class="it-model-main">
              <div class="it-model-title">
                <strong>${esc(mod.name)}</strong>
                <span class="pill ${mod.resident ? "ok" : ""}">${
                  mod.resident ? "驻留" : "按需"
                }</span>
                <span class="muted small">${esc(mod.size)}</span>
              </div>
              <div class="muted small">今日 ${fmtNum(mod.todayUsed)} Token
                · ${fmtNum(mod.todayCalls)} 次
                · 占合计 ${share}%
                · <span class="it-trend ${tr.cls}">${esc(tr.text)}</span></div>
            </div>
            <div class="it-spark-wrap">${sp.svg}</div>
          </button>`;
        })
        .join("");

      const detail = root.querySelector("#model-detail");
      if (m) {
        const sp = sparkline(m.historyDays || [], "used", { w: 280, h: 56 });
        const tr = trendLabel(m.historyDays || [], "used");
        const days = m.historyDays || [];
        detail.innerHTML = `
          <div class="card it-model-detail">
            <div class="it-svc-row">
              <div>
                <div class="dash-k">当前模型</div>
                <strong style="font-size:16px">${esc(m.name)}</strong>
                <span class="pill ${m.resident ? "ok" : ""}" style="margin-left:8px">${
                  m.resident ? "驻留" : "按需"
                }</span>
                <p class="muted small" style="margin:4px 0 0">${esc(tr.text)}
                  · 14 日峰值 ${fmtNum(sp.max)} · 较昨日 ${esc(sp.deltaTxt)}</p>
              </div>
              <div class="it-spark-wrap">${sp.svg}</div>
            </div>
            <h3 class="it-sec-title" style="margin-top:12px">该模型 · 近 14 日用量</h3>
            <div class="it-hist-bars" title="每日 Token">
              ${days
                .map((d) => {
                  const h = Math.max(
                    4,
                    Math.round((d.used / sp.max) * 64)
                  );
                  return `<div class="it-hist-col">
                    <div class="it-hist-bar" style="height:${h}px" title="${esc(
                      d.day
                    )}: ${fmtNum(d.used)}"></div>
                    <span>${esc(d.day.slice(3))}</span>
                  </div>`;
                })
                .join("")}
            </div>
            <h3 class="it-sec-title">该模型 · 今日按部门</h3>
            <table class="table">
              <thead><tr><th>部门</th><th>Token</th><th>占本模型</th></tr></thead>
              <tbody>
                ${(m.byDept || [])
                  .map((r) => {
                    const share = Math.round((r.used / (m.todayUsed || 1)) * 100);
                    return `<tr>
                      <td>${esc(r.name)}</td>
                      <td>${fmtNum(r.used)}</td>
                      <td>${share}%</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>`;
      } else {
        detail.innerHTML = "";
      }

      root.querySelector("#model-list").onclick = (e) => {
        const btn = e.target.closest("[data-model]");
        if (!btn) return;
        selected = btn.getAttribute("data-model");
        const u = new URL(location.href);
        u.searchParams.set("view", "compute");
        u.searchParams.set("model", selected);
        history.replaceState({}, "", u);
        render();
      };

      root.querySelector("#gpus").innerHTML = (c.gpu || [])
        .map((g) => {
          const vramPct = g.vramTotalGb
            ? Math.round((g.vramUsedGb / g.vramTotalGb) * 100)
            : 0;
          return `<div class="card">
            <div class="it-svc-row">
              <div>
                <strong>${esc(g.name || g.id)}</strong>
                <div class="muted small" style="margin-top:4px">驻留：${esc(
                  (g.residentModels || []).join("、") || "—"
                )}</div>
              </div>
              <div>
                <div class="dash-k">显存</div>
                <div class="it-metric-v" style="font-size:16px">${g.vramUsedGb} / ${g.vramTotalGb} GB</div>
              </div>
            </div>
            <div class="it-bar" style="margin-top:10px"><i style="width:${vramPct}%"></i></div>
            <p class="muted small" style="margin:6px 0 0">已用 ${vramPct}%</p>
          </div>`;
        })
        .join("");
    }

    render();
  }

  async function paintAispace() {
    const a = await getItAispaceCap();
    const title = a.pageTitle || "aiSpace 后端";
    document.title = `${title} · 系统管理`;
    const rt = a.runtime || {};
    const store = a.objectStore || a.capacity || {};
    const usedTb = store.usedTb ?? store.objectsTb;
    const limitTb = store.limitTb ?? store.objectsLimitTb;
    const usedPct =
      usedTb != null && limitTb
        ? Math.round((usedTb / limitTb) * 100)
        : 0;
    const services = a.services || [];

    root.innerHTML = `
      ${headHtml(
        "it-aispace",
        title,
        `${a.pageSub || "Runtime & Object Store"} · 截至 ${a.asOf || ""}`
      )}

      <div class="it-kpi-row">
        <div class="it-kpi">
          <div class="dash-k">REQUESTS</div>
          <div class="it-metric-v">${rt.requestsPerSec ?? "—"}<span class="it-kpi-unit">/s</span></div>
          <div class="muted small">后端 API</div>
        </div>
        <div class="it-kpi">
          <div class="dash-k">P95</div>
          <div class="it-metric-v">${rt.p95Ms ?? "—"}<span class="it-kpi-unit">ms</span></div>
          <div class="muted small">编排延迟</div>
        </div>
        <div class="it-kpi">
          <div class="dash-k">ERROR</div>
          <div class="it-metric-v">${rt.errorRatePct ?? "—"}<span class="it-kpi-unit">%</span></div>
          <div class="muted small">错误率</div>
        </div>
        <div class="it-kpi">
          <div class="dash-k">QUEUE</div>
          <div class="it-metric-v">${rt.queue ?? "—"}</div>
          <div class="muted small">待处理</div>
        </div>
      </div>

      <h2 class="it-sec-title">RUNTIME</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Component</th>
            <th>Status</th>
            <th>Uptime</th>
            <th>CPU</th>
            <th>MEM</th>
            <th>Dependency</th>
          </tr>
        </thead>
        <tbody>
          ${services
            .map(
              (s) => `<tr>
              <td><strong><code>${esc(s.name || s.id)}</code></strong></td>
              <td><span class="pill ${statusPill(s.status)}">${esc(
                s.status || "—"
              )}</span></td>
              <td class="small">${esc(s.uptime || "—")}</td>
              <td class="small">${s.cpuPct != null ? `${s.cpuPct}%` : "—"}</td>
              <td class="small">${s.memGb != null ? `${s.memGb} GB` : "—"}</td>
              <td class="small muted">${esc(
                (s.deps || []).join(" / ") || "—"
              )}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <h2 class="it-sec-title">DEPENDENCIES</h2>
      <div class="it-dep-graph" aria-label="依赖拓扑">
        <div class="it-dep-row"><span class="it-dep-node">aispace</span></div>
        <div class="it-dep-fork" aria-hidden="true"><span></span><span></span></div>
        <div class="it-dep-row it-dep-pair">
          <span class="it-dep-node">slimgraphd</span>
          <span class="it-dep-node">slimRAG</span>
        </div>
        <div class="it-dep-join" aria-hidden="true"><span></span><span></span></div>
        <div class="it-dep-row"><span class="it-dep-node">obj-gw</span></div>
        <div class="it-dep-line" aria-hidden="true"></div>
        <div class="it-dep-row"><span class="it-dep-node muted">storaged</span></div>
      </div>

      <h2 class="it-sec-title">OBJECT STORE</h2>
      <div class="card it-obj-store">
        <div class="it-svc-row">
          <div>
            <div class="stat">${usedTb ?? "—"} TB
              <span class="stat-label">/ ${limitTb ?? "—"} TB</span></div>
            <p class="muted small" style="margin:6px 0 0">
              Hot ${store.hotPct ?? "—"}% · Cold ${store.coldPct ?? "—"}% · Objects ${esc(
                String(store.objects || "—")
              )}
            </p>
          </div>
          <div class="muted small" style="text-align:right">
            Write ${esc(store.writeStatus || "—")} · Read ${esc(
              store.readStatus || "—"
            )}
          </div>
        </div>
        <div class="it-bar" style="margin-top:10px"><i style="width:${usedPct}%"></i></div>
        <p class="muted small" style="margin:6px 0 0">已用约 ${usedPct}%</p>
      </div>`;
  }

  async function paintRemote(initialQ) {
    document.title = "远程机器 · 系统管理";
    const pack = await getItRemote();
    const switches = pack.switches || [];
    const hosts = pack.hosts || [];
    const disco = pack.discovery || {};
    const swMap = Object.fromEntries(switches.map((s) => [s.id, s]));

    function hostStatusClass(st) {
      if (st === "在线") return "ok";
      if (st === "掉线" || st === "未部署") return "danger";
      return "warn";
    }

    function swStatusClass(st) {
      if (st === "正常") return "ok";
      if (st === "告警") return "warn";
      return "danger";
    }

    function swShort(s) {
      const n = s?.name || s?.id || "—";
      const parts = n.split(" · ");
      return parts.length > 1 ? parts[parts.length - 1] : n;
    }

    function probeHealth(h) {
      const probes = h.probes || [];
      if (!probes.length) {
        return { text: h.status === "未部署" ? "未部署" : "无探针", cls: "warn" };
      }
      if (probes.some((p) => p.status === "掉线"))
        return { text: "探针掉线", cls: "danger" };
      if (probes.some((p) => p.status === "延迟"))
        return { text: "探针延迟", cls: "warn" };
      return { text: "探针正常", cls: "ok" };
    }

    function probeNames(h) {
      return (h.probes || []).map((p) => p.name);
    }

    function hasAgent(h) {
      if ((h.probes || []).length) return true;
      return (h.services || []).some((s) =>
        /envPD|slimHub|探测|枢纽|agent/i.test(`${s.name || ""} ${s.kind || ""}`)
      );
    }

    /** known/expected：无 expected 时只报 discovered，不伪造分母 */
    function cognRatio(block, fallbackKnown) {
      const known = block?.known ?? fallbackKnown;
      const expected = block?.expected;
      if (expected == null) return `${known} discovered`;
      return `${known} / ${expected}`;
    }

    function subtreeIds(rootId) {
      const ids = new Set([rootId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const s of switches) {
          if (s.parentId && ids.has(s.parentId) && !ids.has(s.id)) {
            ids.add(s.id);
            grew = true;
          }
        }
      }
      return ids;
    }

    function hostsUnder(swId) {
      const ids = subtreeIds(swId);
      return hosts.filter((h) => ids.has(h.switchId));
    }

    function orderedSwitches() {
      const roots = switches.filter((s) => !s.parentId);
      const out = [];
      function walk(node, depth) {
        out.push({ sw: node, depth });
        switches
          .filter((s) => s.parentId === node.id)
          .forEach((c) => walk(c, depth + 1));
      }
      roots.forEach((r) => walk(r, 0));
      // 孤儿节点（无父且不在 roots 集合外的）已覆盖；若有断链则追加
      const seen = new Set(out.map((x) => x.sw.id));
      switches.forEach((s) => {
        if (!seen.has(s.id)) out.push({ sw: s, depth: 0 });
      });
      return out;
    }

    const probeKinds = [
      ...new Set(hosts.flatMap((h) => probeNames(h))),
    ].sort();

    const nOnline = hosts.filter((h) => h.status === "在线").length;
    const nDelay = hosts.filter((h) => h.status === "延迟").length;
    const nDown = hosts.filter((h) => h.status === "掉线").length;
    const nUndeploy = hosts.filter((h) => h.status === "未部署").length;
    const nAgents =
      disco.agents?.known ?? hosts.filter(hasAgent).length;
    const topoKnown = disco.topology?.known ?? switches.length;
    const hostsKnown = disco.hosts?.known ?? hosts.length;

    const url0 = new URL(location.href);
    let selectedId =
      url0.searchParams.get("host") ||
      hosts.find((h) => h.status !== "在线")?.id ||
      hosts[0]?.id ||
      "";
    let selectedSw = url0.searchParams.get("switch") || "";

    const swRows = orderedSwitches();
    const lastDisco =
      (disco.lastAt || pack.asOf || "").replace(/^\d{4}-\d{2}-\d{2}\s*/, "") ||
      "—";

    root.innerHTML = `
      ${headHtml(
        "it-remote",
        "远程机器",
        `Remote Fleet & Discovery · 截至 ${pack.asOf || ""}`
      )}

      <section class="it-env" aria-label="Environment">
        <div class="it-env-label">Environment</div>
        <div class="it-env-summary">
          <span><strong>${switches.length}</strong> Switches</span>
          <span><strong>${hostsKnown}</strong> Hosts</span>
          <span><strong>${nAgents}</strong> Agents</span>
        </div>
        <div class="it-env-metrics">
          <div class="it-env-metric">Discovery · <strong>${esc(
            disco.status || "Known"
          )}</strong></div>
          <div class="it-env-metric">Topology · <strong>${esc(
            cognRatio(disco.topology, topoKnown)
          )}</strong></div>
          <div class="it-env-metric">Agent coverage · <strong>${esc(
            cognRatio(disco.agents, nAgents)
          )}</strong></div>
          <div class="it-env-metric">Last discovery · <strong>${esc(
            lastDisco
          )}</strong></div>
        </div>
        <div class="it-env-sw-list" id="env-sw-list">
          ${swRows
            .map(({ sw, depth }) => {
              const childSw = switches.filter((s) => s.parentId === sw.id)
                .length;
              const nHosts = hostsUnder(sw.id).length;
              // 核心等有下属交换机的节点：显示下挂交换机数；接入叶节点：显示 hosts
              const trail = childSw
                ? `${childSw} switches`
                : `${nHosts} hosts`;
              const short = swShort(sw);
              const indent = depth
                ? `<span class="it-env-sw-indent" aria-hidden="true">${"┆".repeat(
                    depth
                  )}</span>`
                : `<span class="it-env-sw-indent it-env-sw-indent-root" aria-hidden="true"></span>`;
              return `<button type="button" class="it-env-sw${
                depth === 0 ? " core" : ""
              }" data-sw="${esc(sw.id)}" title="${esc(sw.name)}">
                ${indent}
                <span class="it-env-sw-icon" aria-hidden="true">⌘</span>
                <span class="it-env-sw-name">${esc(short)}</span>
                <span class="pill ${swStatusClass(sw.status)}">${esc(
                  sw.status
                )}</span>
                <span class="it-env-sw-hosts">${esc(trail)}</span>
              </button>`;
            })
            .join("")}
        </div>
        <p class="muted small it-env-hint" id="env-sw-hint"></p>
      </section>

      <section class="it-fleet-sec" aria-label="Fleet">
        <div class="it-fleet-sec-head">
          <div class="it-env-label">Fleet</div>
          <div class="it-res-strip it-fleet-strip">
            <div class="it-res"><span class="dash-k">主机</span><strong>${hosts.length}</strong></div>
            <div class="it-res"><span class="dash-k">在线</span><strong>${nOnline}</strong></div>
            <div class="it-res"><span class="dash-k">延迟</span><strong>${nDelay}</strong></div>
            <div class="it-res"><span class="dash-k">掉线</span><strong>${nDown}</strong></div>
            <div class="it-res"><span class="dash-k">未部署</span><strong>${nUndeploy}</strong></div>
          </div>
        </div>

        <div class="it-filter-row" style="margin:10px 0 8px">
          <label>状态
            <select id="f-status">
              <option value="all">全部</option>
              <option value="在线">在线</option>
              <option value="延迟">延迟</option>
              <option value="掉线">掉线</option>
              <option value="未部署">未部署</option>
            </select>
          </label>
          <label>探针
            <select id="f-probe">
              <option value="all">全部</option>
              ${probeKinds
                .map((p) => `<option value="${esc(p)}">${esc(p)}</option>`)
                .join("")}
            </select>
          </label>
          <label class="it-filter-q">关键字
            <input id="f-q" type="search" placeholder="主机 / IP / 负责人 / 探针" value="${esc(
              initialQ
            )}" />
          </label>
        </div>
        <p class="muted small" id="f-count" style="margin:0 0 8px"></p>

        <div class="it-fleet-layout">
          <div class="it-fleet-table-wrap">
            <table class="table it-fleet-table">
              <thead>
                <tr>
                  <th>主机</th>
                  <th>状态</th>
                  <th>探针</th>
                  <th>最近见到</th>
                  <th>接入</th>
                </tr>
              </thead>
              <tbody id="host-list"></tbody>
            </table>
          </div>
          <div class="it-fleet-detail" id="host-detail"></div>
        </div>
      </section>`;

    const fStatus = root.querySelector("#f-status");
    const fProbe = root.querySelector("#f-probe");
    const fQ = root.querySelector("#f-q");
    const fCount = root.querySelector("#f-count");
    const hostList = root.querySelector("#host-list");
    const hostDetail = root.querySelector("#host-detail");
    const envSwList = root.querySelector("#env-sw-list");
    const envSwHint = root.querySelector("#env-sw-hint");

    function syncSwUi() {
      envSwList.querySelectorAll(".it-env-sw").forEach((btn) => {
        btn.classList.toggle(
          "active",
          btn.getAttribute("data-sw") === selectedSw
        );
      });
      if (selectedSw && swMap[selectedSw]) {
        const short = swShort(swMap[selectedSw]);
        const n = hostsUnder(selectedSw).length;
        envSwHint.innerHTML = `已按 <strong>${esc(
          short
        )}</strong> 过滤机队（${n} 台）· <button type="button" class="linkish" id="env-sw-clear">清除</button>`;
        const clr = root.querySelector("#env-sw-clear");
        if (clr) {
          clr.onclick = () => {
            selectedSw = "";
            syncUrl();
            apply();
          };
        }
      } else {
        envSwHint.textContent = "点击交换机可过滤下方机队；默认不展开主机树。";
      }
    }

    function syncUrl() {
      const u = new URL(location.href);
      u.searchParams.set("view", "remote");
      if (selectedId) u.searchParams.set("host", selectedId);
      else u.searchParams.delete("host");
      if (selectedSw) u.searchParams.set("switch", selectedSw);
      else u.searchParams.delete("switch");
      history.replaceState({}, "", u);
    }

    function filtered() {
      const st = fStatus.value;
      const probe = fProbe.value;
      const q = (fQ.value || "").trim().toLowerCase();
      const swScope = selectedSw ? subtreeIds(selectedSw) : null;
      return hosts.filter((h) => {
        if (swScope && !swScope.has(h.switchId)) return false;
        if (st !== "all" && h.status !== st) return false;
        if (probe !== "all" && !probeNames(h).includes(probe)) return false;
        if (q) {
          const blob = `${h.host} ${h.ip} ${h.owner} ${h.dept || ""} ${
            h.note || ""
          } ${probeNames(h).join(" ")} ${swShort(swMap[h.switchId]) || ""}`.toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      });
    }

    function renderDetail(h) {
      if (!h) {
        hostDetail.innerHTML = `<div class="empty">选择一台机器查看探针。</div>`;
        return;
      }
      const ph = probeHealth(h);
      const probes = h.probes || [];
      const sw = swMap[h.switchId];
      hostDetail.innerHTML = `
        <div class="it-fleet-detail-head">
          <div>
            <strong style="font-size:16px">${esc(h.host)}</strong>
            <div class="muted small" style="margin-top:4px">${esc(h.ip)}
              · ${esc(h.osFamily || h.os || "—")}</div>
          </div>
          <span class="pill ${hostStatusClass(h.status)}">${esc(h.status)}</span>
        </div>
        <div class="it-kpi-row" style="margin-top:12px; border-bottom:0; padding-bottom:0">
          <div class="it-kpi">
            <div class="dash-k">探针健康</div>
            <div class="it-metric-v" style="font-size:15px">
              <span class="pill ${ph.cls}">${esc(ph.text)}</span>
            </div>
          </div>
          <div class="it-kpi">
            <div class="dash-k">最近见到</div>
            <div class="it-metric-v" style="font-size:15px">${esc(h.lastSeen || "—")}</div>
          </div>
          <div class="it-kpi">
            <div class="dash-k">接入</div>
            <div class="muted small" style="margin-top:6px">${esc(
              swShort(sw)
            )}${h.switchPort ? ` · ${esc(h.switchPort)}` : ""}</div>
          </div>
        </div>

        <h3 class="it-sec-title">探针</h3>
        ${
          probes.length
            ? `<table class="table"><thead><tr><th>名称</th><th>类型</th><th>版本</th><th>状态</th></tr></thead><tbody>
            ${probes
              .map(
                (p) => `<tr>
                <td><strong>${esc(p.name)}</strong></td>
                <td class="small">${esc(p.kind || "—")}</td>
                <td class="small">${esc(p.version || "—")}</td>
                <td><span class="pill ${hostStatusClass(p.status)}">${esc(
                  p.status
                )}</span></td>
              </tr>`
              )
              .join("")}
          </tbody></table>`
            : `<p class="muted small">本机暂无进料/邮件探针${
                h.status === "未部署" ? "（尚未部署）" : ""
              }。</p>`
        }
        ${
          h.note
            ? `<p class="muted small" style="margin-top:12px">${esc(h.note)}</p>`
            : ""
        }`;
    }

    function apply() {
      syncSwUi();
      const rows = filtered();
      const scopeNote = selectedSw
        ? ` · ${swShort(swMap[selectedSw])}`
        : "";
      fCount.textContent = `显示 ${rows.length} / ${hosts.length} 台${scopeNote}`;
      if (selectedId && !rows.find((h) => h.id === selectedId)) {
        selectedId = rows[0]?.id || "";
      }
      hostList.innerHTML = rows.length
        ? rows
            .map((h) => {
              const ph = probeHealth(h);
              const active = h.id === selectedId ? " active" : "";
              return `<tr class="it-fleet-row${active}" data-host="${esc(h.id)}" tabindex="0">
                <td>
                  <strong>${esc(h.host)}</strong>
                  <div class="muted small">${esc(h.ip)}</div>
                </td>
                <td><span class="pill ${hostStatusClass(h.status)}">${esc(
                  h.status
                )}</span></td>
                <td><span class="pill ${ph.cls}">${esc(ph.text)}</span>
                  <div class="muted small">${esc(
                    probeNames(h).join(" · ") || "—"
                  )}</div>
                </td>
                <td class="small">${esc(h.lastSeen || "—")}</td>
                <td class="small">${esc(swShort(swMap[h.switchId]))}</td>
              </tr>`;
            })
            .join("")
        : `<tr><td colspan="5" class="muted">没有符合条件的机器。</td></tr>`;

      renderDetail(rows.find((h) => h.id === selectedId) || rows[0]);
    }

    envSwList.onclick = (e) => {
      const btn = e.target.closest("[data-sw]");
      if (!btn) return;
      const id = btn.getAttribute("data-sw");
      selectedSw = selectedSw === id ? "" : id;
      syncUrl();
      apply();
    };

    hostList.onclick = (e) => {
      const row = e.target.closest("[data-host]");
      if (!row) return;
      selectedId = row.getAttribute("data-host");
      syncUrl();
      apply();
    };

    fStatus.onchange = apply;
    fProbe.onchange = apply;
    fQ.oninput = apply;
    apply();
  }

  async function paintStorage() {
    document.title = "存储与码头 · 系统管理";
    const s = await getItStorage();
    root.innerHTML = `
      ${headHtml(
        "it-storage",
        "存储与码头",
        "按用途看分层健康与容量。外挂盘用于模型进料或数据导出。"
      )}
      <div class="it-metrics">
        ${s.layers
          .map((l) => {
            const pct = Math.round((l.usedTb / l.totalTb) * 100);
            return `<div class="it-metric" style="cursor:default">
              <div class="dash-k">${esc(l.name)}</div>
              <div class="it-metric-v">${l.usedTb} / ${l.totalTb} TB</div>
              <div class="it-bar" style="margin-top:8px"><i style="width:${pct}%"></i></div>
              <p class="muted small" style="margin:6px 0 0">
                <span class="pill ${l.health === "正常" ? "ok" : "warn"}">${esc(
                  l.health
                )}</span>
                ${esc(l.note)}
              </p>
            </div>`;
          })
          .join("")}
      </div>
      <h2 class="it-sec-title">外挂码头</h2>
      <div class="card">
        <strong>${esc(s.dock.label)}</strong>
        · ${s.dock.mounted ? '<span class="pill ok">已挂载</span>' : '<span class="pill">未挂载</span>'}
        <p class="muted small" style="margin:8px 0 0">${esc(s.dock.note)}</p>
      </div>`;
  }
}
