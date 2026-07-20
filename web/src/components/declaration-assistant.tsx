"use client";

import { useChat } from "@ai-sdk/react";
import {
  AlertTriangle,
  Bot,
  Calculator,
  CheckCircle2,
  LoaderCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  detectDeclarationAnomalies,
  type DeclarationInput,
} from "@/domain/declaration";
import { cn } from "@/lib/utils";

const quickPrompts = [
  "入力内容に不自然な点がないか確認して",
  "納付見込額の内訳を説明して",
  "一般拠出金とは何ですか？",
];

export function DeclarationAssistant({
  open,
  onClose,
  declaration,
  enabled,
}: {
  open: boolean;
  onClose: () => void;
  declaration: DeclarationInput;
  enabled: boolean;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/assistant" }),
    [],
  );
  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });
  const anomalies = useMemo(
    () => detectDeclarationAnomalies(declaration),
    [declaration],
  );
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  const submit = (text: string) => {
    const clean = text.trim();
    if (!clean || busy || !enabled) return;
    clearError();
    void sendMessage(
      { text: clean },
      { body: { declaration } },
    );
    setInput("");
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-[#102019]/25 backdrop-blur-[2px] transition lg:bg-transparent lg:backdrop-blur-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[430px] flex-col border-l border-[#dce4dd] bg-[#fbfcf9] shadow-[-20px_0_60px_rgba(20,49,33,.12)] transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex h-17 items-center justify-between border-b border-[#e1e7e2] bg-white px-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#e6f2e8] text-[#216148]">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 className="font-semibold">申告助手</h2>
              <p className="text-xs text-[#758178]">
                {enabled ? "現在の入力を見ながら回答します" : "API Keyの設定が必要です"}
              </p>
            </div>
          </div>
          <button className="button-ghost !px-2" onClick={onClose} aria-label="閉じる">
            <X size={20} />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
          <div className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#174c3c] text-white">
              <Bot size={16} />
            </span>
            <div className="max-w-[330px] rounded-2xl rounded-tl-md border border-[#e1e7e2] bg-white p-4 text-sm leading-6 text-[#415047] shadow-sm">
              入力中の申告データについて、項目の意味、計算結果、確認すべき点をご案内します。金額は専用計算ツールで確認します。
            </div>
          </div>

          <div className="rounded-2xl border border-[#e2e7e2] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {anomalies.length > 0 ? (
                  <AlertTriangle size={17} className="text-[#b47b00]" />
                ) : (
                  <CheckCircle2 size={17} className="text-[#287554]" />
                )}
                自動チェック
              </span>
              <span className="text-xs text-[#7e8a82]">{anomalies.length}件</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#748078]">
              {anomalies.length > 0
                ? anomalies.slice(0, 2).map((item) => item.month ? `${item.month}: ${item.title}` : item.title).join(" / ")
                : "現時点で明らかな不整合は見つかっていません。"}
            </p>
          </div>

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" && "justify-end",
              )}
            >
              {message.role !== "user" && (
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#174c3c] text-white">
                  <Bot size={16} />
                </span>
              )}
              <div
                className={cn(
                  "max-w-[335px] space-y-2 rounded-2xl p-4 text-sm leading-6",
                  message.role === "user"
                    ? "rounded-tr-md bg-[#174c3c] text-white"
                    : "rounded-tl-md border border-[#e1e7e2] bg-white text-[#34453b] shadow-sm",
                )}
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return <p className="whitespace-pre-wrap" key={index}>{part.text}</p>;
                  }
                  if (part.type.startsWith("tool-")) {
                    return (
                      <div key={index} className="flex items-center gap-2 rounded-xl bg-[#edf4ed] px-3 py-2 text-xs font-medium text-[#3d6651]">
                        <Calculator size={14} /> 入力データを専用ツールで確認
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-3 text-sm text-[#758178]">
              <span className="grid size-8 place-items-center rounded-xl bg-[#174c3c] text-white"><Bot size={16} /></span>
              <LoaderCircle className="animate-spin" size={16} /> 確認しています…
            </div>
          )}
          {error && (
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              申告助手に接続できませんでした。設定または通信状態をご確認ください。
            </div>
          )}
        </div>

        <footer className="border-t border-[#dfe5df] bg-white p-4">
          {messages.length === 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  disabled={!enabled}
                  onClick={() => submit(prompt)}
                  className="shrink-0 rounded-full border border-[#dce4dd] bg-[#f8faf7] px-3 py-2 text-xs text-[#526159] transition hover:border-[#7da28c] disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          {!enabled && (
            <div className="mb-3 rounded-xl bg-[#fff6df] px-3 py-2 text-xs leading-5 text-[#765b1a]">
              サーバーの <code>OPENAI_API_KEY</code> を設定すると対話機能が有効になります。自動チェックはそのまま利用できます。
            </div>
          )}
          <form
            className="flex items-end gap-2 rounded-2xl border border-[#d9e1da] bg-[#f8faf7] p-2 focus-within:border-[#579075] focus-within:ring-4 focus-within:ring-[#2d7458]/10"
            onSubmit={(event) => { event.preventDefault(); submit(input); }}
          >
            <textarea
              rows={2}
              value={input}
              disabled={!enabled || busy}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(input);
                }
              }}
              placeholder="入力内容について質問する…"
              className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none disabled:cursor-not-allowed"
            />
            <button className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#174c3c] text-white disabled:opacity-40" disabled={!enabled || busy || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-[#909a93]">AIの回答は参考情報です。提出前に公式資料をご確認ください。</p>
        </footer>
      </aside>
    </>
  );
}
