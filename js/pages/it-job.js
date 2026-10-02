import { getIt } from "../api-mock.js?v=nav54";
import { esc } from "../esc.js?v=nav54";

export const roles = ["it"];
export const active = "it-job";
export const title = "批炼任务 A";

export async function activate({ account, url, root }) {
  root.innerHTML = '<div class="flash" id="flash"></div>\n    <div class="page-head">\n      <h1>批炼任务 A</h1>\n      <p>闲时谱系批炼。失败可点开日志摘要。</p>\n    </div>\n    <table class="table">\n      <thead><tr><th>任务</th><th>状态</th><th>开始</th><th>日志</th></tr></thead>\n      <tbody id="tb"></tbody>\n    </table>';
const data = await getIt();
document.getElementById("tb").innerHTML = data.jobs
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
}
