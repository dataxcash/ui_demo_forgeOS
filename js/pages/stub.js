export const active = "no-access";
export const title = "无权限";
export const roles = [
  "employee",
  "manager",
  "hr",
  "boss",
  "it",
  "compliance",
];

export async function activate({ account, url, root }) {
  const name = url.pathname.split("/").pop() || "";
  if (name === "no-access.html") {
    root.innerHTML = `<div class="page-head"><h1>无权限</h1><p>当前账号看不到此页。</p>
      <button type="button" class="btn btn-primary" id="go">回首页</button></div>`;
    const { homeFor } = await import("../session.js?v=nav63");
    root.querySelector("#go").onclick = () => {
      location.href = account ? homeFor(account) : "./login.html";
    };
    return;
  }
  const { homeFor } = await import("../session.js?v=nav63");
  location.replace(account ? homeFor(account) : "./login.html");
}
