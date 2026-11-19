import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. SETUP
const canvas = document.getElementById('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 10, 80);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 2. LIGHTING
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 20; dirLight.shadow.camera.bottom = -20;
dirLight.shadow.camera.left = -20; dirLight.shadow.camera.right = 20;
scene.add(dirLight);

// 3. ENVIRONMENT (House & Objects)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x2d4c1e }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const house = new THREE.Group();
const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 8), new THREE.MeshStandardMaterial({ color: 0xf5f5f5 }));
walls.position.y = 2; walls.castShadow = true; walls.receiveShadow = true;
house.add(walls);

const roof = new THREE.Mesh(new THREE.ConeGeometry(6, 2, 4), new THREE.MeshStandardMaterial({ color: 0x8b0000 }));
roof.position.y = 5; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
house.add(roof);

// DOOR (Pinto)
const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 0.2), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
door.position.set(0, 1.5, 4.05);
door.castShadow = true; door.receiveShadow = true;
house.add(door);

// SOFA (Upuan)
const sofa = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.5), new THREE.MeshStandardMaterial({ color: 0x444444 }));
sofa.position.set(-5, 0.5, -5); // Nasa labas muna para madaling ma-test
sofa.castShadow = true; sofa.receiveShadow = true;
scene.add(sofa);

// BED (Kama)
const bed = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 3), new THREE.MeshStandardMaterial({ color: 0xffffff }));
bed.position.set(5, 0.25, -5); // Nasa labas muna
bed.castShadow = true; bed.receiveShadow = true;
scene.add(bed);

scene.add(house);

// 4. INTERACTABLE OBJECTS LIST
const interactables = [
  { mesh: door, type: 'door', name: 'Door', dist: 2.5, isOpen: false },
  { mesh: sofa, type: 'sit', name: 'Sofa', dist: 2.5 },
  { mesh: bed, type: 'sleep', name: 'Bed', dist: 2.5 }
];

// 5. CHARACTER
let player, mixer, idleAction, runAction;
const clock = new THREE.Clock();
let isSitting = false;
let currentActionObj = null;

const loader = new GLTFLoader();
loader.load('https://threejs.org/examples/models/gltf/Soldier.glb', (gltf) => {
  player = gltf.scene;
  player.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
  player.position.set(0, 0, 0);
  scene.add(player);

  mixer = new THREE.AnimationMixer(player);
  idleAction = mixer.clipAction(gltf.animations[0]);
  runAction = mixer.clipAction(gltf.animations[1]);
  idleAction.play(); runAction.play(); runAction.weight = 0;

  document.getElementById('loading').classList.add('hide');
});

// 6. CONTROLS (Joystick at Camera)
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
let joyData = { x: 0, y: 0, active: false };
let baseRect;

document.getElementById('joystick-zone').addEventListener('touchstart', (e) => {
  e.preventDefault(); baseRect = joystickBase.getBoundingClientRect();
  joyData.active = true; updateJoy(e.touches[0]);
});
window.addEventListener('touchmove', (e) => {
  if (!joyData.active) return; e.preventDefault(); updateJoy(e.touches[0]);
});
window.addEventListener('touchend', () => {
  joyData.active = false; joyData.x = 0; joyData.y = 0;
  joystickStick.style.transform = `translate(-50%, -50%)`;
});

function updateJoy(touch) {
  const centerX = baseRect.left + baseRect.width / 2;
  const centerY = baseRect.top + baseRect.height / 2;
  let dx = touch.clientX - centerX; let dy = touch.clientY - centerY;
  const maxDist = baseRect.width / 2; const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist > maxDist) { dx = (dx/dist) * maxDist; dy = (dy/dist) * maxDist; }
  joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joyData.x = dx / maxDist; joyData.y = dy / maxDist;
}

let camTouch = { active: false, x: 0, y: 0, angleY: 0, angleX: 0.2 };
const cameraZone = document.getElementById('camera-zone');
cameraZone.addEventListener('touchstart', (e) => { camTouch.active = true; camTouch.x = e.touches[0].clientX; camTouch.y = e.touches[0].clientY; });
cameraZone.addEventListener('touchmove', (e) => {
  if (!camTouch.active) return;
  camTouch.angleY -= (e.touches[0].clientX - camTouch.x) * 0.01;
  camTouch.angleX -= (e.touches[0].clientY - camTouch.y) * 0.01;
  camTouch.angleX = Math.max(-0.5, Math.min(1, camTouch.angleX));
  camTouch.x = e.touches[0].clientX; camTouch.y = e.touches[0].clientY;
});
cameraZone.addEventListener('touchend', () => camTouch.active = false);

// 7. INTERACTION LOGIC
const interactBtn = document.getElementById('btn-interact');
let nearObj = null;

interactBtn.addEventListener('click', () => {
  if (!nearObj || !player) return;

  if (nearObj.type === 'door') {
    // I-toggle ang pinto (bukas/sara)
    nearObj.isOpen = !nearObj.isOpen;
    const targetRot = nearObj.isOpen ? Math.PI / 2 : 0;
    // Simple smooth rotation para sa pinto
    const animateDoor = setInterval(() => {
      const diff = targetRot - nearObj.mesh.rotation.y;
      if (Math.abs(diff) < 0.05) {
        nearObj.mesh.rotation.y = targetRot;
        clearInterval(animateDoor);
      } else {
        nearObj.mesh.rotation.y += diff * 0.2;
      }
    }, 16);
  } 
  else if (nearObj.type === 'sit') {
    // Umupo sa Sofa
    isSitting = true;
    currentActionObj = nearObj;
    player.position.copy(nearObj.mesh.position);
    player.position.y += 1.2; // I-angat para magmukhang nakaupo
    player.position.z += 0.5;
    interactBtn.innerText = "STAND UP";
  } 
  else if (nearObj.type === 'sleep') {
    // Humiga sa Bed
    isSitting = true;
    currentActionObj = nearObj;
    player.position.copy(nearObj.mesh.position);
    player.position.y += 0.8;
    player.rotation.x = -Math.PI / 2; // Ipatagilid ang character
    interactBtn.innerText = "WAKE UP";
  }

  // Kung nakaupo/nakahiga at pinindot ulit, tumayo
  if (isSitting && currentActionObj === nearObj && nearObj.type !== 'door') {
    isSitting = false;
    player.rotation.x = 0;
    interactBtn.innerText = "INTERACT";
  }
});

// 8. GAME LOOP
let lastFrame = performance.now(); let frames = 0;
const fpsEl = document.getElementById('fps'); const speed = 6;

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);

  // FPS
  frames++;
  const time = performance.now();
  if (time >= lastFrame + 1000) { fpsEl.innerText = `${Math.round((frames * 1000) / (time - lastFrame))} FPS`; frames = 0; lastFrame = time; }

  if (player) {
    if (mixer) mixer.update(delta);
    
    // Interaction Proximity Check (Kung malapit ba sa isang gamit)
    if (!isSitting) {
      let closestDist = 999;
      nearObj = null;
      
      interactables.forEach(obj => {
        const dist = player.position.distanceTo(obj.mesh.position);
        if (dist < obj.dist && dist < closestDist) {
          closestDist = dist;
          nearObj = obj;
        }
      });

      if (nearObj) {
        interactBtn.classList.remove('hidden');
      } else {
        interactBtn.classList.add('hidden');
      }
    }

    // Movement (Pwede lang gumalaw kung hindi nakaupo/nakahiga)
    let isMoving = false;
    if (!isSitting && joyData.active && (Math.abs(joyData.x) > 0.1 || Math.abs(joyData.y) > 0.1)) {
      const moveX = joyData.x * Math.cos(camTouch.angleY) - joyData.y * Math.sin(camTouch.angleY);
      const moveZ = joyData.x * Math.sin(camTouch.angleY) + joyData.y * Math.cos(camTouch.angleY);
      
      player.position.x += moveX * speed * delta;
      player.position.z += moveZ * speed * delta;

      const targetRot = Math.atan2(moveX, moveZ);
      let diff = targetRot - player.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.rotation.y += diff * 10 * delta;
      isMoving = true;
    }

    // Animation blending
    if (runAction && idleAction) {
      runAction.weight += ((isMoving ? 1 : 0) - runAction.weight) * 10 * delta;
      idleAction.weight = 1 - runAction.weight;
    }

    // Camera Follow
    const camDist = 8; const camHeight = 4 + (camTouch.angleX * 5);
    const camX = player.position.x + Math.sin(camTouch.angleY) * camDist;
    const camZ = player.position.z + Math.cos(camTouch.angleY) * camDist;
    const camY = player.position.y + camHeight;

    camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.2);
    camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);
  }
  renderer.render(scene, camera);
}

// 9. SETTINGS & RESIZE
document.getElementById('btn-settings').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('hidden'));
document.getElementById('btn-close-settings').addEventListener('click', () => document.getElementById('settings-modal').classList.add('hidden'));

document.querySelectorAll('input[name="quality"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'low') renderer.setPixelRatio(1);
    else if (e.target.value === 'medium') renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    else renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
});
document.getElementById('toggle-shadows').addEventListener('change', (e) => {
  renderer.shadowMap.enabled = e.target.checked;
  scene.traverse(child => { if (child.isMesh) child.material.needsUpdate = true; });
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();