import { NextResponse } from "next/server";

const PROVIDERS = [
  { name: "NVIDIA", envVar: "NVIDIA_API_KEY", defaultModel: process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3-super-120b-a12b" },
  { name: "OPENAI", envVar: "OPENAI_API_KEY", defaultModel: "gpt-4o-mini" },
  { name: "CLAUDE", envVar: "ANTHROPIC_API_KEY", defaultModel: "claude-3-5-sonnet-20241022" },
  { name: "GEMINI", envVar: "GOOGLE_API_KEY", defaultModel: "gemini-1.5-flash" },
];

export async function GET() {
  const providers = PROVIDERS.map(({ name, envVar, defaultModel }) => ({
    name,
    defaultModel,
    configured: Boolean(process.env[envVar]),
  }));

  return NextResponse.json({ providers });
}
