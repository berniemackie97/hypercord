import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { log } from "../core/logger.js";
import { db } from "../db/index.js";
import { aiUsageLog, aiQuotas } from "../db/schema.js";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";

export type AIProvider = "openai" | "anthropic" | "gemini" | "grok";

export interface AIConfig {
  provider: AIProvider;
  model: string;
  systemPrompt?: string;
}

export interface AIResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  responseTime: number;
}

// Initialize clients (lazy loaded)
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

/**
 * Get OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Get Anthropic client
 */
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Get Gemini client
 */
function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

/**
 * Pricing per 1M tokens (input, output) in USD
 */
const PRICING = {
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },

  // Anthropic
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
  "claude-3-opus-20240229": { input: 15, output: 75 },

  // Gemini
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-pro": { input: 1.25, output: 5 },

  // Grok (placeholder - adjust when available)
  "grok-2": { input: 2, output: 10 },
};

/**
 * Calculate cost based on token usage
 */
function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model as keyof typeof PRICING] || { input: 1, output: 3 };
  const inputCost = (promptTokens / 1000000) * pricing.input;
  const outputCost = (completionTokens / 1000000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(prompt: string, model: string, systemPrompt?: string): Promise<AIResponse> {
  const startTime = Date.now();
  const client = getOpenAIClient();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 2000,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || "";
  const promptTokens = response.usage?.prompt_tokens || 0;
  const completionTokens = response.usage?.completion_tokens || 0;
  const totalTokens = response.usage?.total_tokens || 0;

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost: calculateCost(model, promptTokens, completionTokens),
    responseTime: Date.now() - startTime,
  };
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(prompt: string, model: string, systemPrompt?: string): Promise<AIResponse> {
  const startTime = Date.now();
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0]?.type === "text" ? response.content[0].text : "";
  const promptTokens = response.usage.input_tokens;
  const completionTokens = response.usage.output_tokens;
  const totalTokens = promptTokens + completionTokens;

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost: calculateCost(model, promptTokens, completionTokens),
    responseTime: Date.now() - startTime,
  };
}

/**
 * Call Google Gemini API
 */
async function callGemini(prompt: string, model: string, systemPrompt?: string): Promise<AIResponse> {
  const startTime = Date.now();
  const client = getGeminiClient();
  const geminiModel = client.getGenerativeModel({ model });

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}` : prompt;

  const result = await geminiModel.generateContent(fullPrompt);
  const response = result.response;
  const content = response.text();

  // Gemini doesn't always return token counts, estimate
  const promptTokens = Math.ceil(fullPrompt.length / 4);
  const completionTokens = Math.ceil(content.length / 4);
  const totalTokens = promptTokens + completionTokens;

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost: calculateCost(model, promptTokens, completionTokens),
    responseTime: Date.now() - startTime,
  };
}

/**
 * Main AI service - routes to appropriate provider
 */
export async function callAI(
  prompt: string,
  config: AIConfig,
  context: {
    userId: string;
    guildId: string;
    channelId: string;
    messageId: string;
  }
): Promise<AIResponse> {
  const { provider, model, systemPrompt } = config;

  let response: AIResponse;

  try {
    switch (provider) {
      case "openai":
        response = await callOpenAI(prompt, model, systemPrompt);
        break;

      case "anthropic":
        response = await callAnthropic(prompt, model, systemPrompt);
        break;

      case "gemini":
        response = await callGemini(prompt, model, systemPrompt);
        break;

      case "grok":
        // Grok uses OpenAI-compatible API
        response = await callOpenAI(prompt, model, systemPrompt);
        break;

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    // Log successful usage
    await logUsage(context, provider, model, response, true);

    // Update quota
    await updateQuota(context.userId, context.guildId, provider, response);

    return response;
  } catch (error) {
    log.error({ error, provider, model, userId: context.userId }, "AI API call failed");

    // Log failed usage
    await logUsage(
      context,
      provider,
      model,
      {
        content: "",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        responseTime: 0,
      },
      false,
      error instanceof Error ? error.message : String(error)
    );

    throw error;
  }
}

/**
 * Log AI usage to database
 */
async function logUsage(
  context: { userId: string; guildId: string; channelId: string; messageId: string },
  provider: string,
  model: string,
  response: AIResponse,
  success: boolean,
  error?: string
) {
  try {
    await db.insert(aiUsageLog).values({
      id: nanoid(),
      userId: context.userId,
      guildId: context.guildId,
      channelId: context.channelId,
      messageId: context.messageId,
      provider,
      model,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      estimatedCost: response.estimatedCost,
      responseTime: response.responseTime,
      success,
      error: error || null,
    });
  } catch (err) {
    log.error({ err }, "Failed to log AI usage");
  }
}

/**
 * Update user quota
 */
async function updateQuota(userId: string, guildId: string, provider: string, response: AIResponse) {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    // Try to find existing quota record
    const existing = await db.query.aiQuotas.findFirst({
      where: (q, { eq, and }) => and(eq(q.userId, userId), eq(q.guildId, guildId), eq(q.provider, provider), eq(q.month, month)),
    });

    if (existing) {
      // Update existing
      await db
        .update(aiQuotas)
        .set({
          messagesUsed: existing.messagesUsed + 1,
          tokensUsed: existing.tokensUsed + response.totalTokens,
          totalCost: existing.totalCost + response.estimatedCost,
        })
        .where(eq(aiQuotas.id, existing.id));
    } else {
      // Create new quota record
      await db.insert(aiQuotas).values({
        id: nanoid(),
        userId,
        guildId,
        provider,
        month,
        messagesUsed: 1,
        tokensUsed: response.totalTokens,
        totalCost: response.estimatedCost,
      });
    }
  } catch (err) {
    log.error({ err }, "Failed to update AI quota");
  }
}

/**
 * Check if user has exceeded their quota
 */
export async function checkQuota(userId: string, guildId: string, provider: string, monthlyLimit?: number): Promise<boolean> {
  if (!monthlyLimit) return true; // Unlimited

  const month = new Date().toISOString().slice(0, 7);

  const quota = await db.query.aiQuotas.findFirst({
    where: (q, { eq, and }) => and(eq(q.userId, userId), eq(q.guildId, guildId), eq(q.provider, provider), eq(q.month, month)),
  });

  if (!quota) return true; // No usage yet

  return quota.messagesUsed < monthlyLimit;
}
