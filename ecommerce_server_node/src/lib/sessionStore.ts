import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./runtimePaths.js";

export interface PersistedCartItem {
  productId: string;
  size: string;
  quantity: number;
}

export interface PersistedCart {
  orderFormId?: string;
}

export interface PersistedSession {
  sessionId: string;
  cart: PersistedCart;
  wishlistProductIds: string[];
  createdAt: number;
  updatedAt: number;
}

type PersistedSessions = Record<string, PersistedSession>;

export const SESSION_STORE_PATH = path.join(DATA_DIR, "commerce-sessions.json");

let cacheLoaded = false;
const sessionCache = new Map<string, PersistedSession>();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultSession(sessionId: string): PersistedSession {
  const now = Date.now();
  return {
    sessionId,
    cart: {},
    wishlistProductIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

function loadCache() {
  if (cacheLoaded) {
    return;
  }

  cacheLoaded = true;
  if (!fs.existsSync(SESSION_STORE_PATH)) {
    return;
  }

  try {
    const raw = fs.readFileSync(SESSION_STORE_PATH, "utf8");
    if (!raw.trim()) {
      return;
    }

    const persisted = JSON.parse(raw) as PersistedSessions;
    for (const [sessionId, session] of Object.entries(persisted)) {
      sessionCache.set(sessionId, session);
    }
  } catch (error) {
    console.error("[sessionStore] failed to load persisted sessions", error);
  }
}

function persistCache() {
  ensureDataDir();
  const serialized = Object.fromEntries(sessionCache.entries());
  fs.writeFileSync(SESSION_STORE_PATH, JSON.stringify(serialized, null, 2), "utf8");
}

export function getSessionSnapshot(sessionId: string): PersistedSession {
  loadCache();

  if (!sessionCache.has(sessionId)) {
    const session = defaultSession(sessionId);
    sessionCache.set(sessionId, session);
    persistCache();
  }

  return clone(sessionCache.get(sessionId)!);
}

export function updateSession(
  sessionId: string,
  updater: (session: PersistedSession) => void
): PersistedSession {
  loadCache();

  const session = sessionCache.get(sessionId) ?? defaultSession(sessionId);
  updater(session);
  session.updatedAt = Date.now();

  sessionCache.set(sessionId, session);
  persistCache();

  return clone(session);
}

export function listPersistedSessions(): PersistedSession[] {
  loadCache();
  return Array.from(sessionCache.values()).map((session) => clone(session));
}

export function resetSessionStoreForTests() {
  cacheLoaded = true;
  sessionCache.clear();
  if (fs.existsSync(SESSION_STORE_PATH)) {
    fs.unlinkSync(SESSION_STORE_PATH);
  }
}