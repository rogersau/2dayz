import * as THREE from "three";

export const createRenderer = (canvas: HTMLCanvasElement) => {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor("#171a14");

  const resize = () => {
    const width = canvas.clientWidth || canvas.width || 960;
    const height = canvas.clientHeight || canvas.height || 540;
    renderer.setSize(width, height, false);
  };

  resize();

  return {
    renderer,
    resize,
  };
};
