import { getSearchHits } from "../api-mock.js?v=nav57";
import { esc } from "../esc.js?v=nav57";

export const roles = ["employee", "manager"];
export const active = "search";
export const title = "搜";

export async function activate({ account, url, root }) {
  root.innerHTML = '<div class="page-head">\n      <h1>搜</h1>\n      <p>按关键词<strong>找文件/记录</strong>（命中列表）。要「为什么/卡在哪」请用「问」。</p>\n    </div>\n    <div class="ask-box">\n      <input id="q" placeholder="搜：报价、合同、投诉…" value="报价" />\n      <button class="btn btn-primary" id="btn" type="button">搜</button>\n    </div>\n    <ul class="list" id="hits"></ul>';
async function run() {
  const q = document.getElementById("q").value.trim();
  const hits = await getSearchHits(q);
  document.getElementById("hits").innerHTML = hits
    .map(
      (h) => `<li>
        <div class="title">${esc(h.title)} <span class="pill">${esc(h.kind)}</span></div>
        <div class="meta">${esc(h.snippet)}</div>
        ${
          h.themeId
            ? `<div class="meta"><a href="./graph-theme.html?id=${esc(h.themeId)}">关联主题</a></div>`
            : ""
        }
      </li>`
    )
    .join("") || `<li class="empty">无命中</li>`;
}
document.getElementById("btn").onclick = run;
document.getElementById("q").addEventListener("keydown", (e) => {
  if (e.key === "Enter") run();
});
run();
}
