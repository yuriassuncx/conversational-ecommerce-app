import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./runtimePaths.js";

export const ANALYTICS_LOG_PATH = path.join(DATA_DIR, "analytics-events.jsonl");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }

  if (Array.isArray(value)) {
    return depth >= 1 ? value.length : value.slice(0, 12).map((entry) => sanitizeValue(entry, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 1) {
      return Object.keys(value as Record<string, unknown>);
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeValue(entry, depth + 1)])
    );
  }

  return String(value);
}

export function recordAnalyticsEvent(type: string, payload: Record<string, unknown>) {
  ensureDataDir();
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    ...payload,
  };

  fs.appendFileSync(ANALYTICS_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}

export function recordToolAnalytics({
  toolName,
  sessionId,
  latencyMs,
  success,
  view,
  args,
  error,
}: {
  toolName: string;
  sessionId?: string;
  latencyMs: number;
  success: boolean;
  view?: string;
  args: Record<string, unknown>;
  error?: string;
}) {
  recordAnalyticsEvent("tool_invocation", {
    toolName,
    sessionId,
    latencyMs,
    success,
    view,
    args: sanitizeValue(args),
    error,
  });
}

export function recordCartSnapshot({
  sessionId,
  toolName,
  itemCount,
  subtotal,
  total,
  couponCode,
  vendorCode,
}: {
  sessionId?: string;
  toolName: string;
  itemCount: number;
  subtotal: number;
  total: number;
  couponCode?: string;
  vendorCode?: string;
}) {
  recordAnalyticsEvent("cart_snapshot", {
    sessionId,
    sourceTool: toolName,
    itemCount,
    subtotal,
    total,
    couponCode,
    vendorCode,
  });
}

export function recordWishlistSnapshot({
  sessionId,
  toolName,
  itemCount,
}: {
  sessionId?: string;
  toolName: string;
  itemCount: number;
}) {
  recordAnalyticsEvent("wishlist_snapshot", {
    sessionId,
    sourceTool: toolName,
    itemCount,
  });
}