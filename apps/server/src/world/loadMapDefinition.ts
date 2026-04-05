import { mapDefinitionSchema, type MapDefinition } from "@2dayz/shared";

import { defaultTownMap } from "../content/defaultTownMap";
import { createCollisionIndex, isCirclePositionBlocked } from "./collision";
import { hasLineOfSight } from "./lineOfSight";

const entityRadius = 0.5;

const assertPointWithinBounds = (map: MapDefinition, position: { x: number; y: number }, label: string): void => {
  if (
    position.x < entityRadius ||
    position.y < entityRadius ||
    position.x > map.bounds.width - entityRadius ||
    position.y > map.bounds.height - entityRadius
  ) {
    throw new Error(`${label} exceeds map bounds`);
  }
};

const assertSpatialInvariants = (map: MapDefinition): void => {
  const collision = createCollisionIndex(map.collisionVolumes);

  for (const zone of map.zombieSpawnZones) {
    if (
      zone.center.x < zone.radius ||
      zone.center.y < zone.radius ||
      zone.center.x > map.bounds.width - zone.radius ||
      zone.center.y > map.bounds.height - zone.radius
    ) {
      throw new Error(`zombie spawn zone ${zone.zoneId} exceeds map bounds`);
    }

    if (isCirclePositionBlocked(collision, zone.center, entityRadius)) {
      throw new Error(`zombie spawn zone ${zone.zoneId} is inside blocking collision`);
    }
  }

  for (const respawnPoint of map.respawnPoints) {
    assertPointWithinBounds(map, respawnPoint.position, `respawn point ${respawnPoint.pointId}`);

    if (isCirclePositionBlocked(collision, respawnPoint.position, entityRadius)) {
      throw new Error(`respawn point ${respawnPoint.pointId} is inside blocking collision`);
    }
  }

  for (const lootPoint of map.lootPoints) {
    assertPointWithinBounds(map, lootPoint.position, `loot point ${lootPoint.pointId}`);

    if (isCirclePositionBlocked(collision, lootPoint.position, entityRadius)) {
      throw new Error(`loot point ${lootPoint.pointId} is inside blocking collision`);
    }
  }

  for (const placement of map.interactablePlacements) {
    assertPointWithinBounds(map, placement.position, `interactable placement ${placement.placementId}`);

    if (isCirclePositionBlocked(collision, placement.position, entityRadius)) {
      throw new Error(`interactable placement ${placement.placementId} is inside blocking collision`);
    }
  }

  const nodesById = new Map(map.navigation.nodes.map((node) => [node.nodeId, node]));
  for (const node of map.navigation.nodes) {
    assertPointWithinBounds(map, node.position, `navigation node ${node.nodeId}`);

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
