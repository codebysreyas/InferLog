import Link from "next/link";
import { ArrowRight, Gauge, GitBranch, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Zap,
    title: "Streaming by default",
    description: "Every provider streams token-by-token over a single ndjson response format.",
  },
  {
    icon: Gauge,
    title: "Latency & token tracking",
    description: "Every request logs latency, prompt/completion tokens, and status automatically via the SDK.",
  },
  {
    icon: ShieldCheck,
    title: "PII redaction",
    description: "Emails, phone numbers, card numbers, Aadhaar and PAN are masked before anything is stored.",
  },
  {
    icon: GitBranch,
    title: "Provider agnostic",
    description: "One AIProvider interface backs NVIDIA, OpenAI, Claude and Gemini behind a single call site.",
  },
];

export default function LandingPage() {
  return (
    <main>
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="mb-3 text-sm font-medium text-brand-600">Inference observability</p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Know exactly what your LLM calls are doing.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-gray-500">
            Inferlog is a drop-in logging layer for multi-provider LLM applications — conversation
            history, streaming chat, and a dashboard for latency, tokens, and error rate.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link href="/chat">
              <Button>
                Open chat
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary">View dashboard</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-lg border border-gray-200 bg-white p-5">
              <Icon className="h-5 w-5 text-brand-600" />
              <h3 className="mt-3 text-sm font-semibold text-gray-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-gray-500">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
