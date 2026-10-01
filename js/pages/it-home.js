import { getIt } from "../api-mock.js?v=nav18";
import { esc } from "../esc.js?v=nav18";

export const roles = ["it"];
export const active = "it";
export const title = "设施分层";

export async function activate({ account, url, root }) {
  root.innerHTML = '<div class="flash" id="flash"></div>\n    <div class="page-head">\n      <h1>设施分层</h1>\n      <p>资源向（Token A）。不见经营账 B，不开人事号。</p>\n    </div>\n    <div id="layers"></div>';
const data = await getIt();
document.getElementById("layers").innerHTML = data.layers
  .map(
    (l) => `<div class="card">
      <h2>${esc(l.name)}</h2>
      <p class="muted small">${esc(l.desc)}</p>
      <div style="margin-top:8px"><span class="pill ${
        l.health.includes("失败") || l.health.includes("延迟") ? "warn" : "ok"
      }">${esc(l.health)}</span>
      ${l.id === "L4" ? ` · <a href="./it-job.html">看任务</a>` : ""}
      </div>
    </div>`
  )
  .join("");
}
