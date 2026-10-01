

export const roles = ["employee", "manager"];
export const active = "me";
export const title = "我的";

export async function activate({ account, url, root }) {
  root.innerHTML = '<div class="page-head">\n      <h1>我的</h1>\n      <p>个人材料与空间入口。文件同步已独立为「文件同步」模块（与 aiSpace 平级）。</p>\n    </div>\n    <div class="card">\n      <h2>个人材料</h2>\n      <p class="muted small">权限内「我相关的」材料入口；深挖请用关系图谱 / 搜。</p>\n    </div>\n    <div class="card" style="margin-top:8px">\n      <h2>文件同步</h2>\n      <p class="muted small">设置、运行状态与统计请使用左侧 <strong>文件同步</strong> App。</p>\n      <p style="margin-top:8px">\n        <a class="btn" href="./ingest.html?view=manage">入库管理</a>\n        <a class="btn" href="./sync-settings.html" style="margin-left:6px">同步设置</a>\n      </p>\n    </div>';

}
