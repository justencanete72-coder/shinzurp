import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/addons/utils/SkeletonUtils.js'; // Para makapag-clone ng 3D model

// --- 1. USER DATA & UI ---
let myUsername = "Player";
let myGender = "boy";
let localAudioStream = null;
let playerModelTemplate = null; // Dito natin i-save ang 3D model

document.querySelectorAll('.gender-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    myGender = e.target.dataset.gender;
  });
});

document.getElementById('btn-enter-lobby').addEventListener('click', async () => {
  const nameInput = document.getElementById('username-input').value.trim();
  if (!nameInput) return alert("Please enter a username!");
  myUsername = nameInput;

  try {
    localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert("Microphone denied. You can still play.");
  }

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('lobby').classList.remove('hidden');
});

// --- 2. MULTIPLAYER SETUP ---
let peer = null;
let conn = null;
let audioCall = null;
let remotePlayers = {}; 
let lastSyncTime = 0;

document.getElementById('btn-host').addEventListener('click', () => {
  const roomCode = "SHINZU-" + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('lobby-status').innerText = "Hosting: " + roomCode;
  peer = new Peer(roomCode);
  peer.on('open', () => startGame("Host - " + roomCode));
  peer.on('connection', (connection) => { conn = connection; setupConnection(conn); });
  peer.on('call', (call) => {
    call.answer(localAudioStream);
    call.on('stream', (remoteStream) => { const audio = new Audio(); audio.srcObject = remoteStream; audio.play(); });
  });
});

document.getElementById('btn-join').addEventListener('click', () => {
  const roomCode = document.getElementById('join-code').value.trim().toUpperCase();
  if (!roomCode) return alert("Enter Room Code!");
  document.getElementById('lobby-status').innerText = "Connecting...";
  peer = new Peer(); 
  peer.on('open', () => {
    conn = peer.connect(roomCode);
    setupConnection(conn);
    if (localAudioStream) audioCall = peer.call(roomCode, localAudioStream);
    startGame("Client - " + roomCode);
  });
  peer.on('error', (err) => { alert("Connection failed."); document.getElementById('lobby-status').innerText = "Error: " + err.type; });
});

function setupConnection(connection) {
  connection.on('open', () => console.log("Connected!"));
  connection.on('data', (data) => {
    if (data.type === 'pos') {
      updateRemotePlayer(data.id, data.x, data.y, data.z, data.rotY, data.gender);
    } else if (data.type === 'chat') {
      addChatMessage(data.name, data.text, data.gender);
    }
  });
}

// --- 3. CHAT LOGIC ---
const chatContainer = document.getElementById('chat-container');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

document.getElementById('btn-chat-toggle').addEventListener('click', () => {
  chatContainer.classList.toggle('hidden');
});

document.getElementById('btn-send-chat').addEventListener('click', sendChat);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  addChatMessage(myUsername, text, myGender);
  if (conn && conn.open) conn.send({ type: 'chat', name: myUsername, text: text, gender: myGender });
  chatInput.value = "";
}

function addChatMessage(name, text, gender) {
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.innerHTML = `<strong style="color:${gender === 'boy' ? '#60a5fa' : '#f472b6'}">${name}:</strong> ${text}`;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- 4. SETTINGS UI ---
document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.remove('hidden');
});
document.getElementById('btn-close-settings').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.add('hidden');
});

// --- 5. THREE.JS SETUP ---
const canvas = document.getElementById('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 15, 100);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(20, 30, 20); dirLight.castShadow = true;
scene.add(dirLight);

const colliders = [];
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x556B2F }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const roadH = new THREE.Mesh(new THREE.PlaneGeometry(200, 12), roadMat);
roadH.rotation.x = -Math.PI / 2; roadH.position.y = 0.02; roadH.receiveShadow = true; scene.add(roadH);
const roadV = new THREE.Mesh(new THREE.PlaneGeometry(12, 200), roadMat);
roadV.rotation.x = -Math.PI / 2; roadV.position.y = 0.02; roadV.receiveShadow = true; scene.add(roadV);

const interactables = [];
function createHouse(x, z) {
  const houseGroup = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 8), new THREE.MeshStandardMaterial({ color: 0xf5f5f5 }));
  walls.position.y = 2.5; walls.castShadow = true; walls.receiveShadow = true;
  houseGroup.add(walls);
  colliders.push(new THREE.Box3().setFromObject(walls));
  
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.5, 3, 4), new THREE.MeshStandardMaterial({ color: 0x8b0000 }));
  roof.position.y = 6.5; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  houseGroup.add(roof);
  
  // Pinto
  const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x5c4033 }));
  door.position.set(0, 1.75, 4.05); door.castShadow = true;
  houseGroup.add(door);
  
  // Harang sa Pinto (Para kapag sarado, hindi ka makakapasok)
  const doorCollider = new THREE.Box3().setFromObject(door);

  houseGroup.position.set(x, 0, z);
  if (x < 0) houseGroup.rotation.y = Math.PI / 2;
  if (x > 0) houseGroup.rotation.y = -Math.PI / 2;
  scene.add(houseGroup);
  return { doorMesh: door, doorCol: doorCollider };
}
for(let z = -30; z <= 30; z += 20) {
  interactables.push({ mesh: createHouse(-16, z).doorMesh, type: 'door', dist: 4, isOpen: false });
  interactables.push({ mesh: createHouse(16, z).doorMesh, type: 'door', dist: 4, isOpen: false });
}

// --- 6. PLAYER LOADING (CLONE SYSTEM) ---
let player, mixer, idleAction, runAction;
let isSitting = false;
const loader = new GLTFLoader();

loader.load('https://threejs.org/examples/models/gltf/Soldier.glb', (gltf) => {
  playerModelTemplate = gltf.scene; // I-save para pang-clone sa ibang players

  player = gltf.scene;
  player.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
  player.position.set(0, 0, -5); 
  scene.add(player);

  mixer = new THREE.AnimationMixer(player);
  idleAction = mixer.clipAction(gltf.animations[0]);
  runAction = mixer.clipAction(gltf.animations[1]);
  idleAction.play(); runAction.play(); runAction.weight = 0;
});

// --- 7. REMOTE PLAYERS (3D CLONES) ---
function updateRemotePlayer(id, x, y, z, rotY, gender) {
  if (!remotePlayers[id]) {
    // I-clone ang 3D model para maging totoong character din ang kaibigan mo
    const clone = SkeletonUtils.clone(playerModelTemplate);
    
    // Kulayan base sa gender
    clone.traverse(child => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.color.setHex(gender === 'boy' ? 0x60a5fa : 0xf472b6); // Blue / Pink
        child.castShadow = true;
      }
    });

    clone.position.set(x, y, z);
    scene.add(clone);
    remotePlayers[id] = clone;
  }
  // Smooth movement
  remotePlayers[id].position.lerp(new THREE.Vector3(x, y, z), 0.3);
  remotePlayers[id].rotation.y = rotY;
}

// --- 8. CONTROLS (JOYSTICK, CAMERA, INTERACT) ---
// [Same logic as before, stripped for brevity but fully functional in actual file]
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
let camDist = 10; let initialPinchDistance = 0;
const cameraZone = document.getElementById('camera-zone');

cameraZone.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) { camTouch.active = true; camTouch.x = e.touches[0].clientX; camTouch.y = e.touches[0].clientY; }
  else if (e.touches.length === 2) { camTouch.active = false; initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
});
cameraZone.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && camTouch.active) {
    camTouch.angleY -= (e.touches[0].clientX - camTouch.x) * 0.01;
    camTouch.angleX -= (e.touches[0].clientY - camTouch.y) * 0.01;
    camTouch.angleX = Math.max(-0.3, Math.min(0.8, camTouch.angleX));
    camTouch.x = e.touches[0].clientX; camTouch.y = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    camDist += (initialPinchDistance - dist) * 0.05;
    camDist = Math.max(4, Math.min(20, camDist));
    initialPinchDistance = dist;
  }
});

const interactBtn = document.getElementById('btn-interact');
let nearObj = null;
interactBtn.addEventListener('click', () => {
  if (!nearObj || !player) return;
  if (nearObj.type === 'door') {
    nearObj.isOpen = !nearObj.isOpen;
    nearObj.mesh.rotation.y = nearObj.isOpen ? Math.PI / 2 : 0;
  }
});

// --- 9. GAME LOOP ---
let lastFrame = performance.now(); let frames = 0;
const fpsEl = document.getElementById('fps'); const speed = 7;
const clock = new THREE.Clock();

function startGame(roomName) {
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');
  setTimeout(() => {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('ui').classList.remove('hidden');
    document.getElementById('room-info').innerText = roomName;
  }, 1000);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);

  frames++;
  const time = performance.now();
  if (time >= lastFrame + 1000) { fpsEl.innerText = `${Math.round((frames * 1000) / (time - lastFrame))} FPS`; frames = 0; lastFrame = time; }

  if (player) {
    if (mixer) mixer.update(delta);
    
    // Proximity
    let closestDist = 999; nearObj = null;
    interactables.forEach(obj => {
      const distX = player.position.x - obj.mesh.getWorldPosition(new THREE.Vector3()).x;
      const distZ = player.position.z - obj.mesh.getWorldPosition(new THREE.Vector3()).z;
      const dist = Math.sqrt(distX*distX + distZ*distZ);
      if (dist < obj.dist && dist < closestDist) { closestDist = dist; nearObj = obj; }
    });
    if (nearObj) interactBtn.classList.remove('hidden'); else interactBtn.classList.add('hidden');

    // Movement
    let isMoving = false;
    if (!isSitting && joyData.active && (Math.abs(joyData.x) > 0.1 || Math.abs(joyData.y) > 0.1)) {
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), camTouch.angleY);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), camTouch.angleY);
      const moveDir = new THREE.Vector3().addScaledVector(right, joyData.x).addScaledVector(forward, -joyData.y).normalize();
      const nextPos = player.position.clone().addScaledVector(moveDir, speed * delta);
      
      let isColliding = false;
      colliders.forEach(box => {
        const pBox = new THREE.Box3().setFromCenterAndSize(nextPos, new THREE.Vector3(1, 1, 1));
        if (box.intersectsBox(pBox)) isColliding = true;
      });

      if (!isColliding) {
        player.position.copy(nextPos);
        const targetRot = Math.atan2(moveDir.x, moveDir.z);
        let diff = targetRot - player.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        player.rotation.y += diff * 10 * delta;
        isMoving = true;
      }
    }

    if (runAction && idleAction) {
      runAction.weight += ((isMoving ? 1 : 0) - runAction.weight) * 10 * delta;
      idleAction.weight = 1 - runAction.weight;
    }

    // Camera
    const camHeight = 5 + (camTouch.angleX * 8);
    const camX = player.position.x + Math.sin(camTouch.angleY) * camDist;
    const camZ = player.position.z + Math.cos(camTouch.angleY) * camDist;
    const camY = player.position.y + camHeight;
    camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.2);
    camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);

    // MULTIPLAYER SYNC
    if (time - lastSyncTime > 100 && conn && conn.open) {
      conn.send({
        type: 'pos', id: peer.id, x: player.position.x, y: player.position.y, z: player.position.z, rotY: player.rotation.y, gender: myGender
      });
      lastSyncTime = time;
    }
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();