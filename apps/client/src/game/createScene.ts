import * as THREE from "three";

export const createScene = () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#11120f");
  scene.fog = new THREE.Fog("#11120f", 24, 60);

  const ambientLight = new THREE.AmbientLight("#d6d0bf", 1.3);
  const sunLight = new THREE.DirectionalLight("#fff1c2", 1.5);
  sunLight.position.set(12, 24, 8);

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(40, 0.5, 40),
    new THREE.MeshLambertMaterial({ color: "#34412b" }),
  );
  ground.position.set(0, -0.25, 0);

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.05, 26),
    new THREE.MeshLambertMaterial({ color: "#5a544a" }),
  );
  road.position.set(0, 0.03, 2);

  const shack = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2.6, 4),
    new THREE.MeshLambertMaterial({ color: "#66513c" }),
  );
  shack.position.set(-8, 1.3, -6);

  const silo = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.4, 4, 6),
    new THREE.MeshLambertMaterial({ color: "#726a62" }),
  );
  silo.position.set(7, 2, -10);

  scene.add(ambientLight, sunLight, ground, road, shack, silo);

  return scene;
};
