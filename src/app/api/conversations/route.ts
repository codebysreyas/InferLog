import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q")?.trim();

  const conversations = await db.conversation.findMany({
    where: search ? { title: { contains: search, mode: "insensitive" } } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json(conversations);
}
