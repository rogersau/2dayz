import * as THREE from "three";

export const createScene = () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#11120f");
  scene.fog = new THREE.Fog("#11120f", 24, 60);

  const ambientLight = new THREE.AmbientLight("#d6d0bf", 1.3);
  const sunLight = new THREE.DirectionalLight("#fff1c2", 1.5);
  sunLight.position.set(12, 24, 8);

  scene.add(ambientLight, sunLight);

  return {
    dispose() {
      scene.remove(ambientLight, sunLight);
    },
    scene,
  };
};
