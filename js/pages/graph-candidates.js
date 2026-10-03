import {
  getCandidates,
  confirmCandidates,
  rejectCandidates,
} from "../api-mock.js?v=nav55";
import { confirmDialog } from "../confirm.js?v=nav55";
import { esc } from "../esc.js?v=nav55";

export const roles = ["employee", "manager"];
export const active = "graph";
export const title = "主题待确认";

export async function activate({ account, url, root }) {
  root.innerHTML = '<div class="flash" id="flash"></div>\n    <div class="page-head">\n      <h1>主题待确认</h1>\n      <p>批炼给出的候选。点选入库或驳回；确认后会进团队墙（本会话记住）。</p>\n    </div>\n    <div class="toolbar">\n      <button class="btn btn-primary" id="btn-ok" type="button" disabled>确认入库</button>\n      <button class="btn" id="btn-no" type="button" disabled>驳回</button>\n      <a class="btn btn-ghost" href="./graph.html">返回图谱</a>\n    </div>\n    <table class="table">\n      <thead>\n        <tr><th></th><th>候选主题</th><th>建议负责人</th><th>理由</th><th>置信</th></tr>\n      </thead>\n      <tbody id="tb"></tbody>\n    </table>';
async function paint() {
  const rows = await getCandidates();
  const tb = document.getElementById("tb");
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="5" class="empty">没有待确认项（本会话已处理完）</td></tr>`;
    document.getElementById("btn-ok").disabled = true;
    document.getElementById("btn-no").disabled = true;
    return;
  }
  tb.innerHTML = rows
    .map(
      (r) => `<tr>
        <td><input type="checkbox" data-id="${esc(r.id)}" /></td>
        <td><strong>${esc(r.name)}</strong><div class="muted small">${esc(r.type)}</div></td>
        <td>${esc(r.suggestedOwner)}</td>
        <td class="small">${esc(r.reason)}</td>
        <td>${Math.round(r.confidence * 100)}%</td>
      </tr>`
    )
    .join("");
  const sync = () => {
    const n = tb.querySelectorAll("input:checked").length;
    document.getElementById("btn-ok").disabled = n === 0;
    document.getElementById("btn-no").disabled = n === 0;
  };
  tb.onchange = sync;
  sync();
}

function selected() {
  return [...document.querySelectorAll("#tb input:checked")].map(
    (x) => x.dataset.id
  );
}

document.getElementById("btn-ok").onclick = async () => {
  const ids = selected();
  const ok = await confirmDialog({
    title: "确认入库",
    body: `将 ${ids.length} 条候选确认为主题并进入团队墙。`,
    confirmText: "入库",
  });
  if (!ok) return;
  const res = await confirmCandidates(ids);
  const flash = document.getElementById("flash");
  flash.textContent = `已入库 ${res.count} 条`;
  flash.classList.add("show");
  await paint();
};

document.getElementById("btn-no").onclick = async () => {
  const ids = selected();
  const ok = await confirmDialog({
    title: "驳回候选",
    body: `驳回 ${ids.length} 条，本会话不再显示。`,
    confirmText: "驳回",
    danger: true,
  });
  if (!ok) return;
  await rejectCandidates(ids);
  await paint();
};

await paint();
}
