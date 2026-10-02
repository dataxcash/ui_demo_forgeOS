const KEY = "fos-webui-account";

export async function loadAccounts() {
  const res = await fetch("../mock/accounts.json");
  return res.json();
}

export function getAccountId() {
  return sessionStorage.getItem(KEY);
}

export function setAccountId(id) {
  sessionStorage.setItem(KEY, id);
}

export function clearAccount() {
  sessionStorage.removeItem(KEY);
}

export async function requireAccount() {
  const id = getAccountId();
  if (!id) {
    location.href = "./login.html";
    return null;
  }
  const accounts = await loadAccounts();
  const account = accounts.find((a) => a.id === id);
  if (!account || account.stub) {
    clearAccount();
    location.href = "./login.html";
    return null;
  }
  return account;
}

export function homeFor(account) {
  const map = {
    employee: "./aispace.html?view=mine",
    manager: "./aispace.html?view=mine",
    hr: "./hr-org.html?view=current",
    boss: "./boss-home.html",
    it: "./it-home.html?view=dashboard",
    compliance: "./compliance-stub.html",
  };
  return map[account.role] || "./login.html";
}

/** 全员：文档入库（单页 + view= 页内切换，避免整页刷新） */
function ingestApp(account) {
  const items = [
    {
      href: "./ingest.html?view=upload",
      labelKey: "nav.ingestUpload",
      key: "ingest-upload",
    },
    {
      href: "./ingest.html?view=machines",
      labelKey: "nav.ingestMachines",
      key: "ingest-machines",
    },
    {
      href: "./ingest.html?view=setup",
      labelKey: "nav.ingestSetup",
      key: "ingest-setup",
    },
    {
      href: "./ingest.html?view=manage",
      labelKey: "nav.ingestManage",
      key: "sync-status",
    },
  ];
  if (account.role === "it") {
    items.push(
      {
        href: "./ingest.html?view=fleet",
        labelKey: "nav.ingestFleet",
        key: "ingest-fleet",
      },
      {
        href: "./ingest.html?view=shared",
        labelKey: "nav.ingestShared",
        key: "ingest-shared",
      }
    );
  }
  return { id: "ingest", appKey: "app.ingest", items };
}

/** 全员：ai 工具 —— 按「活」进，无能力展览壳 */
function aiToolsApp() {
  return {
    appKey: "app.aitools",
    items: [
      { href: "./ai-tool.html?id=ocr", labelKey: "nav.aiOcr", key: "ai-ocr" },
      { href: "./ai-tool.html?id=asr", labelKey: "nav.aiAsr", key: "ai-asr" },
      { href: "./ai-tool.html?id=tts", labelKey: "nav.aiTts", key: "ai-tts" },
      {
        href: "./ai-tool.html?id=content",
        labelKey: "nav.aiContent",
        key: "ai-content",
      },
    ],
  };
}

/** 系统级 App（顶栏 MAIN）+ ROLE 工作区；二级只在侧栏 */
export function navGroupsFor(account) {
  const groups = [];

  if (account.role === "employee" || account.role === "manager") {
    const items = [
      {
        href: "./aispace.html?view=mine",
        labelKey: "nav.myDeals",
        key: "my-deals",
      },
    ];
    if (account.role === "manager") {
      items.push({
        href: "./aispace.html?view=team",
        labelKey: "nav.teamDeals",
        key: "team-deals",
      });
    }
    groups.push({ id: "aispace", appKey: "app.aispace", items });
  } else if (account.role === "hr") {
    /* 花名册对比 → 待办确认；离职点开看交接。不挂「我的单」。 */
    groups.push({
      id: "aispace",
      appKey: "app.aispace",
      items: [
        {
          href: "./hr-org.html?view=current",
          labelKey: "nav.hrCurrent",
          key: "hr-current",
        },
        {
          href: "./hr-org.html?view=tasks",
          labelKey: "nav.hrTasks",
          key: "hr-tasks",
        },
        {
          href: "./hr-org.html?view=upload",
          labelKey: "nav.hrUpload",
          key: "hr-upload",
        },
      ],
    });
  } else if (account.role === "boss") {
    groups.push({
      id: "biz",
      appKey: "app.biz",
      items: [{ href: "./boss-home.html", labelKey: "nav.boss", key: "boss" }],
    });
  } else if (account.role === "it") {
    groups.push({
      id: "platform",
      appKey: "app.platform",
      items: [
        {
          href: "./it-home.html?view=dashboard",
          labelKey: "nav.itDash",
          key: "it-dashboard",
        },
        {
          href: "./it-home.html?view=services",
          labelKey: "nav.itServices",
          key: "it-services",
        },
        {
          href: "./it-home.html?view=compute",
          labelKey: "nav.itCompute",
          key: "it-compute",
        },
        {
          href: "./it-home.html?view=aispace",
          labelKey: "nav.itAispace",
          key: "it-aispace",
        },
        {
          href: "./it-home.html?view=remote",
          labelKey: "nav.itRemote",
          key: "it-remote",
        },
        {
          href: "./it-home.html?view=storage",
          labelKey: "nav.itStorage",
          key: "it-storage",
        },
      ],
    });
  }

  groups.push(ingestApp(account));
  groups.push({ ...aiToolsApp(), id: "aitools" });
  return groups;
}

/** 根据当前页 key 解析所属 App；二级菜单只渲染该 App */
export function resolveNav(account, activeKey) {
  const groups = navGroupsFor(account);
  let current = groups.find((g) => g.items.some((i) => i.key === activeKey));
  // 防回退错 App：ingest-* 找不到时仍落文档入库，勿落到 aiSpace
  if (!current && String(activeKey || "").startsWith("ingest")) {
    current = groups.find((g) => g.id === "ingest");
  }
  if (!current && String(activeKey || "").startsWith("sync-")) {
    current = groups.find((g) => g.id === "ingest");
  }
  if (!current) current = groups[0];
  return {
    groups,
    currentApp: current,
    sideItems: current ? current.items : [],
    activeKey,
  };
}

export function guardPage(account, allowedRoles) {
  if (!allowedRoles.includes(account.role)) {
    location.href = "./no-access.html";
    return false;
  }
  return true;
}
