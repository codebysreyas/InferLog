"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ConversationSummary {
  id: string;
  title: string;
  provider: string;
  model: string;
  updatedAt: string;
  _count: { messages: number };
}

async function fetchConversations(query: string): Promise<ConversationSummary[]> {
  const res = await fetch(`/api/conversations${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

export default function ConversationsPage() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["conversations", search],
    queryFn: () => fetchConversations(search),
  });

  async function handleDelete(id: string) {
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: "Failed to delete conversation", tone: "error" });
      return;
    }
    toast({ title: "Conversation deleted", tone: "success" });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Conversations</h1>
        <Link href="/chat">
          <Button size="sm">New conversation</Button>
        </Link>
      </div>

      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations…"
          aria-label="Search conversations"
          className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
        />
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {!isLoading && data?.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400">No conversations yet.</p>
        )}

        {data?.map((c) => (
          <Card key={c.id} className="flex items-center justify-between px-4 py-3">
            <Link href={`/chat?id=${c.id}`} className="flex flex-1 items-center gap-3 min-w-0">
              <MessageSquare className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{c.title}</p>
                <p className="text-xs text-gray-400">
                  {c.provider} · {c.model} · {c._count.messages} messages
                </p>
              </div>
            </Link>
            <button
              onClick={() => handleDelete(c.id)}
              aria-label={`Delete conversation ${c.title}`}
              className="ml-3 shrink-0 rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        ))}
      </div>
    </main>
  );
}
