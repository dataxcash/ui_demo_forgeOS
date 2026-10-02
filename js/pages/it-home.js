import {
  getItDashboard,
  getItServices,
  getItCompute,
  getItAispaceCap,
  getItRemote,
  getItStorage,
  restartItService,
} from "../api-mock.js?v=nav51";
import { confirmDialog } from "../confirm.js?v=nav51";
import { esc } from "../esc.js?v=nav51";
import { iconForNavKey, pageTitleHtml } from "../icons.js?v=nav51";

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
    const { softNavigate } = await import("../soft-nav.js?v=nav51");
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
          `${c.note || ""} 截至 ${c.asOf || ""}。`
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

        <div class="grid-2" style="margin-top:14px">
          <div class="card">
            <div class="dash-k">算力服务</div>
            <p style="margin:6px 0 0">
              <span class="pill ok">${esc(c.computeService.status)}</span>
              · 约 ${esc(String(c.computeService.qps))} 问/秒
              · 排队 ${esc(String(c.computeService.queue))}
              · REQ/S ${esc(String(c.computeService.reqPerSec ?? c.computeService.qps))}
            </p>
          </div>
          <div class="card">
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
        </div>

        <h2 class="it-sec-title">一、按模型</h2>
        <p class="muted small" style="margin:-4px 0 8px">点选模型查看部门拆分与波动。驻留 = 当前在显存里。</p>
        <div class="it-model-list" id="model-list"></div>

        <div id="model-detail"></div>

        <h2 class="it-sec-title">二、按部门（今日合计）</h2>
        <table class="table">
          <thead><tr><th>部门</th><th>今日 Token</th><th>占比</th><th></th></tr></thead>
          <tbody>
            ${(c.byDeptToday || [])
              .map((r) => {
                const share = Math.round((r.used / total) * 100);
                return `<tr>
                  <td>${esc(r.name)}</td>
                  <td>${fmtNum(r.used)}</td>
                  <td>${share}%</td>
                  <td style="min-width:120px"><div class="it-bar"><i style="width:${share}%"></i></div></td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>

        <h2 class="it-sec-title">GPU 运行</h2>
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
                · 均时 ${mod.avgLatencyMs} ms
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
                <p class="muted small" style="margin:4px 0 0">${esc(tr.text)}
                  · 14 日峰值 ${fmtNum(sp.max)} · 较昨日 ${esc(sp.deltaTxt)}</p>
              </div>
              <div class="it-spark-wrap">${sp.svg}</div>
            </div>
            <h3 class="it-sec-title" style="margin-top:12px">该模型 · 近 14 日</h3>
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
          const us = sparkline(g.utilHistory || [], "util", { w: 200, h: 40 });
          const ut = trendLabel(g.utilHistory || [], "util");
          return `<div class="card">
            <div class="it-svc-row">
              <div>
                <strong>${esc(g.name)}</strong>
                <div class="muted small" style="margin-top:4px">驻留：${esc(
                  (g.residentModels || []).join("、") || "—"
                )}</div>
                <p class="muted small" style="margin:4px 0 0">利用率波动：
                  <span class="it-trend ${ut.cls}">${esc(ut.text)}</span>
                  · 较昨日 ${esc(us.deltaTxt)}</p>
              </div>
              <div class="it-spark-wrap">${us.svg}</div>
            </div>
            <div class="it-gpu-grid">
              <div><span class="dash-k">利用率</span><div class="it-metric-v">${g.util}%</div></div>
              <div><span class="dash-k">显存</span><div class="it-metric-v">${g.vramUsedGb} / ${g.vramTotalGb} GB</div></div>
              <div><span class="dash-k">温度</span><div class="it-metric-v">${g.tempC}°C</div></div>
              <div><span class="dash-k">功耗</span><div class="it-metric-v">${g.powerW} W</div></div>
            </div>
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
    const usedPct = Math.round(
      (a.capacity.objectsTb / a.capacity.objectsLimitTb) * 100
    );
    root.innerHTML = `
      ${headHtml("it-aispace", title, a.pageSub || a.capacity.note || "")}
      <h2 class="it-sec-title">${esc(a.servicesTitle || "后端组件")}</h2>
      <div class="grid-2">
        ${a.services
          .map(
            (s) => `<div class="card">
            <div class="deal-title"><code>${esc(s.name || s.id)}</code>
              ${s.kind ? `<span class="pill" style="margin-left:6px">${esc(s.kind)}</span>` : ""}
            </div>
            <div class="deal-meta" style="margin-top:6px">
              <span class="pill ${s.status === "正常" ? "ok" : "warn"}">${esc(
                s.status
              )}</span>
              <span class="muted">${esc(s.role || "")}</span>
            </div>
            ${
              s.detail
                ? `<p class="muted small" style="margin:8px 0 0">${esc(
                    s.detail
                  )}</p>`
                : ""
            }
          </div>`
          )
          .join("")}
      </div>
      <h2 class="it-sec-title">${esc(a.capacity.title || "对象库用量")}</h2>
      <div class="card">
        <div class="stat">${a.capacity.objectsTb} TB
          <span class="stat-label">/ ${a.capacity.objectsLimitTb} TB</span></div>
        <div class="it-bar"><i style="width:${usedPct}%"></i></div>
        <p class="muted small" style="margin:6px 0 0">已用约 ${usedPct}% · ${esc(
          a.capacity.note || ""
        )}</p>
      </div>
      <h2 class="it-sec-title">水位</h2>
      <div class="it-metrics">
        ${a.watermarks
          .map(
            (w) => `<div class="it-metric" style="cursor:default">
            <div class="dash-k">${esc(w.name)}</div>
            <div class="it-metric-v">${esc(w.value)}</div>
          </div>`
          )
          .join("")}
      </div>`;
  }

  async function paintRemote(initialQ) {
    document.title = "远程机器 · 系统管理";
    const pack = await getItRemote();
    const switches = pack.switches || [];
    const hosts = pack.hosts || [];
    const swMap = Object.fromEntries(switches.map((s) => [s.id, s]));

    function switchPath(swId) {
      const parts = [];
      let cur = swMap[swId];
      let guard = 0;
      while (cur && guard++ < 8) {
        parts.unshift(cur.name.replace(/ · .*$/, "").replace(/交换机 · /, ""));
        cur = cur.parentId ? swMap[cur.parentId] : null;
      }
      return parts.join(" → ");
    }

    function hostProbeNames(h) {
      return [
        ...(h.probes || []).map((p) => p.name),
        ...(h.services || []).map((s) => s.name),
      ];
    }

    const osFamilies = [
      ...new Set(hosts.map((h) => h.osFamily).filter(Boolean)),
    ];
    const probeKinds = [
      ...new Set(
        hosts.flatMap((h) =>
          [...(h.probes || []), ...(h.services || [])].map((p) => p.name)
        )
      ),
    ].sort();

    let selectedId =
      new URL(location.href).searchParams.get("host") ||
      hosts.find((h) => h.status !== "在线")?.id ||
      hosts[0]?.id ||
      "";

    root.innerHTML = `
      ${headHtml(
        "it-remote",
        "远程机器",
        `${pack.note || ""} 截至 ${pack.asOf || ""}。`
      )}

      <h2 class="it-sec-title">交换机层级（envPD 探测）</h2>
      <div class="it-sw-tree" id="sw-tree"></div>

      <div class="it-filter card">
        <div class="it-filter-row">
          <label>主机状态
            <select id="f-status">
              <option value="all">全部</option>
              <option value="在线">在线</option>
              <option value="延迟">延迟</option>
              <option value="掉线">掉线</option>
              <option value="未部署">未部署</option>
            </select>
          </label>
          <label>操作系统
            <select id="f-os">
              <option value="all">全部</option>
              ${osFamilies
                .map((o) => `<option value="${esc(o)}">${esc(o)}</option>`)
                .join("")}
            </select>
          </label>
          <label>所属交换机
            <select id="f-sw">
              <option value="all">全部</option>
              ${switches
                .map(
                  (s) =>
                    `<option value="${esc(s.id)}">${esc(s.name)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label>探针/服务
            <select id="f-probe">
              <option value="all">全部</option>
              ${probeKinds
                .map((p) => `<option value="${esc(p)}">${esc(p)}</option>`)
                .join("")}
            </select>
          </label>
          <label class="it-filter-q">关键字
            <input id="f-q" type="search" placeholder="主机 / IP / 负责人 / 部门 / OS / 端口" value="${esc(
              initialQ
            )}" />
          </label>
        </div>
        <p class="muted small" id="f-count" style="margin:8px 0 0"></p>
      </div>

      <div class="it-remote-layout">
        <div class="it-remote-list" id="host-list"></div>
        <div class="it-remote-detail" id="host-detail"></div>
      </div>`;

    const swTree = root.querySelector("#sw-tree");
    const roots = switches.filter((s) => !s.parentId);

    function renderSwitchNode(sw, depth) {
      const kids = switches.filter((s) => s.parentId === sw.id);
      const under = hosts.filter((h) => h.switchId === sw.id);
      const bad = under.filter((h) => h.status !== "在线").length;
      return `<div class="it-sw-node" style="margin-left:${depth * 16}px">
        <button type="button" class="it-sw-card" data-sw="${esc(sw.id)}">
          <div class="it-svc-row">
            <div>
              <span class="pill ${sw.role === "核心" ? "ok" : ""}">${esc(
                sw.role
              )}</span>
              <strong style="margin-left:6px">${esc(sw.name)}</strong>
              <div class="muted small" style="margin-top:4px">
                ${esc(sw.mgmtIp)} · 端口 ${sw.portsUp}/${sw.portsTotal}
                · 下属主机 ${under.length}${bad ? ` · 异常 ${bad}` : ""}
                ${sw.note ? ` · ${esc(sw.note)}` : ""}
              </div>
            </div>
            <span class="pill ${
              sw.status === "正常" ? "ok" : "warn"
            }">${esc(sw.status)}</span>
          </div>
        </button>
        ${kids.map((k) => renderSwitchNode(k, depth + 1)).join("")}
      </div>`;
    }

    swTree.innerHTML = roots.map((r) => renderSwitchNode(r, 0)).join("");

    const fStatus = root.querySelector("#f-status");
    const fOs = root.querySelector("#f-os");
    const fSw = root.querySelector("#f-sw");
    const fProbe = root.querySelector("#f-probe");
    const fQ = root.querySelector("#f-q");
    const fCount = root.querySelector("#f-count");
    const hostList = root.querySelector("#host-list");
    const hostDetail = root.querySelector("#host-detail");

    swTree.onclick = (e) => {
      const btn = e.target.closest("[data-sw]");
      if (!btn) return;
      fSw.value = btn.getAttribute("data-sw");
      apply();
    };

    function filtered() {
      const st = fStatus.value;
      const os = fOs.value;
      const sw = fSw.value;
      const probe = fProbe.value;
      const q = (fQ.value || "").trim().toLowerCase();
      return hosts.filter((h) => {
        if (st !== "all" && h.status !== st) return false;
        if (os !== "all" && h.osFamily !== os) return false;
        if (sw !== "all" && h.switchId !== sw) return false;
        if (probe !== "all" && !hostProbeNames(h).includes(probe)) return false;
        if (q) {
          const swName = swMap[h.switchId]?.name || "";
          const blob = `${h.host} ${h.ip} ${h.mac || ""} ${h.owner} ${h.dept || ""} ${h.os} ${h.switchPort || ""} ${swName} ${h.note || ""} ${hostProbeNames(h).join(" ")}`.toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      });
    }

    function renderDetail(h) {
      if (!h) {
        hostDetail.innerHTML = `<div class="empty">选择左侧一台机器查看详情。</div>`;
        return;
      }
      const sw = swMap[h.switchId];
      const comps = [...(h.probes || []), ...(h.services || [])];
      hostDetail.innerHTML = `
        <div class="card">
          <div class="it-svc-row">
            <div>
              <strong style="font-size:16px">${esc(h.host)}</strong>
              <div class="muted small" style="margin-top:4px">${esc(h.ip)} · ${esc(
                h.mac || "—"
              )}</div>
            </div>
            <span class="pill ${statusPill(
              h.status === "在线"
                ? "运行中"
                : h.status === "掉线" || h.status === "未部署"
                  ? "失败"
                  : "排队"
            )}">${esc(h.status)}</span>
          </div>
          <div class="it-gpu-grid" style="margin-top:12px">
            <div><span class="dash-k">操作系统</span><div class="it-metric-v" style="font-size:14px">${esc(
              h.os
            )}</div><div class="muted small">${esc(h.osFamily)} · ${esc(
              h.arch || "—"
            )}</div></div>
            <div><span class="dash-k">负责人</span><div class="it-metric-v" style="font-size:14px">${esc(
              h.owner
            )}</div><div class="muted small">${esc(h.dept || "—")}</div></div>
            <div><span class="dash-k">最近见到</span><div class="it-metric-v" style="font-size:14px">${esc(
              h.lastSeen
            )}</div></div>
            <div><span class="dash-k">备注</span><div class="muted small" style="margin-top:4px">${esc(
              h.note || "—"
            )}</div></div>
          </div>
          <h3 class="it-sec-title">隶属交换机</h3>
          <p style="margin:0">
            <strong>${esc(sw?.name || h.switchId)}</strong>
            <span class="muted small"> · 端口 ${esc(h.switchPort || "—")}</span>
          </p>
          <p class="muted small" style="margin:4px 0 0">层级：${esc(
            switchPath(h.switchId) || "—"
          )}</p>
          <h3 class="it-sec-title">探针（可多枚）</h3>
          ${
            (h.probes || []).length
              ? `<table class="table"><thead><tr><th>名称</th><th>类型</th><th>版本</th><th>状态</th></tr></thead><tbody>
              ${h.probes
                .map(
                  (p) => `<tr>
                  <td>${esc(p.name)}</td>
                  <td>${esc(p.kind || "—")}</td>
                  <td>${esc(p.version)}</td>
                  <td><span class="pill ${statusPill(
                    p.status === "在线"
                      ? "运行中"
                      : p.status === "掉线"
                        ? "失败"
                        : "排队"
                  )}">${esc(p.status)}</span></td>
                </tr>`
                )
                .join("")}
            </tbody></table>`
              : `<p class="muted small">本机暂无探针（可能仅跑服务，或尚未部署）。</p>`
          }
          <h3 class="it-sec-title">其它服务</h3>
          ${
            (h.services || []).length
              ? `<table class="table"><thead><tr><th>名称</th><th>类型</th><th>版本</th><th>状态</th></tr></thead><tbody>
              ${h.services
                .map(
                  (p) => `<tr>
                  <td>${esc(p.name)}</td>
                  <td>${esc(p.kind || "—")}</td>
                  <td>${esc(p.version)}</td>
                  <td><span class="pill ${statusPill(
                    p.status === "在线"
                      ? "运行中"
                      : p.status === "掉线"
                        ? "失败"
                        : "排队"
                  )}">${esc(p.status)}</span></td>
                </tr>`
                )
                .join("")}
            </tbody></table>`
              : `<p class="muted small">无额外服务登记。</p>`
          }
          <p class="muted small" style="margin-top:10px">组件合计 ${comps.length} 项。</p>
        </div>`;
    }

    function apply() {
      const rows = filtered();
      fCount.textContent = `共 ${rows.length} 台主机（全部 ${hosts.length}）· 交换机 ${switches.length} 台`;
      if (selectedId && !rows.find((h) => h.id === selectedId)) {
        selectedId = rows[0]?.id || "";
      }
      hostList.innerHTML = rows.length
        ? rows
            .map((h) => {
              const probes = h.probes || [];
              const active = h.id === selectedId ? " active" : "";
              return `<button type="button" class="it-host-row${active}" data-host="${esc(
                h.id
              )}">
                <div class="it-host-top">
                  <strong>${esc(h.host)}</strong>
                  <span class="pill ${statusPill(
                    h.status === "在线"
                      ? "运行中"
                      : h.status === "掉线" || h.status === "未部署"
                        ? "失败"
                        : "排队"
                  )}">${esc(h.status)}</span>
                </div>
                <div class="muted small">${esc(h.os)} · ${esc(h.ip)} · ${esc(
                  h.owner
                )}</div>
                <div class="muted small">交换机：${esc(
                  switchPath(h.switchId) || "—"
                )} · ${esc(h.switchPort || "—")}</div>
                <div class="it-probe-pills">
                  ${
                    probes.length
                      ? probes
                          .map(
                            (p) =>
                              `<span class="pill ${
                                p.status === "在线"
                                  ? "ok"
                                  : p.status === "掉线"
                                    ? "danger"
                                    : "warn"
                              }">${esc(p.name)}</span>`
                          )
                          .join("")
                      : `<span class="muted small">无探针</span>`
                  }
                  ${(h.services || [])
                    .slice(0, 3)
                    .map(
                      (s) =>
                        `<span class="pill">${esc(s.name)}</span>`
                    )
                    .join("")}
                </div>
              </button>`;
            })
            .join("")
        : `<div class="empty">没有符合条件的机器。</div>`;

      renderDetail(rows.find((h) => h.id === selectedId) || rows[0]);
    }

    hostList.onclick = (e) => {
      const btn = e.target.closest("[data-host]");
      if (!btn) return;
      selectedId = btn.getAttribute("data-host");
      const u = new URL(location.href);
      u.searchParams.set("view", "remote");
      u.searchParams.set("host", selectedId);
      history.replaceState({}, "", u);
      apply();
    };

    fStatus.onchange = apply;
    fOs.onchange = apply;
    fSw.onchange = apply;
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
