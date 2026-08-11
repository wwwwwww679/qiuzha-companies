# 秋招岗位自动发现与可信数据系统（PRD V2.2 后端）

每天由 **GitHub Actions** 自动运行：抓取种子企业官方招聘页 → 源适配器抽取 →（可选）DeepSeek 校验 → JSON Schema 校验 → Diff 合并 → 提交 `companies.json` / `meta.json`，经 jsDelivr 分发，前端无需重新部署即可拿到新数据。

## 目录结构
- `config/seeds.json` —— 种子企业白名单（你要维护的重点企业，Seed Monitor）
- `adapters/` —— 源适配器：`generic` / `beisen`(北森 ATS) / `moka` / `tupu360` / `custom`
- `lib/fetch.js` —— 带超时与重试的抓取
- `lib/llm.js` —— DeepSeek 抽取（可选，缺 Key 时降级）
- `lib/schema.js` —— 记录校验（日期必须可解析，禁止编造）
- `lib/diff.js` —— 9.2 Diff 规则（new/changed/suspectedClosed/closed/errors）
- `scripts/run.js` —— 编排整条流水线
- `companies.json` / `meta.json` —— **写入仓库根目录**（前端 `COMPANY_CDN_BASE` 直接读取，经 jsDelivr 分发）
- `data/` —— 内部评审池：`candidates.json`(候选) / `pending-review.json`(待核验)，不参与前端展示

## 添加种子企业（你来控制）
编辑 `config/seeds.json`，每条：
```json
{
  "name": "企业名",
  "careerUrl": "官方招聘页 URL",
  "type": "药企 / 外企药企 / CRO / 互联网 …",
  "industry": "创新药 / 临床研发 / 咨询 …",
  "recruit": "校招",
  "target": "2027届",
  "sourceType": "generic | beisen | moka | tupu360 | custom",
  "priority": 1
}
```
提交后下次定时运行（或手动触发 Actions）即生效。

## 启用 AI 抽取（更准）
仓库 **Settings → Secrets and variables → Actions → New repository secret**：
- Name：`DEEPSEEK_API_KEY`，Value：你的 DeepSeek API Key
未配置时自动降级为「规则解析 + 待核验」，仍可正常运行，只是岗位明细需后续 AI/人工补全。

## 部署到 GitHub（把本目录推到仓库）
**目标仓库 = `wwwwwww679/qiuzha-companies`**（前端 `COMPANY_CDN_BASE` 已指向它，推上去后前端**零改动**即可拿到每日自动发现的数据）。

### 基线安全策略（重要）
`scripts/run.js` 每次运行都**先拉取仓库当前的 `companies.json` 作为权威基线**（线上实时数据），再做 Diff 合并。
因此：
- 部署不会覆盖你已有的 42 家企业；
- 你在网页/GitHub 里手动改的数据，下次运行也会被保留（流水线读取线上最新版，而非提交快照）；
- `companies.json` / `meta.json` 始终写入**仓库根目录**（前端读取路径），`data/` 仅存内部评审池。

### 重新部署 / 本地改完后再推送（最稳，用 PAT）
```bash
# 1) 克隆现有数据仓库
git clone https://github.com/wwwwwww679/qiuzha-companies.git /tmp/qiuzha-companies
cd /tmp/qiuzha-companies

# 2) 把本管线的文件复制进去
cp -r lib adapters scripts config .github README.md package.json .gitignore .

# 3) 提交并推送（PAT 需带 repo + workflow 权限）
git add -A
git commit -m "feat: 更新秋招自动发现流水线"
git push   # 用户名填 wwwwwww679，密码粘 PAT（非登录密码）

# 4) 去仓库 Settings → Secrets 添加 DEEPSEEK_API_KEY（可选，不配也能跑）
# 5) Actions 页面手动 Run workflow 验证一次，或等每天北京 02:00 自动跑
```

### 换仓库（可选）
若推到**新仓库**（如 `qiuzhao-discovery`），则需把前端 `index.html` 里的
`var COMPANY_CDN_BASE = "wwwwwww679/qiuzha-companies";` 改成新仓库名，然后重新部署前端站点（同一 shareLink，仅更新内容）。

## 前端接入说明
前端已通过 `COMPANY_CDN_BASE = "wwwwwww679/qiuzha-companies"` 读取本仓库的 `companies.json` / `meta.json`，
经 jsDelivr CDN 分发。**推到 `qiuzha-companies` 后前端无需任何改动。**

## 可信度与核验（对应 PRD V2.2）
- 仅官方来源且近 7/30 天核验 → `verified` / `fresh`；第三方无官方确认 → 待核验(`legacy`)
- Diff 9.2：`new` / `changed`(保留上一版 `_prev`) / `suspectedClosed`(不立即删) / `closed` / `errors`(不覆盖上一版可信数据)
- AI 输出：日期必须可解析，未知字段为 `null`，**绝不编造**岗位/城市/截止日**；校验失败进 `pending-review`，绝不直接发布
- 非目标：不绕过登录 / 验证码 / 付费墙；**不为了企业数量好看自动生成虚假岗位或截止日期**

## 调度
- 每天 **UTC 18:00（北京 02:00）** 自动运行
- 也可在 Actions 页面手动 **Run workflow**
