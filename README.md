# ForgeOS WebUI（静态预发稿）

多 ROLE × 多 App 操作面。技术：HTML/CSS/JS；文案：`i18n/zh-CN.json`。

## 启动

```bash
cd /home/fila/ryzenHome/ui_demo_forgeOS
python3 -m http.server 18080 --bind 0.0.0.0
```

- 本机：http://127.0.0.1:18080/pages/login.html  
- 局域网：http://\<主机IP\>:18080/pages/login.html  

## 本版相对概念稿的改动

- 产品名：**ForgeOS WebUI**（去掉 DEMO 角标与 aiSpace 整站品牌）
- 导航：左侧 **App 分组 + 菜单项**（企业结构）
- 助理：右侧 **可对话提问**（非仅按钮）
- 观感：更高密度、中性色、深色顶栏
- i18n：中文键值文件，便于后续多语言

账户：李娜（aiSpace/经理）· 陈思（组织人事）· 周衡（经营）· 吴工（平台运维）
