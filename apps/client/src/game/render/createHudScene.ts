import * as THREE from "three";

import type { HudState } from "./hudState";

const createLabel = ({ color, fontSize }: { color: string; fontSize: number }) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  let currentText: string | null = null;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create HUD label context.");
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0, 1);
  sprite.renderOrder = 2;

  return {
    dispose() {
      texture.dispose();
      material.dispose();
    },
    setPosition(x: number, y: number) {
      sprite.position.set(x, y, 0);
    },
    setText(text: string) {
      if (text === currentText) {
        return;
      }

      currentText = text;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = color;
      context.font = `600 ${fontSize}px monospace`;
      context.textBaseline = "top";
      context.fillText(text, 0, 0);

      const metrics = context.measureText(text);
      sprite.scale.set(Math.max(metrics.width, 1), fontSize + 16, 1);
      texture.needsUpdate = true;
    },
    sprite,
  };
};

const createModule = ({ accentColor, detailColor, height, title, valueColor, width }: {
  accentColor: string;
  detailColor: string;
  height: number;
  title: string;
  valueColor: string;
  width: number;
}) => {
  const group = new THREE.Group();
  const backplateGeometry = new THREE.PlaneGeometry(width, height);
  const accentGeometry = new THREE.PlaneGeometry(10, height - 12);
  const backplateMaterial = new THREE.MeshBasicMaterial({ color: "#0c120f", depthTest: false, depthWrite: false, opacity: 0.86, transparent: true });
  const accentMaterial = new THREE.MeshBasicMaterial({ color: accentColor, depthTest: false, depthWrite: false, opacity: 0.95, transparent: true });
  const backplate = new THREE.Mesh(backplateGeometry, backplateMaterial);
  const accent = new THREE.Mesh(accentGeometry, accentMaterial);
  const titleLabel = createLabel({ color: "#d7decb", fontSize: 18 });
  const valueLabel = createLabel({ color: valueColor, fontSize: 28 });
  const detailLabel = createLabel({ color: detailColor, fontSize: 16 });

  backplate.renderOrder = 0;
  accent.renderOrder = 1;
  accent.position.set(-width / 2 + 12, 0, 0);
  titleLabel.setPosition(-width / 2 + 26, height / 2 - 14);
  valueLabel.setPosition(-width / 2 + 26, height / 2 - 40);
  detailLabel.setPosition(-width / 2 + 26, -2);
  titleLabel.setText(title);

  group.add(backplate, accent, titleLabel.sprite, valueLabel.sprite, detailLabel.sprite);

  return {
    dispose() {
      backplateGeometry.dispose();
      accentGeometry.dispose();
      backplateMaterial.dispose();
      accentMaterial.dispose();
      titleLabel.dispose();
      valueLabel.dispose();
      detailLabel.dispose();
    },
    group,
    setPosition(x: number, y: number) {
      group.position.set(x, y, 0);
    },
    setText({ detail, value }: { detail: string; value: string }) {
      valueLabel.setText(value);
      detailLabel.setText(detail);
    },
    size: { height, width },
  };
};

export const createHudScene = () => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-480, 480, 270, -270, 0.1, 10);
  camera.position.z = 1;

  const healthModule = createModule({
    accentColor: "#9fcf7d",
    detailColor: "#c8d5bc",
    height: 92,
    title: "HEALTH",
    valueColor: "#edf6dc",
    width: 228,
  });
  const ammoModule = createModule({
    accentColor: "#d8b980",
    detailColor: "#d8cbad",
    height: 92,
    title: "AMMO",
    valueColor: "#fff0c4",
    width: 228,
  });
  const inventoryModule = createModule({
    accentColor: "#b5c777",
    detailColor: "#cdd8b4",
    height: 92,
    title: "INVENTORY",
    valueColor: "#eef5d6",
    width: 248,
  });
  const metadataModule = createModule({
    accentColor: "#7ab0cf",
    detailColor: "#c2d9e7",
    height: 92,
    title: "SESSION",
    valueColor: "#e4f1f8",
    width: 272,
  });

  scene.add(healthModule.group, ammoModule.group, inventoryModule.group, metadataModule.group);

  const resize = (canvas: HTMLCanvasElement) => {
    const width = canvas.clientWidth || canvas.width || 960;
    const height = canvas.clientHeight || canvas.height || 540;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const padding = 24;

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();

    healthModule.setPosition(
      camera.left + padding + healthModule.size.width / 2,
      camera.top - padding - healthModule.size.height / 2,
    );
    ammoModule.setPosition(
      camera.right - padding - ammoModule.size.width / 2,
      camera.top - padding - ammoModule.size.height / 2,
    );
    inventoryModule.setPosition(
      camera.left + padding + inventoryModule.size.width / 2,
      camera.bottom + padding + inventoryModule.size.height / 2,
    );
    metadataModule.setPosition(
      camera.right - padding - metadataModule.size.width / 2,
      camera.bottom + padding + metadataModule.size.height / 2,
    );
  };

  return {
    camera,
    dispose() {
      scene.remove(healthModule.group, ammoModule.group, inventoryModule.group, metadataModule.group);
      healthModule.dispose();
      ammoModule.dispose();
      inventoryModule.dispose();
      metadataModule.dispose();
    },
    resize,
    scene,
    update(state: HudState) {
      healthModule.setText({ detail: state.healthDetail, value: state.healthValue });
      ammoModule.setText({ detail: state.equippedWeaponDetail, value: state.ammoValue });
      inventoryModule.setText({ detail: "Ready slots and field supplies", value: state.inventorySummary });
      metadataModule.setText({ detail: state.roomLabel, value: state.playerLabel });
    },
  };
};
