import { mapDefinitionSchema, type MapDefinition } from "@2dayz/shared";

import { defaultTownMap } from "../content/defaultTownMap";
import { createCollisionIndex, isCirclePositionBlocked } from "./collision";
import { hasLineOfSight } from "./lineOfSight";

const entityRadius = 0.5;

const assertSpatialInvariants = (map: MapDefinition): void => {
  const collision = createCollisionIndex(map.collisionVolumes);

  for (const respawnPoint of map.respawnPoints) {
    if (isCirclePositionBlocked(collision, respawnPoint.position, entityRadius)) {
      throw new Error(`respawn point ${respawnPoint.pointId} is inside blocking collision`);
    }
  }

  for (const lootPoint of map.lootPoints) {
    if (isCirclePositionBlocked(collision, lootPoint.position, entityRadius)) {
      throw new Error(`loot point ${lootPoint.pointId} is inside blocking collision`);
    }
  }

  for (const placement of map.interactablePlacements) {
    if (isCirclePositionBlocked(collision, placement.position, entityRadius)) {
      throw new Error(`interactable placement ${placement.placementId} is inside blocking collision`);
    }
  }

  const nodesById = new Map(map.navigation.nodes.map((node) => [node.nodeId, node]));
  for (const node of map.navigation.nodes) {
    if (isCirclePositionBlocked(collision, node.position, entityRadius)) {
      throw new Error(`navigation node ${node.nodeId} is inside blocking collision`);
    }
  }

  for (const link of map.navigation.links) {
    const from = nodesById.get(link.from);
    const to = nodesById.get(link.to);

    if (!from || !to) {
      throw new Error(`navigation link ${link.from}->${link.to} references a missing node`);
    }

    if (!hasLineOfSight(collision, from.position, to.position, entityRadius)) {
      throw new Error(`navigation link ${link.from}->${link.to} crosses blocking collision`);
    }
  }
};

export const loadMapDefinition = (definition: MapDefinition = defaultTownMap): MapDefinition => {
  const map = mapDefinitionSchema.parse(definition);
  assertSpatialInvariants(map);
  return map;
};
