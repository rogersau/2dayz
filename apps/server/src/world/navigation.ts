import type { NavigationData, NavigationNode, NodeId } from "@2dayz/shared";

export type NavigationGraph = {
  nodes: Map<NodeId, NavigationNode>;
  neighbors: Map<NodeId, Array<{ nodeId: NodeId; cost: number }>>;
};

export const createNavigationGraph = (navigation: NavigationData): NavigationGraph => {
  const nodes = new Map(navigation.nodes.map((node) => [node.nodeId, node]));
  const neighbors = new Map<NodeId, Array<{ nodeId: NodeId; cost: number }>>();

  for (const node of navigation.nodes) {
    neighbors.set(node.nodeId, []);
  }

  for (const link of navigation.links) {
    neighbors.get(link.from)?.push({ nodeId: link.to, cost: link.cost });
  }

  return {
    nodes,
    neighbors,
  };
};

export const findNextNavigationStep = (
  graph: NavigationGraph,
  startNodeId: NodeId,
  targetNodeId: NodeId,
): NavigationNode | null => {
  if (startNodeId === targetNodeId) {
    return graph.nodes.get(targetNodeId) ?? null;
  }

  const distances = new Map<NodeId, number>([[startNodeId, 0]]);
  const previous = new Map<NodeId, NodeId>();
  const unvisited = new Set<NodeId>(graph.nodes.keys());

  while (unvisited.size > 0) {
    let currentNodeId: NodeId | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const candidate of unvisited) {
      const distance = distances.get(candidate) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) {
        currentDistance = distance;
        currentNodeId = candidate;
      }
    }

    if (currentNodeId === null || currentDistance === Number.POSITIVE_INFINITY) {
      break;
    }

    unvisited.delete(currentNodeId);

    if (currentNodeId === targetNodeId) {
      break;
    }

    for (const neighbor of graph.neighbors.get(currentNodeId) ?? []) {
      if (!unvisited.has(neighbor.nodeId)) {
        continue;
      }

      const nextDistance = currentDistance + neighbor.cost;
      if (nextDistance < (distances.get(neighbor.nodeId) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor.nodeId, nextDistance);
        previous.set(neighbor.nodeId, currentNodeId);
      }
    }
  }

  if (!previous.has(targetNodeId)) {
    return null;
  }

  let stepNodeId = targetNodeId;
  while (previous.get(stepNodeId) !== startNodeId) {
    const priorNodeId = previous.get(stepNodeId);
    if (!priorNodeId) {
      return null;
    }

    stepNodeId = priorNodeId;
  }

  return graph.nodes.get(stepNodeId) ?? null;
};
