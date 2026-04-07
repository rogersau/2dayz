import * as THREE from "three";

const VIEW_SIZE = 22;

export const createCamera = (canvas: HTMLCanvasElement) => {
  const camera = new THREE.OrthographicCamera(-VIEW_SIZE, VIEW_SIZE, VIEW_SIZE, -VIEW_SIZE, 0.1, 100);
  camera.position.set(18, 28, 18);
  camera.lookAt(0, 0, 0);

  const resize = () => {
    const width = canvas.clientWidth || canvas.width || 960;
    const height = canvas.clientHeight || canvas.height || 540;
    const aspect = width / Math.max(height, 1);

    camera.left = -VIEW_SIZE * aspect;
    camera.right = VIEW_SIZE * aspect;
    camera.top = VIEW_SIZE;
    camera.bottom = -VIEW_SIZE;
    camera.updateProjectionMatrix();
  };

  resize();

  return {
    camera,
    resize,
  };
};
