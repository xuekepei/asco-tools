# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**asco-tools**（产品名「年度更新ナビ」）：将日本劳动保险年度更新申告的官方 Excel 计算工具重构为 Web 应用的 MVP。

技术栈：Next.js 16（App Router）/ React 19 / TypeScript / Tailwind CSS 4 / Better Auth / Drizzle ORM + MariaDB / Vercel AI SDK 7 / ExcelJS + PDFKit / Vitest。包管理器为 pnpm，Node >= 22（`.node-version` 指定 22.22.2）。

> **注意（来自 web/AGENTS.md）**：本项目使用的 Next.js 版本与训练数据可能存在破坏性差异。编写 Next.js 相关代码前先阅读 `web/node_modules/next/dist/docs/` 中的相关文档，并留意弃用提示。

## 仓库布局

实际应用位于 `web/` 目录（所有命令都在 `web/` 下执行）。其余位置：

- `web/docs/001679511(3).xlsx` — 厚生劳动省原版「年度更新申告書計算支援ツール（継続事業用）」Excel，是本项目的对照源文件（只读，勿修改）。
- `web/docs/excel-mapping.md` — 与原 Excel 的字段、工作表、公式对照记录。
- `web/docs/stripe-integration-plan.md` — 计费（导出积分）设计文档。
- `.agents/skills/` — Stripe 官方 agent skills（stripe-best-practices 等），处理 Stripe 相关改动前可参考。

## 常用命令

```bash
cd web

# 本地启动（首次）
cp .env.example .env.local
docker compose up -d mariadb
pnpm db:migrate
pnpm dev                # http://localhost:3000

# 开发
pnpm lint               # ESLint
pnpm test               # Vitest 全量运行
pnpm vitest run src/domain/declaration.test.ts   # 单个测试文件
pnpm vitest run -t "测试名称"                     # 按名称过滤
pnpm build              # 生产构建（见下方 Webpack 说明）

# 数据库（Drizzle）
pnpm db:generate        # 修改 src/db/schema.ts 后生成迁移 SQL 到 drizzle/
pnpm db:migrate         # 应用迁移
pnpm db:studio          # Drizzle Studio

# Stripe
pnpm stripe:verify      # 校验导出积分包的 Price 配置
```

**构建必须使用 Webpack**：`build` 脚本显式带 `--webpack` 标志，因为 Turbopack 与 AI SDK v7 组合在本项目会停滞。不要移除该标志。

## 架构

### 领域层（核心）

`src/domain/declaration.ts` 是与 UI、DB 完全解耦的确定性计算模块，对应原 Excel 隐藏工作表「保険料計算シート」的公式：

- `declarationSchema`（Zod）是申告数据结构的唯一权威定义；DB 中 `renewal_declaration.formData` 以 JSON 存储，读取时经 `normalizeDeclaration` 归一化。
- `calculateDeclaration` 计算劳灾/雇用保险、一般拠出金、确定/概算保险料、充当/还付与分纳；`detectDeclarationAnomalies` 做无需 API Key 的本地异常检查。
- **设计约束：LLM 不得自行计算金额**。AI 申告助手（`src/app/api/assistant/route.ts`）只通过只读工具 `calculateDeclarationSummary` / `inspectDeclaration` 调用领域函数，禁止保存、修改、提交、导出操作。
- **修改计算逻辑前必须对照 `web/docs/excel-mapping.md`**（含舍入规则：算定基础额舍去不足 1,000 円、一元适用合并费率、分纳余数入第 1 期等）。

### 数据与认证

- Drizzle schema 在 `src/db/schema.ts`，迁移 SQL 在 `web/drizzle/`（由 `db:generate` 生成，勿手改）。DB 连接在 `src/db/index.ts`（mysql2 连接池，dev 模式挂在 globalThis 上防止热重载重复建池）。
- Better Auth（`src/lib/auth.ts`）：邮箱密码认证 + admin 插件。服务端获取用户统一走 `getCurrentUser()`（`src/lib/current-user.ts`）。
- 权限三级：`user` / `support`（管理数据只读）/ `admin`（可改角色与计划）。`ADMIN_EMAILS` 环境变量可引导初始管理员（`src/lib/admin.ts` 的 `getAdminContext`）。管理端写操作记录到 `admin_audit_log`。

### 计费：预付导出积分（非订阅）

注意：README 中「`user.plan === "pro"` 校验」的说法已过时，实际实现是积分制（`docs/stripe-integration-plan.md` 为准）：

- 注册赠送 `FREE_EXPORT_CREDITS`（默认 3）次导出；每次 Excel/PDF 导出扣 1 积分。
- 购买流程：Stripe hosted Checkout（`payment` 模式，5/20/50 次积分包）→ 仅在签名校验通过的 `checkout.session.completed` webhook 且 `payment_status === "paid"` 时发放积分（`src/lib/billing.ts`）。
- **幂等性是关键设计**：Checkout Session ID 唯一索引 + `export_credit_ledger.sourceKey` 唯一索引 + `SELECT ... FOR UPDATE` 事务，保证 webhook 重试不会重复发放；`consumeExportCredit`（`src/lib/export-credits.ts`）用同样的事务模式原子扣减。改动积分相关代码时必须保持这套幂等/加锁模式。
- 本地跳过付费：`.env.local` 设置 `DEV_PREMIUM_EMAILS`（逗号分隔邮箱）。

### 导出与 API

- `src/lib/exporters.ts` 用 ExcelJS / PDFKit 生成文件，PDF 使用 Noto Sans JP 支持日文。导出 API（`src/app/api/export/*`）在服务端校验登录并扣积分，402 表示积分不足。
- API 路由统一模式：`getCurrentUser()` 鉴权 → Zod `safeParse` 校验输入 → 业务逻辑。服务端专属模块以 `import "server-only"` 开头。
- 环境变量统一经 `src/lib/env.ts` 的 Zod schema 读取；新增变量先在此处声明（并同步 `.env.example`）。

### 页面结构

App Router：`(auth)`（登录/注册）、`dashboard`（申告一览、分步编辑 `declarations/[id]/[step]`、设置）、`admin`（管理控制台）。主要交互组件在 `src/components/`（`declaration-workspace.tsx` 是申告编辑主界面）。

## 测试

Vitest（node 环境，`@` 别名指向 `src/`）。现有回归测试覆盖保险料计算（`src/domain/declaration.test.ts`）与导出（`src/lib/exporters.test.ts`）。修改计算规则时先补对照 Excel 结果的用例。

## 领域注意事项

- 输出的 Excel/PDF 仅为计算与转记辅助材料，不是可直接提交的正式申告书。
- 劳灾保险率随具体业务种类变化，不能由业务区分自动确定，必须由用户对照官方费率表输入。
- 建设、海外派遣、特别加入等特殊业务不适用当前通用计算模型（属未实现范围）。
