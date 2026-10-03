import {
  getOrgDiffTasks,
  uploadOrgCsv,
  getHandover,
  confirmOrgTasks,
  archiveOrgTasks,
  getOrgCurrent,
} from "../api-mock.js?v=nav56";
import { confirmDialog } from "../confirm.js?v=nav56";
import { esc } from "../esc.js?v=nav56";

export const roles = ["hr"];
export const title = "aiSpace";

function resolveView(url) {
  const file = url.pathname.split("/").pop() || "";
  let view = url.searchParams.get("view") || "";
  if (!view) {
    if (file === "hr-import.html") view = "upload";
    else view = "current";
  }
  return view;
}

export function activeKey(url) {
  const view = resolveView(url);
  if (view === "upload") return "hr-upload";
  if (view === "tasks" || view === "task") return "hr-tasks";
  return "hr-current";
}

const KIND_CLASS = { 入: "ok", 转: "warn", 调: "", 离: "danger" };
const KIND_LABEL = { 入: "入职", 转: "转岗", 调: "调岗", 离: "离职" };

export async function activate({ account, url, root }) {
  const view = resolveView(url);
  const taskId = url.searchParams.get("id") || "";

  async function go(nextView, push, extra = {}) {
    const { softNavigate } = await import("../soft-nav.js?v=nav56");
    const u = new URL("./hr-org.html", location.href);
    u.searchParams.set("view", nextView);
    if (extra.id) u.searchParams.set("id", extra.id);
    await softNavigate(u, { push });
  }

  if (view === "upload") return paintUpload();
  if (view === "tasks") return paintTasks();
  if (view === "task" && taskId) return paintTask(taskId);
  return paintCurrent();

  async function paintCurrent() {
    document.title = "已授权人员 · aiSpace";
    const cur = await getOrgCurrent();
    const pack = await getOrgDiffTasks();
    root.innerHTML = `
      <div class="page-head">
        <h1>已授权人员</h1>
        <p>系统里现在认的人（截至 ${esc(cur.asOf)}）。人有变动时：上传花名册 → 对出待办 → 确认或删除存档；待办清完才能再传新表。</p>
      </div>
      <div class="toolbar">
        <span class="count-line">现在 ${cur.people.length} 人 · 待办 ${pack.pendingCount} 条</span>
        <span style="flex:1"></span>
        <a class="btn" href="./hr-org.html?view=tasks">待办事项</a>
        <a class="btn btn-primary" href="./hr-org.html?view=upload">${
          pack.canUpload ? "上传花名册" : "上传花名册（先处理待办）"
        }</a>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>姓名</th><th>部门</th><th>岗位</th><th>上级</th>
            <th>能不能登录</th><th>主要看哪个部门的资料</th><th>备注</th>
          </tr>
        </thead>
        <tbody>
          ${cur.people
            .map(
              (p) => `<tr>
              <td><strong>${esc(p.name)}</strong><div class="muted small">${esc(
                p.account
              )}</div></td>
              <td>${esc(p.dept)}</td>
              <td>${esc(p.title)}</td>
              <td>${esc(p.manager)}</td>
              <td><span class="pill ok">${esc(p.forgeStatus === "可用" ? "可以" : p.forgeStatus)}</span></td>
              <td>${esc(p.space || "—")}</td>
              <td class="small">${
                p.flag
                  ? `<span class="pill warn">${esc(
                      p.flag
                        .replace("名下有未结事项", "还有客户/项目没交接完")
                        .replace("有取证事项进行中", "还有客户/项目没交接完")
                        .replace("有纠纷要备材料", "还有客户/项目没交接完")
                    )}</span>`
                  : "—"
              }</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <p class="muted small" style="margin-top:12px">有人离职时，点开那条「离职」变动，能看到他还没交接完的客户、项目和文件。</p>`;
  }

  async function paintUpload() {
    document.title = "上传花名册 · aiSpace";
    const cur = await getOrgCurrent();
    const pack = await getOrgDiffTasks();
    const blocked = !pack.canUpload;

    root.innerHTML = `
      <div class="flash" id="flash"></div>
      <div class="page-head">
        <h1>上传花名册</h1>
        <p>把人事认为「正确」的花名册传上来。系统会和<a href="./hr-org.html?view=current">现在已授权的 ${cur.people.length} 人</a>自动对比，列出入职、转岗、离职等。</p>
        <p class="muted small" style="margin:8px 0 0">规矩：还有待办时不能传新表。每条待办要么确认生效，要么删除并存档，处理完才能上新。</p>
      </div>
      ${
        blocked
          ? `<div class="card" style="margin-bottom:14px;border-color:var(--warn, #c9a227)">
          <p style="margin:0 0 8px"><strong>还有 ${pack.pendingCount} 条待办没处理完，暂时不能上传。</strong></p>
          <p class="muted small" style="margin:0 0 10px">请先到待办事项里确认，或删除并存档。</p>
          <a class="btn btn-primary" href="./hr-org.html?view=tasks">去处理待办</a>
        </div>`
          : ""
      }
      <div class="card upload-box" style="${blocked ? "opacity:.55;pointer-events:none" : ""}">
        <div class="upload-drop" id="drop">
          <input type="file" id="file-input" accept=".csv,text/csv" hidden ${
            blocked ? "disabled" : ""
          } />
          <p style="margin:0 0 10px">把 CSV 拖到这里，或</p>
          <button type="button" class="btn btn-primary" id="btn-pick" ${
            blocked ? "disabled" : ""
          }>选择文件</button>
        </div>
        <p class="muted small" id="picked" style="margin-top:10px" hidden></p>
        <div class="actions" style="margin-top:12px">
          <button type="button" class="btn btn-primary" id="btn-run" disabled>开始对比</button>
          <a class="btn" href="./hr-org.html?view=tasks">看待办事项</a>
        </div>
      </div>
      <p class="muted small" style="margin-top:14px">
        可先下载样例再上传：
        <a href="../mock/hr/org-2026-10-01.csv" download="org-2026-10-01.csv">org-2026-10-01.csv</a>
        （新人周小白、沈芳；许晴转到售前；冯磊岗位改成开发；花名册里已没有赵强、顾军）。
      </p>`;

    if (blocked) return;

    let fileName = "";
    const input = root.querySelector("#file-input");
    const drop = root.querySelector("#drop");
    const picked = root.querySelector("#picked");
    const btnRun = root.querySelector("#btn-run");

    function setFile(f) {
      if (!f) return;
      fileName = f.name;
      picked.hidden = false;
      picked.textContent = `已选：${f.name}`;
      btnRun.disabled = false;
    }

    root.querySelector("#btn-pick").onclick = () => input.click();
    input.onchange = () => setFile(input.files?.[0]);
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("drag");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("drag");
      if (e.dataTransfer?.files?.[0]) setFile(e.dataTransfer.files[0]);
    });
    btnRun.onclick = async () => {
      const res = await uploadOrgCsv(fileName || "org.csv");
      const flash = root.querySelector("#flash");
      if (!res.ok) {
        flash.textContent = res.message || "不能上传";
        flash.classList.add("show");
        await paintUpload();
        return;
      }
      flash.textContent = "对比完成，已列出要处理的待办";
      flash.classList.add("show");
      await go("tasks", true);
    };
  }

  async function paintTasks() {
    document.title = "待办事项 · aiSpace";
    const pack = await getOrgDiffTasks();
    const pending = pack.tasks.filter((t) => t.status === "pending");
    const done = pack.tasks.filter((t) => t.status === "done");
    const archived = pack.tasks.filter((t) => t.status === "archived");
    const s = pack.summary;
    const leaveHand = pending.filter((t) => t.kind === "离" && t.handoverId);

    root.innerHTML = `
      <div class="flash" id="flash"></div>
      <div class="page-head">
        <h1>待办事项</h1>
        <p>根据「${esc(pack.lastUploadName)}」和现有名单对比出来的（${esc(
          pack.comparedAt
        )}）。每条要么确认生效，要么删除并存档；待办清完后才能上传新花名册。</p>
      </div>
      ${
        leaveHand.length
          ? `<a class="card" href="./hr-org.html?view=task&id=${encodeURIComponent(
              leaveHand[0].id
            )}" style="display:block;color:inherit;text-decoration:none;margin-bottom:14px">
          <div class="dash-k">离职交接</div>
          <div class="stat" style="font-size:22px">${leaveHand.length}</div>
          <p class="muted small" style="margin:6px 0 0">点开看还剩什么没交。</p>
        </a>`
          : ""
      }
      <div class="toolbar">
        <span class="count-line">待办 ${pending.length} 条（入职 ${s.join} · 转岗 ${s.move} · 调岗 ${s.adjust} · 离职 ${s.leave}）</span>
        <span style="flex:1"></span>
        <a class="btn" href="./hr-org.html?view=current">已授权人员</a>
        <a class="btn" href="./hr-org.html?view=upload">${
          pack.canUpload ? "上传花名册" : "上传花名册（先处理待办）"
        }</a>
        <button type="button" class="btn" id="btn-toggle" ${pending.length ? "" : "disabled"}>全选</button>
        <button type="button" class="btn" id="btn-archive" disabled>删除并存档</button>
        <button type="button" class="btn btn-primary" id="btn-confirm" disabled>确认选中的变动</button>
      </div>
      <div id="board" class="deal-board"></div>
      ${
        done.length
          ? `<details style="margin-top:16px"><summary class="muted">这次已确认 ${done.length} 条</summary><div id="done-board" class="deal-board" style="margin-top:8px"></div></details>`
          : ""
      }
      ${
        archived.length
          ? `<details style="margin-top:12px"><summary class="muted">这次已删除并存档 ${archived.length} 条</summary><div id="arch-board" class="deal-board" style="margin-top:8px"></div></details>`
          : ""
      }`;

    const board = root.querySelector("#board");
    board.innerHTML = pending.length
      ? pending.map((t) => taskRow(t, false)).join("")
      : `<div class="empty">待办已处理完。可以去<a href="./hr-org.html?view=upload">上传花名册</a>了。</div>`;

    const doneBoard = root.querySelector("#done-board");
    if (doneBoard) doneBoard.innerHTML = done.map((t) => taskRow(t, "done")).join("");
    const archBoard = root.querySelector("#arch-board");
    if (archBoard)
      archBoard.innerHTML = archived.map((t) => taskRow(t, "archived")).join("");

    const btnConfirm = root.querySelector("#btn-confirm");
    const btnArchive = root.querySelector("#btn-archive");
    const btnToggle = root.querySelector("#btn-toggle");
    const boxes = () => [...board.querySelectorAll("input[type=checkbox]")];
    const sync = () => {
      const all = boxes();
      const n = all.filter((c) => c.checked).length;
      btnConfirm.disabled = n === 0;
      btnArchive.disabled = n === 0;
      if (btnToggle && all.length) {
        btnToggle.textContent = n === all.length ? "取消全选" : "全选";
      }
    };
    board.onchange = sync;
    if (btnToggle) {
      btnToggle.onclick = () => {
        const all = boxes();
        const selectAll = all.some((c) => !c.checked);
        all.forEach((c) => {
          c.checked = selectAll;
        });
        sync();
      };
    }
    const bindOpen = (el) => {
      el?.querySelectorAll("[data-open]").forEach((row) => {
        row.onclick = (e) => {
          if (e.target.closest("input")) return;
          go("task", true, { id: row.getAttribute("data-open") });
        };
      });
    };
    bindOpen(board);
    bindOpen(doneBoard);
    bindOpen(archBoard);

    btnConfirm.onclick = async () => {
      const ids = boxes()
        .filter((c) => c.checked)
        .map((c) => c.value);
      const ok = await confirmDialog({
        title: "确认这些变动？",
        body: `将确认 ${ids.length} 条并生效。没确认的不会改系统名单。`,
        confirmText: "确认",
      });
      if (!ok) return;
      await confirmOrgTasks(ids);
      await paintTasks();
    };

    btnArchive.onclick = async () => {
      const ids = boxes()
        .filter((c) => c.checked)
        .map((c) => c.value);
      const ok = await confirmDialog({
        title: "删除并存档？",
        body: `将删除 ${ids.length} 条待办并留下存档。不会按这些变动改系统名单。`,
        confirmText: "删除并存档",
      });
      if (!ok) return;
      await archiveOrgTasks(ids);
      await paintTasks();
    };
  }

  function taskRow(t, mode = false) {
    const readonly = mode === true || mode === "done" || mode === "archived";
    const kc = KIND_CLASS[t.kind] || "";
    const kind = KIND_LABEL[t.kind] || t.kind;
    const hand = t.handoverId
      ? `<span class="pill warn">要看交接</span>`
      : "";
    const check = readonly
      ? ""
      : `<input type="checkbox" value="${esc(t.id)}" onclick="event.stopPropagation()" />`;
    let side = "";
    if (mode === "done" || t.status === "done") side = `<span class="pill ok">已确认</span>`;
    else if (mode === "archived" || t.status === "archived")
      side = `<span class="muted small">已存档</span>`;
    else if (t.handoverId) side = `<span class="muted small">看交接</span>`;
    return `<div class="deal-row" role="button" tabindex="0" data-open="${esc(t.id)}" style="${
      readonly ? "opacity:.75;cursor:default" : "cursor:pointer"
    }">
      <div class="deal-main" style="display:flex;gap:10px;align-items:flex-start">
        <div style="padding-top:4px">${check}</div>
        <div>
          <div class="deal-title">${esc(t.person)} · ${esc(kind)}</div>
          <div class="deal-meta">
            <span class="pill ${kc}">${esc(kind)}</span>
            <span class="muted">${esc(t.dept || "")}</span>
            ${hand}
          </div>
          <div class="deal-why">${esc(plainDiff(t.diff))}</div>
        </div>
      </div>
      <div class="deal-side">${side}</div>
    </div>`;
  }

  function plainDiff(text) {
    return String(text || "")
      .replace(/CSV 新增 · 当前 ORG 无此人/g, "花名册里有，系统里还没有（新人）")
      .replace(/当前 ORG 有 · CSV 已删除（离职）/g, "系统里有，新花名册里没有（离职）")
      .replace(/另有取证事项进行中/g, "")
      .replace(/；还有纠纷要备材料/g, "")
      .replace(/部门 /g, "部门从")
      .replace(/上级 /g, "上级从")
      .replace(/岗位标签 /g, "岗位从")
      .replace(/（汇报线不变）/g, "（上级没变）");
  }

  async function paintTask(id) {
    const pack = await getOrgDiffTasks();
    const t = pack.tasks.find((x) => x.id === id);
    if (!t) {
      root.innerHTML = `<div class="page-head"><h1>找不到这条</h1></div>
        <button type="button" class="btn" id="back">返回</button>`;
      root.querySelector("#back").onclick = () => go("tasks", true);
      return;
    }
    const kind = KIND_LABEL[t.kind] || t.kind;
    document.title = `${t.person} · aiSpace`;
    const hand = t.handoverId ? await getHandover(t.handoverId) : null;
    const done = t.status === "done";
    const archived = t.status === "archived";
    const pending = t.status === "pending";

    root.innerHTML = `
      <p class="muted small"><button type="button" class="btn btn-ghost" id="back">← 待办事项</button></p>
      <div class="page-head">
        <h1>${esc(t.person)} · ${esc(kind)}</h1>
        <p>
          <span class="pill ${KIND_CLASS[t.kind] || ""}">${esc(kind)}</span>
          · ${esc(t.dept || "")}
          · 账号 ${esc(t.account)}
          ${done ? "· <span class=\"pill ok\">已确认</span>" : ""}
          ${archived ? "· <span class=\"pill\">已存档</span>" : ""}
        </p>
        <p class="muted small" style="margin-top:6px">${esc(plainDiff(t.diff))}</p>
      </div>
      <div id="handover"></div>
      <div class="actions" style="margin-top:16px">
        ${
          pending
            ? `<button type="button" class="btn btn-primary" id="btn-one">确认这条变动</button>
               <button type="button" class="btn" id="btn-arch">删除并存档</button>`
            : done
              ? `<span class="muted small">这条已经确认过了。</span>`
              : `<span class="muted small">这条已删除并存档，不会改系统名单。</span>`
        }
      </div>`;

    root.querySelector("#back").onclick = () => go("tasks", true);

    const box = root.querySelector("#handover");
    if (hand) {
      box.innerHTML = `
        <section class="deal-section">
          <h2>他还没交接完的</h2>
          <p class="muted small" style="margin:0 0 8px">
            <span class="pill ${hand.risk === "高" ? "danger" : hand.risk === "中" ? "warn" : ""}">${
              hand.risk === "高" ? "比较急" : hand.risk === "中" ? "要注意" : "还好"
            }</span>
            ${esc(hand.summary)}
          </p>
          <div class="grid-2">
            <div class="card">
              <div class="dash-k">交接前先办这些</div>
              <ul class="small">${hand.openItems
                .map((x) => `<li>${esc(x)}</li>`)
                .join("")}</ul>
            </div>
            <div class="card">
              <div class="dash-k">手上的客户和项目</div>
              <ul class="small">${hand.themes
                .map(
                  (th) =>
                    `<li>
                      <strong>${esc(th.name)}</strong>
                      <span class="muted">（${esc(th.status)}${
                        th.note ? ` · ${esc(th.note)}` : ""
                      }）</span>
                      <div class="muted small" style="margin-top:2px">
                        客户：${esc(th.customer || "—")}　项目：${esc(th.project || "—")}
                      </div>
                    </li>`
                )
                .join("")}</ul>
            </div>
          </div>
          <div class="card" style="margin-top:8px">
            <div class="dash-k">相关文件</div>
            <ul class="small">${hand.materials
              .map(
                (m) =>
                  `<li><strong>${esc(m.file)}</strong> · ${esc(m.seg)} — ${esc(
                    m.summary
                  )}</li>`
              )
              .join("")}</ul>
          </div>
        </section>`;
    } else if (pending) {
      box.innerHTML = `<p class="muted small">这类变动一般不用单独交接清单。你确认后，系统会按新花名册改好登录和资料范围。</p>`;
    } else {
      box.innerHTML = "";
    }

    const btn = root.querySelector("#btn-one");
    if (btn) {
      btn.onclick = async () => {
        if (t.status !== "pending") return;
        const ok = await confirmDialog({
          title: "确认这条变动？",
          body: `确认「${t.person} · ${kind}」。确认后才算数。`,
          confirmText: "确认",
        });
        if (!ok) return;
        await confirmOrgTasks([t.id]);
        await paintTask(id);
      };
    }
    const btnArch = root.querySelector("#btn-arch");
    if (btnArch) {
      btnArch.onclick = async () => {
        if (t.status !== "pending") return;
        const ok = await confirmDialog({
          title: "删除并存档？",
          body: `删除「${t.person} · ${kind}」并留下存档。不会按这条改系统名单。`,
          confirmText: "删除并存档",
        });
        if (!ok) return;
        await archiveOrgTasks([t.id]);
        await paintTask(id);
      };
    }
  }
}
