export const active = "compliance";
export const title = "占位";

export async function activate({ account, url, root }) {
  const name = (url.pathname.split("/").pop() || "");
  if (name === "no-access.html") {
    root.innerHTML = `<div class="page-head"><h1>无权限</h1><p>当前账号看不到此页。</p>
      <button type="button" class="btn btn-primary" id="go">回首页</button></div>`;
    const { homeFor } = await import("../session.js?v=nav56");
    root.querySelector("#go").onclick = () => { location.href = account ? homeFor(account) : "./login.html"; };
    return;
  }
  root.innerHTML = '<div class="login-page">\n    <div class="login-card">\n      <div class="logo">合规工作区</div>\n      <p class="sub">本账户能力尚未开通。请切换至已授权账户。</p>\n      <a class="btn btn-primary" href="./login.html">返回登录</a>\n    </div>\n  </div>' || `<div class="page-head"><h1>合规占位</h1><p>本能力尚未开通。</p></div>`;
}
