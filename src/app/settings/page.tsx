"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProviderStatus {
  name: string;
  defaultModel: string;
  configured: boolean;
}

async function fetchSettings(): Promise<{ providers: ProviderStatus[] }> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to load settings");
  return res.json();
}

export default function SettingsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-xl font-semibold text-gray-900">Provider settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        API keys are configured via environment variables and never exposed to the client. Update
        your <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">.env</code> file and restart
        the server to change them.
      </p>

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm text-gray-400">Loading providers…</p>}
        {error && <p className="text-sm text-red-600">Could not load provider settings.</p>}

        {data?.providers.map((provider) => (
          <Card key={provider.name}>
            <CardHeader>
              <CardTitle>{provider.name}</CardTitle>
              {provider.configured ? (
                <Badge tone="success">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Configured
                </Badge>
              ) : (
                <Badge tone="neutral">
                  <XCircle className="mr-1 h-3 w-3" /> Not configured
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
                <dt className="text-gray-500">Default model</dt>
                <dd className="font-mono text-gray-900">{provider.defaultModel}</dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
