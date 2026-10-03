import { getComplianceWorkspace } from "../api-mock.js?v=nav63";
import { confirmDialog } from "../confirm.js?v=nav63";
import { esc } from "../esc.js?v=nav63";
import { iconForNavKey, pageTitleHtml } from "../icons.js?v=nav63";

export const roles = ["compliance"];
export const title = "审计";

const PACK_KEY = "fos-comp-packs";

function headHtml(navKey, title, sub) {
  const ico = iconForNavKey(navKey);
  return `<div class="page-head">
    <h1>${pageTitleHtml(ico, esc(title))}</h1>
    <p>${esc(sub)}</p>
  </div>`;
}

function resolveView(url) {
  return url.searchParams.get("view") || "search";
}

export function activeKey(url) {
  const view = resolveView(url);
  if (view === "policy") return "comp-policy";
  if (view === "evidence") return "comp-evidence";
  return "comp-search";
}

function trackPill(track) {
  if (track === "external") return "warn";
  if (track === "internal") return "";
  return "ok";
}

function corrLabel(st) {
  if (st === "matched") return "已关联";
  if (st === "unmatched") return "未匹配";
  return "—";
}

function corrPill(st) {
  if (st === "matched") return "ok";
  if (st === "unmatched") return "danger";
  return "warn";
}

function timeShort(v) {
  return String(v || "").replace(/^\d{4}-\d{2}-\d{2}\s*/, "") || "—";
}

function extraPacks() {
  try {
    return JSON.parse(sessionStorage.getItem(PACK_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveExtraPack(pack) {
  const list = extraPacks();
  list.unshift(pack);
  sessionStorage.setItem(PACK_KEY, JSON.stringify(list.slice(0, 8)));
}

export async function activate({ url, root }) {
  const pack = await getComplianceWorkspace();
  const events = pack.events || [];
  const incidents = pack.incidents || [];
  const policies = pack.policies || [];
  const people = pack.people || [];
  const view = resolveView(url);

  async function go(nextView, extra = {}) {
    const { softNavigate } = await import("../soft-nav.js?v=nav63");
    const u = new URL("./compliance.html", location.href);
    u.searchParams.set("view", nextView);
    Object.entries(extra).forEach(([k, v]) => {
      if (v) u.searchParams.set(k, v);
      else u.searchParams.delete(k);
    });
    await softNavigate(u, { push: true });
  }

  const eventById = Object.fromEntries(events.map((e) => [e.id, e]));
  const policyById = Object.fromEntries(policies.map((p) => [p.id, p]));

  if (view === "policy") return paintPolicy();
  if (view === "evidence") return paintEvidence();
  return paintSearch();

  function paintSearch() {
    document.title = "审计检索 · 审计";
    const q0 = url.searchParams.get("q") || "";
    const track0 = url.searchParams.get("track") || "all";
    const who0 = url.searchParams.get("who") || "all";
    const range0 = url.searchParams.get("range") || "today";
    const eventId = url.searchParams.get("event") || "";
    const inc0 = url.searchParams.get("inc") || "";
    const reveal = url.searchParams.get("reveal") === "1";
    const chain = url.searchParams.get("chain") === "1";

    function matchRange(ev) {
      if (range0 === "all") return true;
      const day = String(ev.at || "").slice(0, 10);
      if (range0 === "today") return day === "2026-10-02";
      return true;
    }

    const filtered = events.filter((ev) => {
      if (!matchRange(ev)) return false;
      if (track0 !== "all" && ev.track !== track0) return false;
      if (who0 !== "all" && ev.personId !== who0 && ev.dept !== who0) return false;
      if (q0) {
        const blob = `${ev.summary} ${ev.person} ${ev.dept} ${ev.requestId} ${ev.fingerprint} ${ev.theme}`.toLowerCase();
        if (!blob.includes(q0.toLowerCase())) return false;
      }
      if (inc0) {
        const inc = incidents.find((x) => x.id === inc0);
        if (inc?.eventIds?.length && !inc.eventIds.includes(ev.id)) return false;
      }
      return true;
    });

    const selected = eventById[eventId] || null;

    const whoOpts = [
      `<option value="all">全部</option>`,
      ...people.map(
        (p) =>
          `<option value="${esc(p.id)}" ${who0 === p.id ? "selected" : ""}>${esc(
            p.name
          )} · ${esc(p.dept)}</option>`
      ),
    ].join("");

    const incidentHtml = incidents
      .map((inc) => {
        return `<button type="button" class="aud-inc" data-inc="${esc(inc.id)}">
          <span class="pill ${inc.severity === "warn" ? "warn" : "danger"}">⚠</span>
          ${esc(inc.title)}
        </button>`;
      })
      .join("");

    const rows = filtered
      .map((ev) => {
        const active = ev.id === eventId ? " active" : "";
        const hit =
          ev.policyHits?.length
            ? `<span class="pill warn">策略 ${ev.policyHits.length}</span>`
            : "";
        return `<button type="button" class="aud-row${active}" data-event="${esc(
          ev.id
        )}">
          <div class="aud-row-main">
            <div class="aud-row-title">
              <strong>${esc(ev.summary)}</strong>
              ${hit}
            </div>
            <div class="muted small">
              ${esc(timeShort(ev.at))}
              · ${esc(ev.person)} · ${esc(ev.dept)}
              · ${esc(ev.requestId)}
            </div>
          </div>
          <div class="aud-row-tags">
            <span class="pill ${trackPill(ev.track)}">${esc(ev.trackZh)}</span>
            <span class="pill ${corrPill(ev.correlation)}">${esc(
              corrLabel(ev.correlation)
            )}</span>
          </div>
        </button>`;
      })
      .join("");

    let detail = `<p class="muted small aud-detail-empty">点选一条事件查看元数据与指纹。正文默认不展开。</p>`;
    if (selected) {
      const hits = (selected.policyHits || [])
        .map((id) => policyById[id])
        .filter(Boolean);
      const related = selected.theme
        ? events.filter((e) => e.theme === selected.theme && e.id !== selected.id)
        : [];
      const bodyBlock =
        reveal && selected.canReveal && selected.body
          ? `<pre class="aud-body">${esc(selected.body)}</pre>`
          : `<div class="aud-body-locked muted small">
              正文未展开 · 默认只提供摘要与指纹。
              ${
                selected.canReveal
                  ? `<button type="button" class="btn" id="reveal-body">展开正文</button>`
                  : `<span>当前权限不允许查看原文。</span>`
              }
            </div>`;
      const chainBlock = chain
        ? `<div class="aud-chain">
            <div class="dash-k">证据链 · ${esc(selected.theme || "无主题")}</div>
            ${
              related.length
                ? related
                    .map(
                      (e) =>
                        `<button type="button" class="aud-chain-item" data-event="${esc(
                          e.id
                        )}">${esc(timeShort(e.at))} · ${esc(e.summary)}</button>`
                    )
                    .join("")
                : `<p class="muted small">同主题暂无其它事件。</p>`
            }
          </div>`
        : "";
      detail = `
        <div class="aud-detail">
          <div class="aud-detail-head">
            <strong>${esc(selected.summary)}</strong>
            <span class="pill ${corrPill(selected.correlation)}">${esc(
              corrLabel(selected.correlation)
            )}</span>
          </div>
          <dl class="aud-meta">
            <div><dt>时间</dt><dd>${esc(selected.at)}</dd></div>
            <div><dt>人 / 部门</dt><dd>${esc(selected.person)} · ${esc(
              selected.dept
            )}</dd></div>
            <div><dt>审计轨</dt><dd>${esc(selected.trackZh)}</dd></div>
            <div><dt>request_id</dt><dd>${esc(selected.requestId)}</dd></div>
            <div><dt>指纹</dt><dd>${esc(selected.fingerprint)}</dd></div>
            <div><dt>主题</dt><dd>${esc(selected.theme || "—")}</dd></div>
          </dl>
          ${bodyBlock}
          ${
            hits.length
              ? `<div class="muted small" style="margin-top:10px">策略命中：${hits
                  .map(
                    (p) =>
                      `<a href="./compliance.html?view=policy&amp;id=${esc(
                        p.id
                      )}">${esc(p.name)}</a>`
                  )
                  .join(" · ")}</div>`
              : ""
          }
          <div class="aud-actions">
            ${
              selected.theme
                ? `<button type="button" class="btn" id="open-chain">打开证据链</button>`
                : ""
            }
            <a class="btn" href="./compliance.html?view=evidence&amp;from=${esc(
              selected.id
            )}">加入取证</a>
          </div>
          ${chainBlock}
        </div>`;
    }

    root.innerHTML = `
      ${headHtml("comp-search", "审计", `检索与事态 · 截至 ${pack.asOf || ""}`)}
      <form class="aud-search" id="aud-search">
        <label>时间
          <select name="range">
            <option value="today" ${range0 === "today" ? "selected" : ""}>今日</option>
            <option value="all" ${range0 === "all" ? "selected" : ""}>全部</option>
          </select>
        </label>
        <label>人 / 部门
          <select name="who">${whoOpts}</select>
        </label>
        <label>审计轨
          <select name="track">
            <option value="all" ${track0 === "all" ? "selected" : ""}>全部</option>
            <option value="local" ${track0 === "local" ? "selected" : ""}>本地推理</option>
            <option value="external" ${track0 === "external" ? "selected" : ""}>外发 LLM</option>
            <option value="internal" ${track0 === "internal" ? "selected" : ""}>内部系统</option>
          </select>
        </label>
        <label class="aud-search-q">关键词
          <input name="q" value="${esc(q0)}" placeholder="摘要 / 人 / request_id" />
        </label>
        <button type="submit" class="btn btn-primary">搜索</button>
      </form>

      <section class="aud-sec" aria-label="今日事态">
        <div class="it-env-label">今日事态</div>
        <div class="aud-incs">${incidentHtml || `<span class="muted small">无事态</span>`}</div>
      </section>

      <section class="aud-layout" aria-label="最近审计事件">
        <div>
          <div class="it-env-label">最近审计事件</div>
          <div class="aud-list">${rows || `<p class="muted small">无命中</p>`}</div>
        </div>
        <aside class="aud-aside">${detail}</aside>
      </section>`;

    root.querySelector("#aud-search").onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      go("search", {
        q: fd.get("q"),
        track: fd.get("track"),
        who: fd.get("who"),
        range: fd.get("range"),
      });
    };

    root.querySelectorAll("[data-event]").forEach((el) => {
      el.onclick = () =>
        go("search", {
          q: q0,
          track: track0,
          who: who0,
          range: range0,
          event: el.getAttribute("data-event"),
        });
    });

    root.querySelectorAll("[data-inc]").forEach((el) => {
      el.onclick = () => {
        const inc = incidents.find((x) => x.id === el.getAttribute("data-inc"));
        const first = inc?.eventIds?.[0];
        go("search", { range: "today", inc: inc.id, event: first || "" });
      };
    });

    const revealBtn = root.querySelector("#reveal-body");
    if (revealBtn) {
      revealBtn.onclick = () =>
        go("search", {
          q: q0,
          track: track0,
          who: who0,
          range: range0,
          event: selected.id,
          reveal: "1",
        });
    }
    const chainBtn = root.querySelector("#open-chain");
    if (chainBtn) {
      chainBtn.onclick = () =>
        go("search", {
          q: q0,
          track: track0,
          who: who0,
          range: range0,
          event: selected.id,
          chain: "1",
          reveal: reveal ? "1" : "",
        });
    }
  }

  function paintPolicy() {
    document.title = "策略 · 审计";
    const id = url.searchParams.get("id") || policies[0]?.id || "";
    const p = policyById[id] || policies[0];
    const hitEvents = events.filter((e) => (e.policyHits || []).includes(p?.id));

    root.innerHTML = `
      ${headHtml("comp-policy", "策略", "只读 · 状态 / 命中 / 规则")}
      <div class="aud-layout">
        <div>
          <div class="it-env-label">规则</div>
          <div class="aud-list">
            ${policies
              .map(
                (x) => `<button type="button" class="aud-row${
                  x.id === p?.id ? " active" : ""
                }" data-policy="${esc(x.id)}">
                  <div class="aud-row-main">
                    <div class="aud-row-title"><strong>${esc(x.name)}</strong></div>
                    <div class="muted small">${esc(x.scope)} · 今日命中 ${x.hitsToday}</div>
                  </div>
                  <span class="pill ${x.status === "Enforced" ? "ok" : ""}">${esc(
                    x.status
                  )}</span>
                </button>`
              )
              .join("")}
          </div>
        </div>
        <aside class="aud-aside">
          ${
            p
              ? `<div class="aud-detail">
                  <div class="aud-detail-head">
                    <strong>${esc(p.name)}</strong>
                    <span class="pill ${p.status === "Enforced" ? "ok" : ""}">${esc(
                      p.status
                    )}</span>
                  </div>
                  <p class="muted small">${esc(p.scope)}</p>
                  <div class="dash-k" style="margin:12px 0 6px">规则</div>
                  <p>${esc(p.rule)}</p>
                  <div class="dash-k" style="margin:12px 0 6px">今日命中</div>
                  ${
                    hitEvents.length
                      ? hitEvents
                          .map(
                            (e) =>
                              `<a class="aud-chain-item" href="./compliance.html?view=search&amp;event=${esc(
                                e.id
                              )}">${esc(timeShort(e.at))} · ${esc(e.summary)}</a>`
                          )
                          .join("")
                      : `<p class="muted small">无命中</p>`
                  }
                </div>`
              : `<p class="muted small">无策略</p>`
          }
        </aside>
      </div>`;

    root.querySelectorAll("[data-policy]").forEach((el) => {
      el.onclick = () => go("policy", { id: el.getAttribute("data-policy") });
    });
  }

  function paintEvidence() {
    document.title = "取证 · 审计";
    const from = url.searchParams.get("from") || "";
    const packId = url.searchParams.get("pack") || "";
    const packs = [...extraPacks(), ...(pack.packs || [])];
    const current = packs.find((x) => x.id === packId) || packs[0];
    const previewIds = current?.eventIds || (from ? [from] : []);
    const previewEvents = previewIds.map((id) => eventById[id]).filter(Boolean);

    root.innerHTML = `
      ${headHtml("comp-evidence", "取证", "导出包 · 谱系摘要 + 指纹清单")}
      <div class="aud-layout">
        <div>
          <div class="it-env-label">取证包</div>
          <div class="aud-list">
            ${packs
              .map(
                (x) => `<button type="button" class="aud-row${
                  x.id === current?.id ? " active" : ""
                }" data-pack="${esc(x.id)}">
                  <div class="aud-row-main">
                    <div class="aud-row-title"><strong>${esc(x.title)}</strong></div>
                    <div class="muted small">${esc(x.window || "")} · ${esc(
                      x.theme || ""
                    )}</div>
                  </div>
                  <span class="pill ${x.status === "就绪" ? "ok" : "warn"}">${esc(
                    x.status
                  )}</span>
                </button>`
              )
              .join("")}
          </div>
          <p class="muted small" style="margin-top:10px">从检索把事件加入后，确认导出。Demo 不做司法级出证后台。</p>
        </div>
        <aside class="aud-aside">
          ${
            current
              ? `<div class="aud-detail">
                  <div class="aud-detail-head">
                    <strong>${esc(current.title)}</strong>
                    <span class="pill ${current.status === "就绪" ? "ok" : "warn"}">${esc(
                      current.status
                    )}</span>
                  </div>
                  <dl class="aud-meta">
                    <div><dt>时间窗</dt><dd>${esc(current.window || "—")}</dd></div>
                    <div><dt>主题</dt><dd>${esc(current.theme || "—")}</dd></div>
                    <div><dt>指纹</dt><dd>${esc(
                      String(current.fingerprints ?? previewEvents.length)
                    )}</dd></div>
                  </dl>
                  <div class="dash-k" style="margin:12px 0 6px">关联事件</div>
                  ${previewEvents
                    .map(
                      (e) =>
                        `<div class="muted small" style="margin:4px 0">${esc(
                          e.at
                        )} · ${esc(e.summary)} · ${esc(e.fingerprint)}</div>`
                    )
                    .join("") || `<p class="muted small">无事件</p>`}
                  <div class="aud-actions">
                    <button type="button" class="btn btn-primary" id="export-pack">确认导出</button>
                  </div>
                </div>`
              : `<p class="muted small">尚无取证包</p>`
          }
        </aside>
      </div>`;

    root.querySelectorAll("[data-pack]").forEach((el) => {
      el.onclick = () => go("evidence", { pack: el.getAttribute("data-pack") });
    });
    const exp = root.querySelector("#export-pack");
    if (exp && current) {
      exp.onclick = async () => {
        const ok = await confirmDialog({
          title: "导出取证包",
          body: `将导出「${current.title}」的谱系摘要、关联事件与材料指纹。此动作会记入审计。`,
          confirmText: "导出",
        });
        if (!ok) return;
        if (from && !current.eventIds?.includes(from) && eventById[from]) {
          saveExtraPack({
            id: `pack-local-${Date.now()}`,
            title: `导出 · ${eventById[from].summary}`,
            status: "就绪",
            window: eventById[from].at,
            theme: eventById[from].theme,
            eventIds: [from],
            fingerprints: 1,
            createdAt: pack.asOf,
          });
        }
        await go("evidence", { pack: current.id });
      };
    }
  }
}
