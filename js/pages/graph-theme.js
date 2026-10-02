import { getTheme } from "../api-mock.js?v=nav52";
import { esc } from "../esc.js?v=nav52";

export const roles = ["employee", "manager", "boss"];
export const active = "graph";
export const title = "主题";

export async function activate({ account, url, root }) {
  root.innerHTML = '<p class="muted small"><a href="./graph.html">← 关系图谱</a></p>\n    <div class="page-head" id="head"></div>\n    <div class="tabs" id="tabs">\n      <button type="button" data-tab="rel" class="active">关系</button>\n      <button type="button" data-tab="time">进程</button>\n      <button type="button" data-tab="mat">材料</button>\n    </div>\n    <div id="panel"></div>';
const id = new URLSearchParams(location.search).get("id") || "T-041";
const data = await getTheme(id);
if (!data.theme) {
  document.getElementById("panel").innerHTML = `<div class="empty">主题不存在</div>`;
  throw 0;
}
const t = data.theme;
document.getElementById("head").innerHTML = `
  <h1>${esc(t.name)}</h1>
  <p><span class="pill">${esc(t.type)}</span>${esc(t.status)} · 负责人 ${esc(t.owner)}</p>`;

let tab = "rel";
function paint() {
  const p = document.getElementById("panel");
  if (tab === "rel") {
    p.innerHTML = data.relations.length
      ? data.relations
          .map(
            (r) => `<span class="rel-node">
              <span class="k">${esc(r.kind)}</span>
              ${
                r.ref
                  ? `<a href="./graph-theme.html?id=${esc(r.ref)}">${esc(r.name)}</a>`
                  : esc(r.name)
              }
            </span>`
          )
          .join("")
      : `<div class="empty">暂无关系边</div>`;
  } else if (tab === "time") {
    p.innerHTML = `<div class="timeline">${data.timeline
      .map(
        (e) => `<div class="ev">
          <div class="when">${esc(e.when)}</div>
          <div>${esc(e.text)}</div>
        </div>`
      )
      .join("")}</div>`;
  } else {
    p.innerHTML = data.evidence
      .map(
        (e) => `<div class="card">
          <div class="title">${esc(e.file)}</div>
          <div class="meta">${esc(e.seg)}</div>
          <p class="small" style="margin:8px 0 0">${esc(e.summary)}</p>
        </div>`
      )
      .join("") || `<div class="empty">暂无材料段</div>`;
  }
}
document.getElementById("tabs").onclick = (e) => {
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  tab = b.dataset.tab;
  document.querySelectorAll("#tabs button").forEach((x) =>
    x.classList.toggle("active", x === b)
  );
  paint();
};
paint();
}
