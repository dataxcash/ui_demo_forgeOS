

export const roles = ["hr"];
export const active = "hr-home";
export const title = "人事治理";

export async function activate({ account, url, root }) {
  root.innerHTML = '<div class="flash" id="flash"></div>\n    <div class="page-head">\n      <h1>人事治理</h1>\n      <p>组织、开通与待确认。阶段一 ForgeOS WebUI 突出「导入确认板」。</p>\n    </div>\n    <div class="grid-2">\n      <a class="card" href="./hr-import.html" style="display:block;color:inherit;text-decoration:none">\n        <h2>导入确认</h2>\n        <p class="muted small">CSV 批次须总确认后才开通账户</p>\n      </a>\n      <div class="card">\n        <h2>组织与额度</h2>\n        <p class="muted small">占位：部门树 / 额度包（本 ForgeOS WebUI 不深做）</p>\n      </div>\n    </div>';

}
