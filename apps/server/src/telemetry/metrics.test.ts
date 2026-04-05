import { describe, expect, it } from "vitest";

import { createMetricsTracker, normalizeDisconnectReason } from "./metrics";

describe("normalizeDisconnectReason", () => {
  it("maps websocket closes into bounded disconnect buckets", () => {
    expect(normalizeDisconnectReason({ code: 1000, reason: Buffer.from("") })).toBe("client-close");
    expect(normalizeDisconnectReason({ code: 1001, reason: Buffer.from("") })).toBe("server-close");
    expect(normalizeDisconnectReason({ code: 1006, reason: Buffer.from("") })).toBe("abnormal-close");
    expect(normalizeDisconnectReason({ code: 1008, reason: Buffer.from("") })).toBe("policy-violation");
    expect(normalizeDisconnectReason({ code: 1011, reason: Buffer.from("room failure") })).toBe("application-error");
    expect(normalizeDisconnectReason({ code: 4321, reason: Buffer.from("") })).toBe("transport-error");
  });
});

describe("createMetricsTracker", () => {
  it("records bounded disconnect reason keys", () => {
    const tracker = createMetricsTracker({
      getRoomSummaries() {
        return [];
      },
      getRoomCount() {
        return 0;
      },
      assignPlayer() {
        throw new Error("not used");
      },
      disconnectPlayer() {
        return false;
      },
      reclaimPlayer() {
        return null;
      },
      releasePlayer() {
        return false;
      },
      tickAllRooms() {
        // noop
      },
    } as never);

    tracker.recordDisconnect("client-close");
    tracker.recordDisconnect("application-error");

    expect(tracker.snapshot().disconnectReasons).toEqual({
      "application-error": 1,
      "client-close": 1,
    });
  });
});
