import type { MapDefinition } from "./maps";

export const defaultTownMap: MapDefinition = {
  mapId: "map_default-town",
  name: "Default Town And Outskirts",
  bounds: {
    width: 80,
    height: 60,
  },
  collisionVolumes: [
    {
      volumeId: "volume_market",
      kind: "box",
      position: { x: 20, y: 20 },
      size: { width: 8, height: 6 },
    },
    {
      volumeId: "volume_police-station",
      kind: "box",
      position: { x: 33, y: 18 },
      size: { width: 6, height: 8 },
    },
    {
      volumeId: "volume_barn",
      kind: "box",
      position: { x: 58, y: 34 },
      size: { width: 10, height: 7 },
    },
  ],
  zombieSpawnZones: [
    {
      zoneId: "zone_town-center",
      center: { x: 26, y: 20 },
      radius: 12,
      maxAlive: 5,
      archetypeIds: ["zombie_shambler", "zombie_runner"],
    },
    {
      zoneId: "zone_woodline",
      center: { x: 52, y: 40 },
      radius: 10,
      maxAlive: 3,
      archetypeIds: ["zombie_shambler"],
    },
  ],
  lootPoints: [
    {
      pointId: "point_loot-market-shelves",
      position: { x: 15, y: 20 },
      tableId: "loot_residential",
    },
    {
      pointId: "point_loot-police-locker",
      position: { x: 29, y: 19 },
      tableId: "loot_police",
    },
    {
      pointId: "point_loot-barn-loft",
      position: { x: 52, y: 33 },
      tableId: "loot_residential",
    },
  ],
  respawnPoints: [
    {
      pointId: "point_respawn-main-road",
      position: { x: 7, y: 14 },
    },
    {
      pointId: "point_respawn-tree-line",
      position: { x: 63, y: 47 },
    },
    {
      pointId: "point_respawn-farm-track",
      position: { x: 49, y: 12 },
    },
    {
      pointId: "point_respawn-market-lane",
      position: { x: 12, y: 27 },
    },
    {
      pointId: "point_respawn-north-trees",
      position: { x: 18, y: 48 },
    },
    {
      pointId: "point_respawn-police-road",
      position: { x: 29, y: 9 },
    },
    {
      pointId: "point_respawn-south-road",
      position: { x: 41, y: 29 },
    },
    {
      pointId: "point_respawn-farm-yard",
      position: { x: 52, y: 26 },
    },
    {
      pointId: "point_respawn-west-ditch",
      position: { x: 6, y: 36 },
    },
    {
      pointId: "point_respawn-corner-house",
      position: { x: 24, y: 52 },
    },
    {
      pointId: "point_respawn-east-track",
      position: { x: 68, y: 22 },
    },
    {
      pointId: "point_respawn-south-field",
      position: { x: 60, y: 50 },
    },
  ],
  interactablePlacements: [
    {
      placementId: "placement_market-crate",
      kind: "crate",
      position: { x: 15, y: 24 },
      interactionRadius: 1.5,
      prompt: "Search crate",
    },
    {
      placementId: "placement_police-door",
      kind: "door",
      position: { x: 29, y: 18 },
      interactionRadius: 1.25,
      prompt: "Open side door",
    },
  ],
  navigation: {
    nodes: [
      { nodeId: "node_forest", position: { x: 8, y: 42 } },
      { nodeId: "node_main-road", position: { x: 12, y: 20 } },
      { nodeId: "node_square", position: { x: 15, y: 16 } },
      { nodeId: "node_market", position: { x: 15, y: 24 } },
      { nodeId: "node_police", position: { x: 29, y: 13 } },
      { nodeId: "node_crossroads", position: { x: 40, y: 13 } },
      { nodeId: "node_south-road", position: { x: 40, y: 29 } },
      { nodeId: "node_farm-gate", position: { x: 52, y: 29 } },
      { nodeId: "node_farm", position: { x: 52, y: 34 } },
    ],
    links: [
      { from: "node_forest", to: "node_main-road", cost: 22 },
      { from: "node_main-road", to: "node_forest", cost: 22 },
      { from: "node_main-road", to: "node_square", cost: 5 },
      { from: "node_square", to: "node_main-road", cost: 5 },
      { from: "node_square", to: "node_market", cost: 8 },
      { from: "node_market", to: "node_square", cost: 8 },
      { from: "node_square", to: "node_police", cost: 14 },
      { from: "node_police", to: "node_square", cost: 14 },
      { from: "node_police", to: "node_crossroads", cost: 11 },
      { from: "node_crossroads", to: "node_police", cost: 11 },
      { from: "node_crossroads", to: "node_south-road", cost: 16 },
      { from: "node_south-road", to: "node_crossroads", cost: 16 },
      { from: "node_south-road", to: "node_farm-gate", cost: 12 },
      { from: "node_farm-gate", to: "node_south-road", cost: 12 },
      { from: "node_farm-gate", to: "node_farm", cost: 5 },
      { from: "node_farm", to: "node_farm-gate", cost: 5 },
    ],
  },
};
