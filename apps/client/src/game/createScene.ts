import * as THREE from "three";

export const createScene = () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#171914");
  scene.fog = new THREE.Fog("#171914", 18, 84);

  const skyLight = new THREE.HemisphereLight("#c8d7d9", "#38402d", 1.55);
  const sunLight = new THREE.DirectionalLight("#ffe7b0", 1.85);
  sunLight.position.set(16, 26, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 64;
  sunLight.shadow.camera.left = -20;
  sunLight.shadow.camera.right = 20;
  sunLight.shadow.camera.top = 20;
  sunLight.shadow.camera.bottom = -20;

  scene.add(skyLight, sunLight);

  return {
    dispose() {
      scene.remove(skyLight, sunLight);
    },
    scene,
  };
};
