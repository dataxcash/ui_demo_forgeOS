let dict = null;

export async function loadI18n(locale = "zh-CN") {
  const res = await fetch(`../i18n/${locale}.json`);
  dict = await res.json();
  return dict;
}

export function t(key, fallback) {
  if (!dict) return fallback ?? key;
  return dict[key] ?? fallback ?? key;
}
