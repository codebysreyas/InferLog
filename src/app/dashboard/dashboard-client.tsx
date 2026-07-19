"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  summary: {
    totalRequests: number;
    successRate: number;
    errorRate: number;
    avgLatencyMs: number;
    conversationCount: number;
  };
  providerUsage: { provider: string; count: number }[];
  timeSeries: { timestamp: string; requests: number; avgLatency: number; tokens: number }[];
  recentActivity: {
    id: string;
    provider: string;
    model: string;
    status: "SUCCESS" | "ERROR" | "CANCELLED";
    latencyMs: number;
    totalTokens: number;
    createdAt: string;
    promptPreview: string;
  }[];
}

const COLORS = ["#2563EB", "#059669", "#D97706", "#DC2626"];

async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch("/api/dashboard/stats");
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardClient() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
    refetchInterval: 15_000,
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Last 24 hours</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading && <p className="mt-8 text-sm text-gray-400">Loading metrics…</p>}
      {error && (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load dashboard data.{" "}
          <button onClick={() => refetch()} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatCard label="Requests" value={data.summary.totalRequests.toString()} />
            <StatCard label="Success rate" value={`${data.summary.successRate}%`} />
            <StatCard label="Error rate" value={`${data.summary.errorRate}%`} />
            <StatCard label="Avg latency" value={`${data.summary.avgLatencyMs}ms`} />
            <StatCard label="Conversations" value={data.summary.conversationCount.toString()} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Requests per minute</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeSeries}>
                    <defs>
                      <linearGradient id="req" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      tick={{ fontSize: 11 }}
                      stroke="#94A3B8"
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(v) => new Date(v).toLocaleString()}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Area type="monotone" dataKey="requests" stroke="#2563EB" fill="url(#req)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Provider usage</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {data.providerUsage.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-gray-400">No data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.providerUsage}
                        dataKey="count"
                        nameKey="provider"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {data.providerUsage.map((entry, i) => (
                          <Cell key={entry.provider} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Average latency (ms)</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      tick={{ fontSize: 11 }}
                      stroke="#94A3B8"
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="avgLatency" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Token usage</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      tick={{ fontSize: 11 }}
                      stroke="#94A3B8"
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="tokens" fill="#D97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2 font-medium">Provider</th>
                    <th className="px-4 py-2 font-medium">Model</th>
                    <th className="px-4 py-2 font-medium">Prompt</th>
                    <th className="px-4 py-2 font-medium">Latency</th>
                    <th className="px-4 py-2 font-medium">Tokens</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActivity.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        No inference logs yet.
                      </td>
                    </tr>
                  )}
                  {data.recentActivity.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 text-gray-700">{log.provider}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{log.model}</td>
                      <td className="max-w-[240px] truncate px-4 py-2.5 text-gray-500">{log.promptPreview}</td>
                      <td className="px-4 py-2.5 text-gray-700">{log.latencyMs}ms</td>
                      <td className="px-4 py-2.5 text-gray-700">{log.totalTokens}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={log.status === "SUCCESS" ? "success" : log.status === "ERROR" ? "error" : "pending"}>
                          {log.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
