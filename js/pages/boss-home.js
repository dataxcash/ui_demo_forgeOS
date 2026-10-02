import { getBoss } from "../api-mock.js?v=nav51";
import { esc } from "../esc.js?v=nav51";

export const roles = ["boss"];
export const active = "boss";
export const title = "经营与风险";

export async function activate({ account, url, root }) {
  root.innerHTML = '<div class="flash" id="flash"></div>\n    <div class="page-head">\n      <h1>经营与风险</h1>\n      <p>第一眼：营收是否正常、哪里要灭火。不是员工矿场操作台。</p>\n    </div>\n    <h2>经营</h2>\n    <div class="grid-2" id="ops" style="margin:12px 0 28px"></div>\n    <h2 id="risks">风险</h2>\n    <div id="risk-list" style="margin-top:12px"></div>';
const data = await getBoss();
const o = data.operating;
document.getElementById("ops").innerHTML = [o.talking, o.closing, o.drift]
  .map(
    (x) => `<div class="card">
      <div class="stat-label">${esc(x.label)}</div>
      <div class="stat">${x.count}</div>
      <div class="muted small">${esc(x.hint)}</div>
    </div>`
  )
  .join("");

document.getElementById("risk-list").innerHTML = data.risks
  .map(
    (r) => `<div class="card">
      <div>
        <span class="pill ${r.level === "高" ? "danger" : r.level === "中" ? "warn" : ""}">${esc(r.level)}</span>
        <strong>${esc(r.title)}</strong>
      </div>
      <p class="small muted" style="margin:8px 0">${esc(r.summary)}</p>
      <div class="small">负责人 ${esc(r.owner)}
        · <a href="./graph-theme.html?id=${esc(r.themeId)}">看主题摘要</a>
      </div>
    </div>`
  )
  .join("");
}
