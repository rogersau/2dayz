import { describe, expect, it } from "vitest";

import type { NavigationData } from "@2dayz/shared";

import { createNavigationGraph, findNextNavigationStep } from "./navigation";

const navigationData: NavigationData = {
  nodes: [
    { nodeId: "node_forest", position: { x: 0, y: 0 } },
    { nodeId: "node_road", position: { x: 5, y: 0 } },
    { nodeId: "node_square", position: { x: 10, y: 0 } },
    { nodeId: "node_market", position: { x: 10, y: 5 } },
  ],
  links: [
    { from: "node_forest", to: "node_road", cost: 5 },
    { from: "node_road", to: "node_square", cost: 5 },
    { from: "node_square", to: "node_market", cost: 5 },
    { from: "node_forest", to: "node_market", cost: 30 },
    { from: "node_road", to: "node_forest", cost: 5 },
    { from: "node_square", to: "node_road", cost: 5 },
    { from: "node_market", to: "node_square", cost: 5 },
    { from: "node_market", to: "node_forest", cost: 30 },
  ],
};

describe("findNextNavigationStep", () => {
  it("selects the first step along the cheapest waypoint path", () => {
    const graph = createNavigationGraph(navigationData);

    expect(findNextNavigationStep(graph, "node_forest", "node_market")).toEqual(
      expect.objectContaining({
        nodeId: "node_road",
        position: { x: 5, y: 0 },
      }),
    );
  });

  it("returns the target node when already adjacent", () => {
    const graph = createNavigationGraph(navigationData);

    expect(findNextNavigationStep(graph, "node_square", "node_market")).toEqual(
      expect.objectContaining({
        nodeId: "node_market",
        position: { x: 10, y: 5 },
      }),
    );
  });
});
