import * as THREE from "three";

const FIELD_OF_VIEW = 60;
const NEAR_PLANE = 0.1;
const FAR_PLANE = 200;

export const createCamera = (canvas: HTMLCanvasElement) => {
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, NEAR_PLANE, FAR_PLANE);
  camera.position.set(0, 12, 16);
  camera.lookAt(0, 4, 0);

  const resize = () => {
    const width = canvas.clientWidth || canvas.width || 960;
    const height = canvas.clientHeight || canvas.height || 540;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };

  resize();

  return {
    camera,
    resize,
  };
};
