import { getThemes, getTeamBoard, getCandidates } from "../api-mock.js?v=nav52";
import { esc } from "../esc.js?v=nav52";

export const roles = ["employee", "manager"];
export const active = "graph";
export const title = "关系图谱";

export async function activate({ account, url, root }) {
  root.innerHTML = '<div class="flash" id="flash"></div>\n    <div class="page-head">\n      <h1>关系图谱</h1>\n      <p>先看谱系与进程，再决定问或搜。经理可看「团队」切片。</p>\n    </div>\n    <div class="toolbar">\n      <div class="seg" id="scope">\n        <button type="button" data-scope="mine" class="active">我的</button>\n        <button type="button" data-scope="team" id="scope-team" hidden>团队</button>\n      </div>\n      <a class="btn" href="./graph-candidates.html" id="link-cand" hidden>主题待确认</a>\n    </div>\n    <div id="board"></div>';
const isMgr = account.role === "manager";
if (isMgr) {
  document.getElementById("scope-team").hidden = false;
  document.getElementById("link-cand").hidden = false;
  const n = (await getCandidates()).length;
  document.getElementById("link-cand").textContent = `主题待确认（${n}）`;
}

let scope = "mine";
const themesAll = await getThemes();
const team = await getTeamBoard();

function paint() {
  let list;
  if (scope === "team" && isMgr) {
    list = team.themes;
    document.getElementById("board").innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <div class="muted small">团队墙 · 按人（不含下属私域）</div>
        ${team.people
          .map(
            (p) =>
              `<div style="margin-top:8px"><strong>${esc(p.name)}</strong>
              <span class="muted small"> · ${p.themes.length} 题</span></div>`
          )
          .join("")}
      </div>
      <ul class="list">${list
        .map(
          (t) => `<li>
            <a class="title" href="./graph-theme.html?id=${esc(t.id)}">${esc(t.name)}</a>
            <div class="meta">${esc(t.type || "")} · ${esc(t.owner)} · ${esc(t.status)}</div>
          </li>`
        )
        .join("")}</ul>`;
  } else {
    list = themesAll.filter((t) =>
      isMgr ? true : ["李娜", "钱进"].includes(t.owner) || t.owner === account.name
    );
    // employee/manager "mine": show themes owned by 李娜 primarily for demo
    if (!isMgr || scope === "mine") {
      list = themesAll.filter((t) => t.owner === "李娜" || t.id === "T-041");
    }
    document.getElementById("board").innerHTML = `<ul class="list">${list
      .map(
        (t) => `<li>
          <a class="title" href="./graph-theme.html?id=${esc(t.id)}">${esc(t.name)}</a>
          <div class="meta"><span class="pill">${esc(t.type)}</span>${esc(t.status)} · 更新 ${esc(t.updated)}</div>
        </li>`
      )
      .join("")}</ul>`;
  }
}

document.getElementById("scope").onclick = (e) => {
  const btn = e.target.closest("button[data-scope]");
  if (!btn) return;
  scope = btn.dataset.scope;
  document.querySelectorAll("#scope button").forEach((b) =>
    b.classList.toggle("active", b === btn)
  );
  paint();
};
paint();
}
