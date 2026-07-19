import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const WINDOW_HOURS = 24;

type LogRow = {
  provider: string;
  status: "SUCCESS" | "ERROR" | "CANCELLED";
  latencyMs: number;
  totalTokens: number;
  createdAt: Date;
};

export async function GET() {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  const [logs, conversationCount, recent] = await Promise.all([
    db.inferenceLog.findMany({
      where: { createdAt: { gte: since } },
      select: {
        provider: true,
        status: true,
        latencyMs: true,
        totalTokens: true,
        createdAt: true,
      },
    }),
    db.conversation.count(),
    db.inferenceLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        provider: true,
        model: true,
        status: true,
        latencyMs: true,
        totalTokens: true,
        createdAt: true,
        promptPreview: true,
      },
    }),
  ]);

  const typedLogs = logs as LogRow[];
  const total = typedLogs.length;
  const successCount = typedLogs.filter((l) => l.status === "SUCCESS").length;
  const errorCount = typedLogs.filter((l) => l.status === "ERROR").length;
  const avgLatency = total ? Math.round(typedLogs.reduce((sum, l) => sum + l.latencyMs, 0) / total) : 0;

  const providerUsage = Object.entries(
    typedLogs.reduce<Record<string, number>>((acc, l) => {
      acc[l.provider] = (acc[l.provider] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([provider, count]) => ({ provider, count }));

  const bucketMinutes = 60;
  const buckets = new Map<string, { latencySum: number; count: number; tokens: number }>();
  for (const log of typedLogs) {
    const bucketKey = new Date(
      Math.floor(log.createdAt.getTime() / (bucketMinutes * 60 * 1000)) * bucketMinutes * 60 * 1000,
    ).toISOString();
    const bucket = buckets.get(bucketKey) ?? { latencySum: 0, count: 0, tokens: 0 };
    bucket.latencySum += log.latencyMs;
    bucket.count += 1;
    bucket.tokens += log.totalTokens;
    buckets.set(bucketKey, bucket);
  }

  const timeSeries = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([timestamp, bucket]) => ({
      timestamp,
      requests: bucket.count,
      avgLatency: Math.round(bucket.latencySum / bucket.count),
      tokens: bucket.tokens,
    }));

  return NextResponse.json({
    summary: {
      totalRequests: total,
      successRate: total ? Math.round((successCount / total) * 1000) / 10 : 0,
      errorRate: total ? Math.round((errorCount / total) * 1000) / 10 : 0,
      avgLatencyMs: avgLatency,
      conversationCount,
    },
    providerUsage,
    timeSeries,
    recentActivity: recent,
  });
}
