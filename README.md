# 秋招自习室 · 企业库数据仓库

本仓库是「秋招自习室」单页应用的**企业数据源**，由 GitHub Actions 每天定时自动更新。

## 它做什么

- `update_companies.py`：调用 DeepSeek API 联网检索最近 1–2 天新开放的 2027 届秋招/校招企业，  
  去重后追加到 `companies.json`，并刷新 `meta.json`（记录更新日期与企业总数）。
- `.github/workflows/daily.yml`：每天**北京时间 09:17** 自动运行上面的脚本，  
  有新增时自动提交回本仓库。
- 站点通过 jsDelivr CDN（`https://cdn.jsdelivr.net/gh/<用户名>/<仓库名>@main/companies.json`）  
  读取本仓库数据，因此**数据更新不需要重新部署前端站点**。

## 你需要做的（一次性配置）

1. 在 GitHub 新建一个**公开**仓库（例如 `qiuzha-companies`），把本目录内容推送上去：
   ```bash
   cd qiuzha-companies
   git init
   git add .
   git commit -m "init 秋招企业库数据"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/qiuzha-companies.git
   git push -u origin main
   ```

2. 在仓库 **Settings → Secrets and variables → Actions → New repository secret** 中，  
   新增名为 `DEEPSEEK_API_KEY` 的 secret，值为你的 DeepSeek API Key。  
   （没有配置该 secret 时，工作流会安全跳过，不会报错。）
3. 在仓库 **Settings → Actions → General → Workflow permissions** 中，  
   选择 **Read and write permissions**（允许 Actions 提交更新）。
4. 回到 **Actions** 标签页，启用 `每日更新秋招企业库` 工作流。  
   可以点一次「Run workflow」手动验证是否能跑通。

## 让前端站点读取本仓库数据

编辑站点 `index.html` 中的常量 `COMPANY_CDN_BASE`，填上你的  
`<用户名>/<仓库名>`，例如：

```js
var COMPANY_CDN_BASE = "willow/qiuzha-companies";
```

填好并重新部署站点后，打开工作台即会显示本仓库的最新企业数据；  
未配置时站点会自动回退到同目录 `companies.json`，再回退到内置离线数据。

## 文件说明

| 文件                            | 说明                                                       |
| ----------------------------- | -------------------------------------------------------- |
| `companies.json`              | 企业数组，字段见 `update_companies.py` 的 `FIELDS`                |
| `meta.json`                   | `{ "updated": "日期", "count": 数量, "source": "秋招自习室企业库" }` |
| `update_companies.py`         | 每日更新脚本（DeepSeek API）                                     |
| `.github/workflows/daily.yml` | GitHub Actions 定时任务                                      |
