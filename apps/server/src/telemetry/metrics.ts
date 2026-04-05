import { SERVER_TICK_RATE } from "@2dayz/shared";

import type { RoomManager } from "../rooms/roomManager";

export type MetricsSnapshot = {
  rooms: number;
  players: number;
  playersByRoom: Array<ReturnType<RoomManager["getRoomSummaries"]>[number]>;
  tick: {
    tickRateHz: number;
    targetTickIntervalMs: number;
    sampleCount: number;
    lastDurationMs: number | null;
    averageDurationMs: number | null;
    maxDurationMs: number | null;
  };
  disconnectReasons: Record<string, number>;
};

export const collectMetrics = (roomManager: RoomManager): MetricsSnapshot => {
  const roomSummaries = roomManager.getRoomSummaries();

  return {
    rooms: roomSummaries.length,
    players: roomSummaries.reduce((total, room) => total + room.playerCount, 0),
    playersByRoom: roomSummaries,
    tick: {
      tickRateHz: SERVER_TICK_RATE,
      targetTickIntervalMs: 1000 / SERVER_TICK_RATE,
      sampleCount: 0,
      lastDurationMs: null,
      averageDurationMs: null,
      maxDurationMs: null,
    },
    disconnectReasons: {},
  };
};

type MetricsTrackerOptions = {
  tickRateHz?: number;
};

export const createMetricsTracker = (roomManager: RoomManager, { tickRateHz = SERVER_TICK_RATE }: MetricsTrackerOptions = {}) => {
  const disconnectReasonCounts = new Map<string, number>();
  let tickSamples = 0;
  let totalTickDurationMs = 0;
  let lastTickDurationMs: number | null = null;
  let maxTickDurationMs: number | null = null;

  const round = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

  return {
    recordDisconnect(reason: string) {
      disconnectReasonCounts.set(reason, (disconnectReasonCounts.get(reason) ?? 0) + 1);
    },
    recordTickDuration(durationMs: number) {
      tickSamples += 1;
      totalTickDurationMs += durationMs;
      lastTickDurationMs = round(durationMs);
      maxTickDurationMs = maxTickDurationMs === null ? lastTickDurationMs : Math.max(maxTickDurationMs, lastTickDurationMs);
    },
    snapshot(): MetricsSnapshot {
      const roomSummaries = roomManager.getRoomSummaries();

      return {
        rooms: roomSummaries.length,
        players: roomSummaries.reduce((total, room) => total + room.playerCount, 0),
        playersByRoom: roomSummaries,
        tick: {
          tickRateHz,
          targetTickIntervalMs: round(1000 / tickRateHz),
          sampleCount: tickSamples,
          lastDurationMs: lastTickDurationMs,
          averageDurationMs: tickSamples === 0 ? null : round(totalTickDurationMs / tickSamples),
          maxDurationMs: maxTickDurationMs,
        },
        disconnectReasons: Object.fromEntries([...disconnectReasonCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
      };
    },
  };
};
