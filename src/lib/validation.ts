import { z } from "zod";

export const providerEnum = z.enum(["NVIDIA", "OPENAI", "CLAUDE", "GEMINI"]);

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  provider: providerEnum.default("NVIDIA"),
  model: z.string().min(1),
  message: z.string().min(1).max(8000),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const inferenceLogSchema = z.object({
  requestId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  provider: providerEnum,
  model: z.string().min(1),
  promptPreview: z.string().max(500),
  completionPreview: z.string().max(500).optional(),
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  latencyMs: z.number().int().nonnegative(),
  status: z.enum(["SUCCESS", "ERROR", "CANCELLED"]),
  errorMessage: z.string().max(1000).optional(),
});

export type InferenceLogPayload = z.infer<typeof inferenceLogSchema>;
