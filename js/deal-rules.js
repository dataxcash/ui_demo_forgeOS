/** 分桶硬规则 + CRM 边界（对用户可见的唯一口径） */
export const BUCKET_RULES = [
  {
    key: "须尽快",
    rule: "满足任一：卡超过 7 天仍未解；客诉/风险升温；对外口径与内部计划冲突、未对齐前不能对外说。",
  },
  {
    key: "这周要动",
    rule: "未到「须尽快」，但本周有明确动作：回访、催料、确认承诺、对内对齐。",
  },
  {
    key: "跟进中",
    rule: "节奏正常，暂无加塞必要；保持观察即可。",
  },
];

export const CRM_BOUNDARY =
  "阶段、金额、负责人以公司 CRM 为准；本页补的是材料里的实情、卡点说明与出处，不替代 CRM 改单。";

export function rulesHtml() {
  return (
    `<div class="rules-box">` +
    `<div class="rules-title">分桶怎么定（固定规则，不是随口标）</div>` +
    `<ul>${BUCKET_RULES.map(
      (r) => `<li><strong>${r.key}</strong>：${r.rule}</li>`
    ).join("")}</ul>` +
    `<div class="crm-note">${CRM_BOUNDARY}</div>` +
    `</div>`
  );
}
