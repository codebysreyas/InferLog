import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastProvider } from "@/hooks/use-toast";
import { QueryProvider } from "@/lib/query-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Inferlog — LLM Inference Logging",
  description: "Observability platform for multi-provider LLM applications.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
        <QueryProvider>
          <ToastProvider>
            <Nav />
            <ErrorBoundary>{children}</ErrorBoundary>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
