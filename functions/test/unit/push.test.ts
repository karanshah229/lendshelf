import { describe, expect, it, vi } from "vitest";
import {
  buildExpoMessages,
  chunk,
  deadTokensFromTickets,
  MAX_PUSH_TOKENS,
  withPushToken,
  createPushSender,
  EXPO_PUSH_URL,
  expoTransport,
  isExpoPushToken,
  ticketErrorCounts,
  type ExpoPushMessage,
} from "../../src/lib/push.js";
import { msg } from "../../src/lib/messages.js";

const T1 = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";
const T2 = "ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbb]";

describe("push message building", () => {
  it("recognises Expo push tokens", () => {
    expect(isExpoPushToken(T1)).toBe(true);
    expect(isExpoPushToken(T2)).toBe(true);
    expect(isExpoPushToken("fcm-token")).toBe(false);
    expect(isExpoPushToken(42)).toBe(false);
  });

  it("builds one message per valid, distinct token", () => {
    const m = buildExpoMessages([T1, T1, "junk", T2], { title: "Hi", body: "There", data: { type: "x" } });
    expect(m).toEqual([
      { to: T1, title: "Hi", body: "There", data: { type: "x" }, sound: "default" },
      { to: T2, title: "Hi", body: "There", data: { type: "x" }, sound: "default" },
    ]);
  });

  it("chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("createPushSender", () => {
  it("looks up tokens and sends through the transport", async () => {
    const transport = vi.fn(async (_m: ExpoPushMessage[]) => undefined);
    const getTokens = vi.fn(async () => [T1, T2]);
    const send = createPushSender({ getTokens, transport, emulator: false });
    const r = await send(["u1", "u2", "u1"], msg.loanRequested("Ravi", "Dune", "L1"));
    expect(getTokens).toHaveBeenCalledWith(["u1", "u2"]);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0]?.[0]).toHaveLength(2);
    expect(transport.mock.calls[0]?.[0][0]).toMatchObject({
      to: T1,
      title: "Borrow request",
      body: "Ravi would like to borrow Dune.",
      data: { type: "loanRequested", loanId: "L1" },
    });
    expect(r).toEqual({ uids: ["u1", "u2"], tokenCount: 2, outcome: "sent" });
  });

  it("is a no-op without tokens or uids", async () => {
    const transport = vi.fn(async () => undefined);
    const send = createPushSender({ getTokens: async () => [], transport, emulator: false });
    expect((await send(["u1"], { title: "a", body: "b" })).outcome).toBe("skipped");
    expect((await send([], { title: "a", body: "b" })).outcome).toBe("skipped");
    expect(transport).not.toHaveBeenCalled();
  });

  it("records instead of sending in the emulator", async () => {
    const transport = vi.fn(async () => undefined);
    const recorder = vi.fn(async () => undefined);
    const send = createPushSender({ getTokens: async () => [T1], transport, emulator: true, recorder });
    const r = await send(["u1"], { title: "a", body: "b" });
    expect(r.outcome).toBe("recorded");
    expect(transport).not.toHaveBeenCalled();
    expect(recorder).toHaveBeenCalledWith({ uids: ["u1"], message: { title: "a", body: "b" }, tokenCount: 1 });
  });

  it("never throws when token lookup or recording fails", async () => {
    const send = createPushSender({
      getTokens: async () => {
        throw new Error("boom");
      },
      transport: async () => undefined,
      emulator: true,
      recorder: async () => {
        throw new Error("boom");
      },
    });
    await expect(send(["u1"], { title: "a", body: "b" })).resolves.toMatchObject({ outcome: "recorded" });
  });
});

describe("expoTransport", () => {
  it("POSTs JSON batches of 100 to the Expo API", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => "{}" }));
    const messages = Array.from({ length: 150 }, (_, i) => ({
      to: `ExponentPushToken[${i}]`,
      title: "t",
      body: "b",
      data: {},
      sound: "default" as const,
    }));
    await expoTransport(fetchImpl)(messages);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe(EXPO_PUSH_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toHaveLength(100);
  });

  it("swallows HTTP and network errors after retrying them", async () => {
    const sleep = vi.fn(async (_ms: number) => undefined);
    const one: ExpoPushMessage[] = [{ to: T1, title: "", body: "", data: {}, sound: "default" }];
    const failing = vi.fn(async () => ({ ok: false, status: 500, text: async () => "err" }));
    await expect(expoTransport(failing, { sleep })(one)).resolves.toEqual([]);
    expect(failing).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1500]);
    const throwing = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(expoTransport(throwing, { sleep })(one)).resolves.toEqual([]);
    expect(throwing).toHaveBeenCalledTimes(3);
  });

  it("retries 429 until it succeeds, but not other 4xx", async () => {
    const sleep = async () => undefined;
    const one: ExpoPushMessage[] = [{ to: T1, title: "", body: "", data: {}, sound: "default" }];
    const responses = [
      { ok: false, status: 429, text: async () => "slow down" },
      { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }) },
    ];
    const flaky = vi.fn(async () => responses.shift()!);
    await expect(expoTransport(flaky, { sleep })(one)).resolves.toEqual([T1]);
    expect(flaky).toHaveBeenCalledTimes(2);
    const badRequest = vi.fn(async () => ({ ok: false, status: 400, text: async () => "bad" }));
    await expoTransport(badRequest, { sleep })(one);
    expect(badRequest).toHaveBeenCalledTimes(1);
  });

  it("sends the Expo access token only when one is set", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => "{}" }));
    const one: ExpoPushMessage[] = [{ to: T1, title: "", body: "", data: {}, sound: "default" }];
    await expoTransport(fetchImpl, { accessToken: "secret-token" })(one);
    await expoTransport(fetchImpl)(one);
    const headers = (fetchImpl.mock.calls as unknown as [string, { headers: Record<string, string> }][]).map((c) => c[1].headers);
    expect(headers[0]?.Authorization).toBe("Bearer secret-token");
    expect(headers[1]?.Authorization).toBeUndefined();
  });

  it("counts ticket errors other than DeviceNotRegistered", () => {
    expect(
      ticketErrorCounts({
        data: [
          { status: "ok", id: "a" },
          { status: "error", details: { error: "InvalidCredentials" } },
          { status: "error", details: { error: "InvalidCredentials" } },
          { status: "error", details: { error: "DeviceNotRegistered" } },
          { status: "error", message: "no details" },
        ],
      }),
    ).toEqual({ InvalidCredentials: 2, unknown: 1 });
    expect(ticketErrorCounts(null)).toEqual({});
  });
});

describe("push texts", () => {
  it("include the title and route data", () => {
    const due = new Date("2026-12-12T00:00:00Z");
    expect(msg.requestAccepted("Asha", "Dune", "L1", due)).toEqual({
      title: "Request accepted",
      body: "Asha is lending you Dune. Due back 12 Dec.",
      data: { type: "requestAccepted", loanId: "L1" },
    });
    expect(msg.wishlistAdded("Ravi", "Sapiens", "I1", "ol_OL1W").data).toEqual({
      type: "wishlistAdded",
      itemId: "I1",
      workId: "ol_OL1W",
    });
    expect(msg.overdueOwner("Kabir", "Dune", "L2", due).body).toContain("Kabir still has Dune");
  });
});

describe("device tokens", () => {
  it("withPushToken moves the token to the end and keeps the 20 newest", () => {
    expect(withPushToken([T1, T2], T1)).toEqual([T2, T1]);
    expect(withPushToken([], T1)).toEqual([T1]);
    const many = Array.from({ length: MAX_PUSH_TOKENS }, (_, i) => `ExponentPushToken[t${i}]`);
    const next = withPushToken(many, T1);
    expect(next).toHaveLength(MAX_PUSH_TOKENS);
    expect(next[0]).toBe("ExponentPushToken[t1]"); // oldest (t0) dropped
    expect(next[MAX_PUSH_TOKENS - 1]).toBe(T1);
    expect(withPushToken([42, null, T2], T1)).toEqual([T2, T1]);
  });

  it("deadTokensFromTickets picks DeviceNotRegistered tickets by position", () => {
    const messages = buildExpoMessages([T1, T2], { title: "t", body: "b" });
    const body = {
      data: [
        { status: "ok", id: "abc" },
        { status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } },
      ],
    };
    expect(deadTokensFromTickets(messages, body)).toEqual([T2]);
    expect(deadTokensFromTickets(messages, { data: [{ status: "error", details: { error: "MessageTooBig" } }] })).toEqual([]);
    expect(deadTokensFromTickets(messages, { errors: [] })).toEqual([]);
    expect(deadTokensFromTickets(messages, null)).toEqual([]);
  });

  it("expoTransport returns dead tokens and the sender removes them", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }, { status: "ok" }] }),
    }));
    const removeTokens = vi.fn(async (_t: string[]) => undefined);
    const send = createPushSender({
      getTokens: async () => [T1, T2],
      transport: expoTransport(fetchImpl),
      emulator: false,
      removeTokens,
    });
    const r = await send(["u1"], { title: "a", body: "b" });
    expect(r.outcome).toBe("sent");
    expect(removeTokens).toHaveBeenCalledWith([T1]);
  });

  it("never throws when the transport or token removal fails", async () => {
    const send = createPushSender({
      getTokens: async () => [T1],
      transport: async () => {
        throw new Error("boom");
      },
      emulator: false,
      removeTokens: async () => {
        throw new Error("boom");
      },
    });
    await expect(send(["u1"], { title: "a", body: "b" })).resolves.toMatchObject({ outcome: "sent" });
    const send2 = createPushSender({
      getTokens: async () => [T1],
      transport: async () => [T1],
      emulator: false,
      removeTokens: async () => {
        throw new Error("boom");
      },
    });
    await expect(send2(["u1"], { title: "a", body: "b" })).resolves.toMatchObject({ outcome: "sent" });
  });
});
