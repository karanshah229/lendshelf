/**
 * Expo push sending. `createPushSender` wires token lookup, transport and the
 * emulator recorder together so each piece can be replaced in tests.
 */
import { logger } from "firebase-functions";

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export const EXPO_BATCH_SIZE = 100;
/** Most devices kept per user; registering one more drops the oldest. */
export const MAX_PUSH_TOKENS = 20;

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: "default";
}

export interface PushResult {
  uids: string[];
  tokenCount: number;
  /** "sent" = posted to Expo; "recorded" = emulator test hook; "skipped" = nothing to do. */
  outcome: "sent" | "recorded" | "skipped";
}

/** Send `message` to every device of every uid. Never throws. */
export type PushSender = (uids: string[], message: PushMessage) => Promise<PushResult>;
export type TokenLookup = (uids: string[]) => Promise<string[]>;
/** Sends messages; resolves with the tokens Expo reported as no longer registered. */
export type PushTransport = (messages: ExpoPushMessage[]) => Promise<string[] | void>;
/** Removes dead tokens from whichever users hold them. */
export type TokenRemover = (tokens: string[]) => Promise<void>;
export type PushRecorder = (record: { uids: string[]; message: PushMessage; tokenCount: number }) => Promise<void>;

export function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

/** `tokens` with `token` moved/added to the end (newest), keeping at most MAX_PUSH_TOKENS. */
export function withPushToken(tokens: readonly unknown[], token: string): string[] {
  const kept = tokens.filter((t): t is string => typeof t === "string" && t !== token);
  return [...kept, token].slice(-MAX_PUSH_TOKENS);
}

/**
 * Tokens whose push ticket says `DeviceNotRegistered` (the app was uninstalled
 * or the token rotated). Tickets come back in the same order as the messages.
 */
export function deadTokensFromTickets(messages: readonly ExpoPushMessage[], body: unknown): string[] {
  const data = typeof body === "object" && body !== null ? (body as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) return [];
  const dead: string[] = [];
  data.forEach((ticket, i) => {
    const t = ticket as { status?: unknown; details?: { error?: unknown } } | null;
    const m = messages[i];
    if (t?.status === "error" && t.details?.error === "DeviceNotRegistered" && m) dead.push(m.to);
  });
  return dead;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** One Expo message per valid, distinct token. */
export function buildExpoMessages(tokens: readonly string[], message: PushMessage): ExpoPushMessage[] {
  const unique = [...new Set(tokens.filter(isExpoPushToken))];
  return unique.map((to) => ({
    to,
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    sound: "default" as const,
  }));
}

type FetchForPush = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/**
 * Transport that POSTs to the Expo push API in batches of 100. Logs failures.
 * Returns tokens whose tickets say DeviceNotRegistered. (Receipts, fetched
 * later from Expo, can report more; they aren't read.)
 */
export function expoTransport(fetchImpl: FetchForPush): PushTransport {
  return async (messages) => {
    const dead: string[] = [];
    for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
      try {
        const res = await fetchImpl(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(batch),
        });
        const text = await res.text();
        if (!res.ok) {
          logger.warn("Expo push failed", { status: res.status, body: text });
          continue;
        }
        try {
          dead.push(...deadTokensFromTickets(batch, JSON.parse(text)));
        } catch {
          /* unreadable tickets: nothing to clean up */
        }
      } catch (err) {
        logger.warn("Expo push request error", { error: String(err) });
      }
    }
    return dead;
  };
}

export interface PushSenderOptions {
  getTokens: TokenLookup;
  transport: PushTransport;
  /** When true (functions emulator), record instead of sending. */
  emulator: boolean;
  recorder?: PushRecorder;
  /** Called with tokens Expo says are no longer registered. */
  removeTokens?: TokenRemover;
}

export function createPushSender(opts: PushSenderOptions): PushSender {
  return async (uidsIn, message) => {
    const uids = [...new Set(uidsIn.filter((u) => typeof u === "string" && u !== ""))];
    if (uids.length === 0) return { uids, tokenCount: 0, outcome: "skipped" };
    let tokens: string[] = [];
    try {
      tokens = await opts.getTokens(uids);
    } catch (err) {
      logger.warn("Push token lookup failed", { error: String(err) });
    }
    const messages = buildExpoMessages(tokens, message);
    if (opts.emulator) {
      logger.info("[push:emulator]", { uids, title: message.title, body: message.body, tokens: messages.length });
      if (opts.recorder) {
        try {
          await opts.recorder({ uids, message, tokenCount: messages.length });
        } catch (err) {
          logger.warn("Push recorder failed", { error: String(err) });
        }
      }
      return { uids, tokenCount: messages.length, outcome: "recorded" };
    }
    if (messages.length === 0) {
      logger.info("Push skipped: no tokens", { uids, title: message.title });
      return { uids, tokenCount: 0, outcome: "skipped" };
    }
    let dead: string[] | void = [];
    try {
      dead = await opts.transport(messages);
    } catch (err) {
      logger.warn("Push transport failed", { error: String(err) });
    }
    if (dead && dead.length > 0 && opts.removeTokens) {
      try {
        await opts.removeTokens([...new Set(dead)]);
      } catch (err) {
        logger.warn("Removing dead push tokens failed", { error: String(err) });
      }
    }
    return { uids, tokenCount: messages.length, outcome: "sent" };
  };
}
