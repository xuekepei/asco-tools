import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";

import {
  calculateDeclaration,
  declarationSchema,
  detectDeclarationAnomalies,
} from "@/domain/declaration";
import { getCurrentUser } from "@/lib/current-user";
import { env } from "@/lib/env";
import { getFeatureFlags } from "@/lib/feature-flags";

export const maxDuration = 30;

const requestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()).max(20),
  declaration: declarationSchema,
});

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const featureFlags = await getFeatureFlags();
  if (!featureFlags.assistant) {
    return Response.json({ error: "assistant_disabled" }, { status: 404 });
  }
  if (!env.OPENAI_API_KEY) {
    return Response.json(
      { error: "assistant_not_configured" },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const declaration = parsed.data.declaration;
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  const result = streamText({
    model: openai(env.OPENAI_MODEL),
    instructions: `あなたは日本の労働保険「年度更新申告書」の入力支援アシスタントです。
回答は簡潔で、専門用語には短い説明を添えてください。
金額・人数・料率について回答する場合は、必ず calculateDeclarationSummary ツールを使い、その結果だけを根拠にしてください。自分で暗算しないでください。
入力不備や異常値の質問では inspectDeclaration ツールを使ってください。
ツールは読み取り専用です。ユーザーの入力を勝手に変更、保存、提出、出力してはいけません。
法的な確定判断や提出可否を断言せず、公式資料との照合または管轄労働局への確認が必要な場合は明示してください。
回答に不要な個人情報や事業情報を繰り返さないでください。`,
    messages: await convertToModelMessages(parsed.data.messages),
    stopWhen: isStepCount(4),
    tools: {
      calculateDeclarationSummary: tool({
        description:
          "現在の入力データを決定的な業務計算関数で集計し、保険料と納付見込額を返す。金額に関する回答では必ず使う。",
        inputSchema: z.object({}),
        execute: async () => calculateDeclaration(declaration),
      }),
      inspectDeclaration: tool({
        description:
          "現在の入力データを検査し、未入力、人数と賃金の不整合、桁の疑いなどを返す。",
        inputSchema: z.object({}),
        execute: async () => ({
          anomalies: detectDeclarationAnomalies(declaration),
          checkedEntries:
            declaration.months.length + declaration.bonusEntries.length,
        }),
      }),
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: () => "申告助手でエラーが発生しました。時間をおいて再度お試しください。",
    }),
  });
}
