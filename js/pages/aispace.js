import { getMyDeals, getDeal, askDeal } from "../api-mock.js?v=nav55";
import { esc } from "../esc.js?v=nav55";

export const roles = ["employee", "manager", "boss"];
export const title = "aiSpace";

export function activeKey(url) {
  const view = url.searchParams.get("view") || "mine";
  return view === "team" ? "team-deals" : "my-deals";
}

let mineAll = null;
let teamAll = null;
let viewRoot = null;

export async function activate({ account, url, root }) {
  root.innerHTML = `<div id="view"></div>`;
  viewRoot = root.querySelector("#view");

  const params = url.searchParams;
  let view = params.get("view") || "mine";
  let dealId = params.get("id") || "";
  let filter = params.get("f") || "all";
  let person = params.get("p") || "all";
  let bucket = params.has("b") ? params.get("b") : "须尽快";
  let returnView = params.get("from") || "mine";

  if (view === "team" && account.role !== "manager") view = "mine";
  if (view === "deal" && !dealId) view = "mine";
  const isHr = false;

function tipUrl() {
  const url = new URL("./aispace.html", location.href);
  url.searchParams.set("view", view);
  if (view === "mine" && filter !== "all") url.searchParams.set("f", filter);
  if (view === "team") {
    if (person !== "all") url.searchParams.set("p", person);
    url.searchParams.set("b", bucket);
  }
  if (view === "deal") {
    url.searchParams.set("id", dealId);
    if (returnView && returnView !== "mine")
      url.searchParams.set("from", returnView);
  }
  return url;
}

function levelClass(b) {
  if (b === "须尽快") return "danger";
  if (b === "这周要动") return "warn";
  return "ok";
}
function mark(on, text) {
  return on ? `<span class="hl">${text}</span>` : text;
}

async function switchView(next, push, extra = {}) {
  if (next === "team" && account.role !== "manager") next = "mine";
  view = next;
  if (extra.id) dealId = extra.id;
  if (extra.from) returnView = extra.from;
  if (extra.f) filter = extra.f;
  const { softNavigate } = await import(`../soft-nav.js?v=nav55`);
  await softNavigate(tipUrl(), { push });
}

/* —— 我的单 —— */
async function paintMine() {
  document.title = "我的单 · aiSpace";
  if (!mineAll) {
    mineAll = await getMyDeals(account, { scope: "mine", openOnly: true });
  }
  const all = mineAll;
  const BUCKET_OF = {
    urgent: "须尽快",
    week: "这周要动",
    watch: "跟进中",
  };
  if (!BUCKET_OF[filter] && filter !== "all") filter = "all";
  const nUrgent = all.filter((d) => d.bucket === "须尽快").length;
  const nWeek = all.filter((d) => d.bucket === "这周要动").length;
  const nWatch = all.filter((d) => d.bucket === "跟进中").length;

  viewRoot.innerHTML = `
    <div class="page-head">
      <h1>我的单</h1>
      <p>${
        isHr
          ? "人事这边跟进的事，比如找材料给法务。花名册对比出来的入职离职，在左边「待办事项」；谁离职还没交清，点开那条离职就能看。"
          : "只看待办。选中筛选项只高亮对应数字。"
      }</p>
    </div>
    <div class="toolbar">
      <div class="seg" id="filter">
        <button type="button" data-f="all">全部</button>
        <button type="button" data-f="urgent">须尽快</button>
        <button type="button" data-f="week">这周要动</button>
        <button type="button" data-f="watch">跟进中</button>
      </div>
      <span class="count-line" id="count"></span>
      <span style="flex:1"></span>
      ${
        isHr
          ? `<a class="btn" href="./hr-org.html?view=tasks">待办事项</a>`
          : `<button type="button" class="btn" id="btn-done">已完成（另册）</button>`
      }
    </div>
    <div id="board" class="deal-board"></div>`;

  document.querySelectorAll("#filter button").forEach((b) =>
    b.classList.toggle("active", b.dataset.f === filter)
  );
  let list = all;
  if (filter !== "all") list = all.filter((d) => d.bucket === BUCKET_OF[filter]);
  document.getElementById("count").innerHTML =
    `${mark(filter === "all", `未完成 ${all.length} 单`)}（` +
    `${mark(filter === "urgent", `须尽快 ${nUrgent}`)} · ` +
    `${mark(filter === "week", `这周要动 ${nWeek}`)} · ` +
    `${mark(filter === "watch", `跟进中 ${nWatch}`)}）`;

  const board = document.getElementById("board");
  board.innerHTML = list.length
    ? list
        .map(
          (d) => `<button type="button" class="deal-row" data-id="${esc(d.id)}">
          <div class="deal-main">
            <div class="deal-title">${esc(d.name)}</div>
            <div class="deal-meta">
              <span class="pill">${esc(d.type)}</span>
              <span class="pill ${levelClass(d.bucket)}">${esc(d.status)}</span>
              <span class="muted">${esc(d.owner)}</span>
            </div>
            <div class="deal-why">${esc(d.why)}</div>
          </div>
          <div class="deal-side">
            <span class="pill ${levelClass(d.bucket)}">${esc(d.bucket)}</span>
          </div>
        </button>`
        )
        .join("")
    : `<div class="empty">当前筛选下没有单。</div>`;

  document.getElementById("filter").onclick = (e) => {
    const btn = e.target.closest("button[data-f]");
    if (!btn) return;
    filter = btn.dataset.f;
    switchView("mine", false);
  };
  const btnDone = document.getElementById("btn-done");
  if (btnDone) btnDone.onclick = () => switchView("done", true);
  board.querySelectorAll("[data-id]").forEach((btn) => {
    btn.onclick = () =>
      switchView("deal", true, {
        id: btn.getAttribute("data-id"),
        from: "mine",
      });
  });
}

/* —— 组里的单 —— */
async function paintTeam() {
  document.title = "组里的单 · aiSpace";
  if (!teamAll) {
    teamAll = await getMyDeals(account, { scope: "team", openOnly: true });
  }
  const all = teamAll;
  const people = [...new Set(all.map((d) => d.owner))].sort();
  if (person !== "all" && !people.includes(person)) person = "all";
  if (!["all", "须尽快", "这周要动", "跟进中"].includes(bucket))
    bucket = "须尽快";

  viewRoot.innerHTML = `
    <div class="page-head">
      <h1>组里的单</h1>
      <p>默认看「须尽快」。可按人员、分桶筛选。</p>
    </div>
    <div class="toolbar">
      <span class="muted small">人员</span>
      <div class="seg" id="f-person"></div>
    </div>
    <div class="toolbar" style="margin-top:0">
      <span class="muted small">分桶</span>
      <div class="seg" id="f-bucket">
        <button type="button" data-b="all">全部</button>
        <button type="button" data-b="须尽快">须尽快</button>
        <button type="button" data-b="这周要动">这周要动</button>
        <button type="button" data-b="跟进中">跟进中</button>
      </div>
    </div>
    <p class="count-line" id="count" style="margin:0 0 10px"></p>
    <div id="board" class="deal-board"></div>`;

  document.getElementById("f-person").innerHTML =
    `<button type="button" data-p="all">全部</button>` +
    people
      .map((p) => `<button type="button" data-p="${esc(p)}">${esc(p)}</button>`)
      .join("");

  document.querySelectorAll("#f-person button").forEach((b) =>
    b.classList.toggle("active", b.dataset.p === person)
  );
  document.querySelectorAll("#f-bucket button").forEach((b) =>
    b.classList.toggle("active", b.dataset.b === bucket)
  );

  let list = all;
  if (person !== "all") list = list.filter((d) => d.owner === person);
  if (bucket !== "all") list = list.filter((d) => d.bucket === bucket);

  const forBuckets =
    person === "all" ? all : all.filter((d) => d.owner === person);
  const forPeople =
    bucket === "all" ? all : all.filter((d) => d.bucket === bucket);
  const nU = forBuckets.filter((d) => d.bucket === "须尽快").length;
  const nW = forBuckets.filter((d) => d.bucket === "这周要动").length;
  const nG = forBuckets.filter((d) => d.bucket === "跟进中").length;
  const personBits = people
    .map((p) =>
      mark(
        person === p,
        `${p} ${forPeople.filter((d) => d.owner === p).length}`
      )
    )
    .join(" · ");

  document.getElementById("count").innerHTML =
    `${mark(person === "all" && bucket === "all", `未完成 ${all.length} 单`)}` +
    `（${mark(bucket === "须尽快", `须尽快 ${nU}`)} · ${mark(
      bucket === "这周要动",
      `这周要动 ${nW}`
    )} · ${mark(bucket === "跟进中", `跟进中 ${nG}`)}）｜ ${personBits}`;

  const board = document.getElementById("board");
  board.innerHTML = list.length
    ? list
        .map(
          (d) => `<button type="button" class="deal-row" data-id="${esc(d.id)}">
          <div class="deal-main">
            <div class="deal-title">${esc(d.name)}</div>
            <div class="deal-meta">
              <span class="pill">${esc(d.type)}</span>
              <span class="pill ${levelClass(d.bucket)}">${esc(d.status)}</span>
              <span class="muted">${esc(d.owner)}</span>
            </div>
            <div class="deal-why">${esc(d.why)}</div>
          </div>
          <div class="deal-side">
            <span class="pill ${levelClass(d.bucket)}">${esc(d.bucket)}</span>
          </div>
        </button>`
        )
        .join("")
    : `<div class="empty">当前组合下没有单。</div>`;

  document.getElementById("f-person").onclick = (e) => {
    const btn = e.target.closest("button[data-p]");
    if (!btn) return;
    person = btn.dataset.p;
    switchView("team", false);
  };
  document.getElementById("f-bucket").onclick = (e) => {
    const btn = e.target.closest("button[data-b]");
    if (!btn) return;
    bucket = btn.dataset.b;
    switchView("team", false);
  };
  board.querySelectorAll("[data-id]").forEach((btn) => {
    btn.onclick = () =>
      switchView("deal", true, {
        id: btn.getAttribute("data-id"),
        from: "team",
      });
  });
}

/* —— 已完成 —— */
async function paintDone() {
  document.title = "已完成 · aiSpace";
  const list = await getMyDeals(account, { scope: "mine", openOnly: false });
  viewRoot.innerHTML = `
    <p class="muted small"><button type="button" class="btn btn-ghost" id="btn-back">← 我的单</button></p>
    <div class="page-head">
      <h1>已完成</h1>
      <p>与「我的单」分开：只作历史查阅，不参与紧急排序。</p>
    </div>
    <div id="board" class="deal-board"></div>`;
  document.getElementById("btn-back").onclick = () =>
    switchView("mine", true);
  const board = document.getElementById("board");
  board.innerHTML = list.length
    ? list
        .map(
          (d) => `<button type="button" class="deal-row" data-id="${esc(d.id)}">
          <div class="deal-main">
            <div class="deal-title">${esc(d.name)}</div>
            <div class="deal-meta">
              <span class="pill">${esc(d.type)}</span>
              <span class="pill ok">${esc(d.status)}</span>
            </div>
            <div class="deal-why">${esc(d.why)}</div>
          </div>
        </button>`
        )
        .join("")
    : `<div class="empty">暂无已完成记录。</div>`;
  board.querySelectorAll("[data-id]").forEach((btn) => {
    btn.onclick = () =>
      switchView("deal", true, {
        id: btn.getAttribute("data-id"),
        from: "done",
      });
  });
}

/* —— 某一单 —— */
async function paintDeal() {
  const pack = await getDeal(dealId);
  if (!pack) {
    viewRoot.innerHTML = `<div class="page-head"><h1>找不到这一单</h1></div>
      <button type="button" class="btn" id="btn-back">返回</button>`;
    document.getElementById("btn-back").onclick = () =>
      switchView(returnView === "team" ? "team" : "mine", true);
    return;
  }
  const { deal, timeline, evidence } = pack;
  document.title = `${deal.name} · aiSpace`;
  const backLabel =
    returnView === "team"
      ? "组里的单"
      : returnView === "done"
        ? "已完成"
        : "我的单";

  function materialHref(e) {
    return `./material.html?deal=${encodeURIComponent(dealId)}&file=${encodeURIComponent(
      e.file
    )}&seg=${encodeURIComponent(e.seg || "")}&summary=${encodeURIComponent(
      e.summary || ""
    )}&from=${encodeURIComponent(returnView || "mine")}`;
  }

  const matLinks = evidence.length
    ? `<div class="mat-inline"><span class="muted">相关材料：</span>${evidence
        .map(
          (e) =>
            `<a href="${materialHref(e)}">${esc(e.file)}</a><span class="muted">（${esc(
              e.seg
            )}）</span>`
        )
        .join(" ")}</div>`
    : `<div class="mat-inline muted">暂无已关联材料</div>`;

  const byWhen = {};
  evidence.forEach((e) => {
    if (!e.when) return;
    (byWhen[e.when] || (byWhen[e.when] = [])).push(e);
  });
  const events = [...timeline].sort((a, b) => (a.when < b.when ? 1 : -1));

  viewRoot.innerHTML = `
    <p class="muted small"><button type="button" class="btn btn-ghost" id="btn-back">← ${esc(
      backLabel
    )}</button></p>
    <div class="page-head">
      <h1>${esc(deal.name)}</h1>
      <p>
        <span class="pill">${esc(deal.type)}</span>
        <span class="pill ${deal.open ? "warn" : "ok"}">${esc(deal.status)}</span>
        ${
          deal.bucket
            ? `<span class="pill ${levelClass(deal.bucket)}">${esc(deal.bucket)}</span>`
            : ""
        }
        · 负责人 ${esc(deal.owner)}
        · ${deal.open ? esc(deal.why) : "已完成"}
      </p>
    </div>
    <section class="deal-section">
      <h2>现在怎样</h2>
      <div class="deal-summary">
        <p style="margin:0">${esc(deal.summary)}</p>
        ${matLinks}
      </div>
    </section>
    <section class="deal-section">
      <h2>最近进展</h2>
      <div id="timeline" class="timeline"></div>
    </section>
    <section class="deal-section">
      <h2>就这一单问</h2>
      <p class="muted small" style="margin:0 0 8px">${
        isHr
          ? "材料没有的不会编；点文件名能看原文。"
          : "材料没有的不会编；出处可点开。"
      }</p>
      <div class="hint-row" id="hints"></div>
      <div class="ask-box">
        <input id="q" placeholder="${
          isHr
            ? "现在怎样 / 依据在哪 / 还缺什么 / 找谁"
            : "现在怎样 / 口径依据 / 该催什么 / 缺什么材料 / 找谁"
        }" />
        <button class="btn btn-primary" id="btn-ask" type="button">提问</button>
      </div>
      <div id="answer"></div>
    </section>`;

  document.getElementById("btn-back").onclick = () =>
    switchView(
      returnView === "team" ? "team" : returnView === "done" ? "done" : "mine",
      true
    );

  document.getElementById("timeline").innerHTML = events.length
    ? events
        .map((e) => {
          const mats = byWhen[e.when] || [];
          const matHtml = mats.length
            ? `<div class="ev-mats">${mats
                .map(
                  (m) =>
                    `<a href="${materialHref(m)}">${esc(m.file)}</a><span class="muted"> · ${esc(
                      m.summary
                    )}</span>`
                )
                .join("<br/>")}</div>`
            : "";
          return `<div class="ev">
            <div class="when">${esc(e.when)}</div>
            <div>${esc(e.text)}</div>
            ${matHtml}
          </div>`;
        })
        .join("")
    : `<div class="empty">暂无进展记录</div>`;

  const hints = isHr
    ? ["现在卡在哪？", "依据原文在哪？", "还缺什么材料？", "这单找谁？"]
    : [
        "现在卡在哪？",
        "客户说过的有依据吗？",
        "这一单该催什么？",
        "还缺什么材料？",
        "这单找谁？",
      ];
  document.getElementById("hints").innerHTML = hints
    .map(
      (h) =>
        `<button type="button" class="btn" data-hint="${esc(h)}">${esc(h)}</button>`
    )
    .join(" ");

  function citeHtml(c) {
    if (c.href) {
      return `<div class="citation"><a class="file-link" href="${esc(c.href)}">${esc(
        c.file
      )}</a>${c.seg ? ` · ${esc(c.seg)}` : ""}<br/>${esc(c.summary || "")}</div>`;
    }
    return `<div class="citation"><strong>${esc(c.file)}</strong>${
      c.seg ? ` · ${esc(c.seg)}` : ""
    }<br/>${esc(c.summary || "")}</div>`;
  }

  async function runAsk(q) {
    const res = await askDeal(dealId, q);
    document.getElementById("answer").innerHTML = `
      <div class="card ask-answer" style="margin-top:10px">
        <div class="muted small">答案</div>
        <p class="lead">${esc(res.answer)}</p>
        ${res.next ? `<div class="next">${esc(res.next)}</div>` : ""}
        ${
          res.citations?.length
            ? `<div style="margin-top:10px"><div class="muted small">${
                isHr ? "原文从哪来（点开看）" : "出处（点击查阅）"
              }</div>${res.citations
                .map(citeHtml)
                .join("")}</div>`
            : ""
        }
      </div>`;
  }

  document.getElementById("hints").onclick = (e) => {
    const b = e.target.closest("[data-hint]");
    if (!b) return;
    document.getElementById("q").value = b.dataset.hint;
    runAsk(b.dataset.hint);
  };
  document.getElementById("btn-ask").onclick = () =>
    runAsk(document.getElementById("q").value);
  document.getElementById("q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runAsk(document.getElementById("q").value);
    }
  });
}

async function paint() {
  if (view === "mine") return paintMine();
  if (view === "team") return paintTeam();
  if (view === "done") return paintDone();
  if (view === "deal") return paintDeal();
  return paintMine();
}

  await paint();
}
