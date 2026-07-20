# asco-tools（年度更新ナビ）

厚生労働省の「年度更新申告書計算支援ツール（継続事業用）」Excel を、入力しやすい Web アプリへ再構成した MVP です。

## 技術構成

- Next.js 16 / React 19 / TypeScript / Tailwind CSS 4
- Better Auth（メールアドレス・パスワード認証）
- Drizzle ORM + MariaDB 12.3
- Zod（API 境界と業務入力の検証）
- Vercel AI SDK 7 + OpenAI Provider（流式申告助手）
- ExcelJS / PDFKit + Noto Sans JP（有料エクスポート）
- Vitest（保険料計算とエクスポートの回帰テスト）

計算ロジックは `src/domain/declaration.ts` に UI や DB から独立して配置しています。今後 AI 機能を追加する場合も、この決定的な計算関数を Tool として呼び出し、LLM 自身には金額を計算させない設計です。

## ローカル起動

```bash
cp .env.example .env.local
./scripts/dev-db.sh
pnpm db:migrate
pnpm dev
```

ブラウザで <http://localhost:3000> を開き、メールアドレスで新規登録します。

Node.js 22 以上が必要です。このリポジトリでは `.node-version` に `22.22.2` を指定しています。

## 申告助手

サーバー環境に OpenAI Platform API Key を設定すると、申告画面右下の「申告助手」から対話できます。

```dotenv
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-terra
```

助手には現在の入力スナップショットだけを渡します。金額質問では `calculateDeclarationSummary`、入力確認では `inspectDeclaration` という読み取り専用ツールを使います。保存、変更、提出、エクスポート操作は許可していません。API Key が未設定でもローカルの異常値チェックは利用できます。

## 原 Excel 対照

フィールド、ワークシート、計算式の対照記録は [`docs/excel-mapping.md`](docs/excel-mapping.md) にあります。出力ファイルは計算・転記の補助資料であり、そのまま提出できる公式申告書ではありません。

## 有料エクスポートの確認

Excel/PDF の出力はサーバー側で `user.plan === "pro"` を検証します。ローカルで決済接続前の確認をする場合は `.env.local` に登録メールを指定してください。

```dotenv
DEV_PREMIUM_EMAILS=test@example.com
```

本番環境ではこの変数を空にし、決済 Webhook が `user.plan` を更新する実装へ接続してください。

## 管理コンソール

`role=admin` または `ADMIN_EMAILS` に指定したユーザーは `/admin` を利用できます。`support` は管理データの閲覧のみ、`admin` はユーザーのロールと Free/Pro プランを変更できます。変更操作は `admin_audit_log` に記録されます。

```dotenv
ADMIN_EMAILS=admin@example.com
```

## コマンド

```bash
pnpm lint
pnpm test
pnpm build
pnpm db:generate
pnpm db:migrate
```

生产构建显式使用 Next.js 的 Webpack 构建器；当前 Turbopack 与 AI SDK v7 的组合在本项目中会停滞，而 Webpack 构建已通过验证。

## 現在の範囲

実装済み：

- メール登録・ログイン・セッション
- 事業情報、12 か月＋賞与3回の人数・賃金、役員詳細、料率の入力
- 労災保険、雇用保険、一般拠出金、概算保険料のリアルタイム計算
- 下書きの MariaDB 保存
- 申告書一覧、自動保存、編集、翌年度複製、削除
- Excel/PDF 出力履歴と表示名・プランのアカウント設定
- `/admin` の統計、ユーザー権限、申告メタデータ、出力ログ、監査ログ
- Pro 権限を検証した Excel/PDF 出力
- 現在の入力を参照する流式申告助手と読み取り専用計算ツール
- API Key不要の人数・賃金不整合チェック
- レスポンシブ UI と日本語 PDF フォント

公開前に必要：

- 特殊事業（建設、海外派遣、特別加入等）専用フローの追加
- 年度別料率マスタと管理画面
- メール確認、パスワード再設定、レート制限、監査ログ
- Stripe または日本向け決済サービスとの接続
- 利用規約、プライバシーポリシー、特商法表記

> このアプリは申告計算を支援するもので、行政機関の公式サービスではありません。提出前に必ず公式資料と計算結果を照合してください。
