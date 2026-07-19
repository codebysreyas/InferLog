"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Send, Square, Copy, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type Role = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  pending?: boolean;
  failed?: boolean;
}

const PROVIDERS = [
  { value: "NVIDIA", label: "NVIDIA", model: "nvidia/nemotron-3-super-120b-a12b" },
  { value: "OPENAI", label: "OpenAI", model: "gpt-4o-mini" },
  { value: "CLAUDE", label: "Claude", model: "claude-3-5-sonnet-20241022" },
  { value: "GEMINI", label: "Gemini", model: "gemini-1.5-flash" },
];

export function ChatClient() {
  const router = useRouter();
  const params = useSearchParams();
  const conversationIdParam = params.get("id");

  const [conversationId, setConversationId] = useState<string | undefined>(conversationIdParam ?? undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState(PROVIDERS[0].value);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!conversationIdParam) {
      setConversationId(undefined);
      setMessages([]);
      return;
    }
    setConversationId(conversationIdParam);
    fetch(`/api/conversations/${conversationIdParam}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setMessages(
          data.messages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role.toLowerCase(),
            content: m.content,
          })),
        );
        setProvider(data.provider);
      })
      .catch(() => toast({ title: "Failed to load conversation", tone: "error" }));
  }, [conversationIdParam, toast]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
      const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "", pending: true };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const model = PROVIDERS.find((p) => p.value === provider)?.model ?? PROVIDERS[0].model;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, provider, model, message: trimmed }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error("Chat request failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);

            if (event.type === "start" && !conversationId) {
              setConversationId(event.conversationId);
              router.replace(`/chat?id=${event.conversationId}`, { scroll: false });
            }
            if (event.type === "delta") {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + event.text, pending: false } : m)),
              );
            }
            if (event.type === "error") {
              throw new Error(event.message);
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast({ title: "Generation failed", description: (error as Error).message, tone: "error" });
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, pending: false, failed: true } : m)),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, isStreaming, provider, router, toast],
  );

  function cancelGeneration() {
    abortRef.current?.abort();
  }

  function retryLast() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => prev.filter((m) => m.id !== messages[messages.length - 1].id));
    sendMessage(lastUser.content);
  }

  async function copyMessage(id: string, content: string) {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-56px)] max-w-3xl flex-col px-6">
      <div className="flex items-center justify-between border-b border-gray-200 py-3">
        <h1 className="text-sm font-semibold text-gray-900">
          {conversationId ? "Conversation" : "New conversation"}
        </h1>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={Boolean(conversationId)}
          aria-label="Select provider"
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm disabled:opacity-50"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-6" aria-live="polite">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-gray-400">Start a conversation below.</p>
        )}

        {messages.map((m, idx) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-lg bg-brand-600 px-4 py-2.5 text-sm text-white"
                  : "max-w-[80%] rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900"
              }
            >
              {m.pending && m.content === "" ? (
                <span className="flex gap-1" aria-label="Assistant is typing">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                </span>
              ) : (
                <div className="prose-chat">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}

              {m.failed && <p className="mt-1 text-xs text-red-500">Failed to generate a response.</p>}

              {m.role === "assistant" && !m.pending && m.content && (
                <div className="mt-2 flex gap-2 border-t border-gray-100 pt-2">
                  <button
                    onClick={() => copyMessage(m.id, m.content)}
                    aria-label="Copy response"
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"
                  >
                    {copiedId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedId === m.id ? "Copied" : "Copy"}
                  </button>
                  {idx === messages.length - 1 && (
                    <button
                      onClick={retryLast}
                      aria-label="Regenerate response"
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Regenerate
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="border-t border-gray-200 py-4"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Message…"
            rows={1}
            aria-label="Chat message"
            className="max-h-40 flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
          />
          {isStreaming ? (
            <Button type="button" variant="secondary" onClick={cancelGeneration} aria-label="Stop generating">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </main>
  );
}
