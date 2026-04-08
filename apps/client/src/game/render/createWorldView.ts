import type { MapDefinition } from "@2dayz/shared";
import * as THREE from "three";

const BUILDING_HEIGHT = 3;
const ROOF_HEIGHT = 0.3;
const COVER_HEIGHT = 1.4;

export const createWorldView = ({ map, scene }: { map: MapDefinition; scene: THREE.Scene }) => {
  const root = new THREE.Group();
  root.name = "world:static";

  const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  const createStaticMesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    disposables.push(geometry, material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const ground = createStaticMesh(
    new THREE.BoxGeometry(map.bounds.width, 0.5, map.bounds.height),
    new THREE.MeshLambertMaterial({ color: "#34412b" }),
  );
  ground.name = "ground:map-bounds";
  ground.position.set(map.bounds.width / 2, -0.25, map.bounds.height / 2);
  root.add(ground);

  for (const volume of map.collisionVolumes) {
    const building = new THREE.Group();
    building.name = `building:${volume.volumeId}`;

    if (volume.volumeId === "volume_central-truck") {
      const cover = createStaticMesh(
        new THREE.BoxGeometry(volume.size.width, COVER_HEIGHT, volume.size.height),
        new THREE.MeshStandardMaterial({ color: "#4d5a63", metalness: 0.35, roughness: 0.7 }),
      );
      cover.name = `cover:${volume.volumeId}`;
      cover.position.set(volume.position.x, COVER_HEIGHT / 2, volume.position.y);

      const cab = createStaticMesh(
        new THREE.BoxGeometry(volume.size.width * 0.28, BUILDING_HEIGHT - 0.4, volume.size.height * 0.9),
        new THREE.MeshStandardMaterial({ color: "#73818a", metalness: 0.2, roughness: 0.65 }),
      );
      cab.name = `vehicle-cab:${volume.volumeId}`;
      cab.position.set(volume.position.x + volume.size.width * 0.26, (BUILDING_HEIGHT - 0.4) / 2, volume.position.y);

      building.add(cover, cab);
      root.add(building);
      continue;
    }

    const body = createStaticMesh(
      new THREE.BoxGeometry(volume.size.width, BUILDING_HEIGHT, volume.size.height),
      new THREE.MeshStandardMaterial({ color: volume.volumeId === "volume_east-shed" ? "#776a52" : "#66513c", roughness: 0.9 }),
    );
    body.name = `building-body:${volume.volumeId}`;
    body.position.set(volume.position.x, BUILDING_HEIGHT / 2, volume.position.y);

    const roof = createStaticMesh(
      new THREE.BoxGeometry(volume.size.width + 0.4, ROOF_HEIGHT, volume.size.height + 0.4),
      new THREE.MeshStandardMaterial({ color: volume.volumeId === "volume_east-shed" ? "#8b7d68" : "#726a62", roughness: 0.85 }),
    );
    roof.name = `building-roof:${volume.volumeId}`;
    roof.position.set(volume.position.x, BUILDING_HEIGHT + ROOF_HEIGHT / 2, volume.position.y);

    building.add(body, roof);
    root.add(building);
  }

  scene.add(root);

  return {
    dispose() {
      scene.remove(root);
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
};
