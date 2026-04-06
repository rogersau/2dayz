import * as THREE from "three";

export const createScene = () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#11120f");
  scene.fog = new THREE.Fog("#11120f", 24, 60);
  const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  const createStaticMesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    disposables.push(geometry, material);
    return new THREE.Mesh(geometry, material);
  };

  const ambientLight = new THREE.AmbientLight("#d6d0bf", 1.3);
  const sunLight = new THREE.DirectionalLight("#fff1c2", 1.5);
  sunLight.position.set(12, 24, 8);

  const ground = createStaticMesh(
    new THREE.BoxGeometry(40, 0.5, 40),
    new THREE.MeshLambertMaterial({ color: "#34412b" }),
  );
  ground.position.set(0, -0.25, 0);

  const road = createStaticMesh(
    new THREE.BoxGeometry(4, 0.05, 26),
    new THREE.MeshLambertMaterial({ color: "#5a544a" }),
  );
  road.position.set(0, 0.03, 2);

  const shack = createStaticMesh(
    new THREE.BoxGeometry(4, 2.6, 4),
    new THREE.MeshLambertMaterial({ color: "#66513c" }),
  );
  shack.position.set(-8, 1.3, -6);

  const silo = createStaticMesh(
    new THREE.CylinderGeometry(1.2, 1.4, 4, 6),
    new THREE.MeshLambertMaterial({ color: "#726a62" }),
  );
  silo.position.set(7, 2, -10);

  scene.add(ambientLight, sunLight, ground, road, shack, silo);

  return {
    dispose() {
      scene.remove(ground, road, shack, silo, ambientLight, sunLight);
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
    scene,
  };
};
