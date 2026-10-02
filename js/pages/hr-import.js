import {
  getImportBatch,
  patchImportRow,
  removeImportRow,
  confirmImport,
} from "../api-mock.js?v=nav54";
import { confirmDialog } from "../confirm.js?v=nav54";
import { esc } from "../esc.js?v=nav54";

export const roles = ["hr"];
export const active = "hr-import";
export const title = "导入确认板";

export async function activate({ account, url, root }) {
  root.innerHTML = '<div class="flash" id="flash"></div>\n    <div class="page-head">\n      <h1>导入确认板</h1>\n      <p>未确认 ≠ 已开通。可剔行、改部门；总确认是唯一生效闸门。</p>\n    </div>\n    <div id="done" hidden></div>\n    <div id="work">\n      <div class="toolbar">\n        <button class="btn" type="button" id="btn-normal">只勾「正常」</button>\n        <button class="btn btn-primary" type="button" id="btn-confirm" disabled>确认开通</button>\n      </div>\n      <table class="table">\n        <thead>\n          <tr><th></th><th>姓名</th><th>部门</th><th>上级</th><th>建议账户</th><th>色标</th><th></th></tr>\n        </thead>\n        <tbody id="tb"></tbody>\n      </table>\n    </div>';
const flagClass = { 正常: "ok", dup: "warn", miss: "warn", conflict: "danger" };

async function paint() {
  const batch = await getImportBatch();
  if (batch.confirmed) {
    document.getElementById("work").hidden = true;
    const d = document.getElementById("done");
    d.hidden = false;
    d.innerHTML = `<div class="card"><h2>本会话已确认开通</h2>
      <p>已开通 <strong>${batch.confirmed.opened}</strong> 人。刷新后仍保持（sessionStorage）。</p>
      <p class="muted small">批次 ${esc(batch.batchId)} · ${esc(batch.source)}</p></div>`;
    return;
  }
  document.getElementById("work").hidden = false;
  document.getElementById("done").hidden = true;
  const tb = document.getElementById("tb");
  tb.innerHTML = batch.rows
    .map((r) => {
      const fc = flagClass[r.flag] || flagClass[r.flagLabel] || "";
      return `<tr data-id="${esc(r.id)}">
        <td><input type="checkbox" data-id="${esc(r.id)}" ${
          r.flag === "正常" || r.flagLabel === "正常" ? "" : ""
        }/></td>
        <td>${esc(r.name)}</td>
        <td><input style="width:110px" value="${esc(r.dept)}" data-field="dept" /></td>
        <td>${esc(r.manager || "—")}</td>
        <td class="small">${esc(r.account)}</td>
        <td><span class="pill ${fc}">${esc(r.flagLabel || r.flag)}</span></td>
        <td><button type="button" class="btn btn-ghost" data-rm="${esc(r.id)}">剔除</button></td>
      </tr>`;
    })
    .join("");

  const sync = () => {
    document.getElementById("btn-confirm").disabled =
      tb.querySelectorAll("input[type=checkbox]:checked").length === 0;
  };
  tb.onchange = async (e) => {
    const input = e.target;
    if (input.matches("input[data-field]")) {
      await patchImportRow(input.closest("tr").dataset.id, {
        [input.dataset.field]: input.value,
      });
    }
    sync();
  };
  tb.onclick = async (e) => {
    const rm = e.target.getAttribute("data-rm");
    if (!rm) return;
    await removeImportRow(rm);
    await paint();
  };
  sync();
}

document.getElementById("btn-normal").onclick = () => {
  document.querySelectorAll("#tb tr").forEach((tr) => {
    const pill = tr.querySelector(".pill");
    const cb = tr.querySelector("input[type=checkbox]");
    if (pill && pill.textContent === "正常") cb.checked = true;
    else cb.checked = false;
  });
  document.getElementById("btn-confirm").disabled =
    document.querySelectorAll("#tb input[type=checkbox]:checked").length === 0;
};

// Copilot prefill hook via custom event from shell — also listen flash text
document.getElementById("btn-confirm").onclick = async () => {
  const ids = [...document.querySelectorAll("#tb input[type=checkbox]:checked")].map(
    (x) => x.dataset.id
  );
  const ok = await confirmDialog({
    title: "确认开通账户",
    body: `将对 ${ids.length} 人生成/更新账户。此为唯一生效闸门。`,
    confirmText: "确认开通",
  });
  if (!ok) return;
  const res = await confirmImport(ids);
  const flash = document.getElementById("flash");
  flash.textContent = `已开通 ${res.opened} 人`;
  flash.classList.add("show");
  // refresh shell status by reload
  location.reload();
};

// If copilot said prefill — detect via session flag set by user clicking; enhance shell skill
window.__hrPrefillNormal = () => document.getElementById("btn-normal").click();

await paint();
}
