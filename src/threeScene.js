import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Global variables for the Three.js scene
let scene, camera, renderer, controls;
let shelf, shelfBox, shelfY, shelfZ;
let albumMeshes = [], numAlbums = 0;
let toneArm, toneArmRestRotation, toneArmPlayRotation;
let toneArmTarget, toneArmAnimating = false;
let albumMesh = null;
let laptop = null;
let record = null;
let isRecordSpinning = false;
let model = null; // U-Turn record player model
let canvasParent = null;

// Tooltip system variables
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let albumTooltip = null;
let laptopTooltip = null;
let recordPlayerTooltip = null;

// State for tooltips
let currentAlbumName = "Album";
let nowPlayingInfo = null; // Will store current playing info
let albumCoverTexture = null;

// Pending album cover and name (in case mesh isn't ready yet)
let pendingAlbumCoverUrl = null;
let pendingAlbumName = null;

export async function setAlbumCover(url, albumName = "Album") {
    console.log('setAlbumCover called with URL:', url, 'Album name:', albumName);
    console.log('albumMesh exists:', !!albumMesh);
    
    // Store the album name for tooltip
    currentAlbumName = albumName;
    
    if (!albumMesh) {
        console.log('albumMesh not ready, storing pending URL:', url);
        pendingAlbumCoverUrl = url;
        pendingAlbumName = albumName;
        return;
    }
    const textureLoader = new THREE.TextureLoader();
    try {
        console.log('Loading texture from:', url);
        const texture = await textureLoader.loadAsync(url);
        texture.encoding = THREE.sRGBEncoding;
        console.log('Texture loaded successfully, applying to all 6 faces');
        for (let i = 0; i < 6; i++) {
            albumMesh.material[i].map = texture;
            albumMesh.material[i].needsUpdate = true;
        }
        albumCoverTexture = texture;
        console.log('Album cover applied successfully');
    } catch (e) {
        console.warn('Failed to load album cover texture:', url, e);
    }
}

export function initThreeScene(parentElement) {
    if (renderer) return; // Prevent double init
    canvasParent = parentElement;
    const width = window.innerWidth, height = window.innerHeight;
    camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
    camera.position.z = 1.5;
    camera.position.y = .5;
    camera.rotateX(-.4);
    scene = new THREE.Scene();
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 2);
    scene.add(directionalLight);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setSize(width, height);
    renderer.setClearColor(0xff0000);
    parentElement.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    window.addEventListener('resize', onWindowResize);
    
    // Initialize tooltips
    createTooltips();
    
    // Add mouse event listeners
    renderer.domElement.addEventListener('mousemove', onMouseMove, false);
    
    loadModels();
    animate();
}

function onWindowResize() {
    if (!renderer || !camera) return;
    const width = window.innerWidth, height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

export function setShelfAlbumCount(count) {
    numAlbums = count;
    // After models are loaded, this will be used in loadModels
    // If shelf is already present, reload models
    if (scene && shelf) {
        // Remove all album meshes
        albumMeshes.forEach(mesh => scene.remove(mesh));
        albumMeshes = [];
        // Re-add albums
        addAlbumsToShelf();
    }
}

export function setToneArmPlaying(isPlaying) {
    if (!toneArm) return;
    toneArmTarget = isPlaying ? toneArmPlayRotation : toneArmRestRotation;
    toneArmAnimating = true;
    isRecordSpinning = isPlaying;
}

async function loadModels() {
    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    let table;
    // --- Load U-Turn Model ---
    const uturnGltf = await loader.loadAsync('uturn.glb');
    model = uturnGltf.scene;
    model.scale.set(0.1, 0.1, 0.1);
    model.rotateY(Math.PI * -0.5);
    // --- Create and place vinyl record ---
    const originalCylinder = model.getObjectByName("Cylinder");
    if (originalCylinder) {
        const vinylTexture = await textureLoader.loadAsync('vinyl.png');
        const localBox = new THREE.Box3().setFromObject(originalCylinder);
        const localSize = new THREE.Vector3();
        localBox.getSize(localSize);
        const recordRadius = localSize.x / 2;
        const recordHeight = localSize.y * 1.1;
        const recordGeometry = new THREE.CylinderGeometry(recordRadius, recordRadius, recordHeight, 32);
        const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x010101 });
        const vinylMaterial = new THREE.MeshStandardMaterial({ map: vinylTexture });
        record = new THREE.Mesh(recordGeometry, [blackMaterial, vinylMaterial, blackMaterial]);
        record.position.copy(originalCylinder.position);
        record.position.y += localSize.y;
        originalCylinder.parent.add(record);
    }
    // --- Load Table Model ---
    const tableGltf = await loader.loadAsync('table.gltf');
    table = tableGltf.scene;
    table.scale.set(2, 2, 2);
    table.rotation.set(0, 0, 0);
    table.position.set(-1.5, -2, -2);
    // --- Apply Wood Texture to Table ---
    const woodTexture = await textureLoader.loadAsync('wood.jpg');
    woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(2, 2);
    table.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material.map = woodTexture;
            child.material.needsUpdate = true;
        }
    });
    // --- Position U-Turn on Table ---
    const tableBox = new THREE.Box3().setFromObject(table);
    const modelBox = new THREE.Box3().setFromObject(model);
    const tableTop = tableBox.max.y;
    const uturnBottom = modelBox.min.y;
    model.position.set(0.8, tableTop - uturnBottom, -1);
    scene.add(table);
    scene.add(model);
    // --- Load Shelf Model ---
    const shelfGltf = await loader.loadAsync('shelf.gltf');
    shelf = shelfGltf.scene;
    shelf.scale.set(1.5, 1.5, 1.5);
    shelf.rotation.set(0, 0, 0);
    // --- Apply Metallic Material to Shelf ---
    shelf.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
                color: 0x222222,
                metalness: 1.0,
                roughness: 0.05,
                emissive: 0x222222,
                emissiveIntensity: 0.7
            });
        }
    });
    // --- Position Shelf ---
    const shelfBoxObj = new THREE.Box3().setFromObject(shelf);
    const shelfMin = shelfBoxObj.min;
    const shelfMax = shelfBoxObj.max;
    const tableMin = tableBox.min;
    const tableMax = tableBox.max;
    shelfY = tableMin.y - shelfMin.y;
    shelfZ = tableMin.z - (shelfMax.z - shelfMin.z) / 2 - 1;
    shelf.position.set(
        (tableMin.x + tableMax.x) / 2 + 0.5 - (shelfMax.x + shelfMin.x) / 2,
        shelfY,
        shelfZ
    );
    scene.add(shelf);
    shelfBox = shelfBoxObj;
    // --- Add Albums to Shelf ---
    addAlbumsToShelf();
    // --- Album Cover (detailed) ---
    // No default album cover loaded here; will be set by setAlbumCover from React
    const materials = [
        new THREE.MeshStandardMaterial({ color: 0xffffff }), // Bright red for visibility
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
    ];
    const albumGeometry = new THREE.BoxGeometry(1, 1, 0.1); // Made much larger
    albumMesh = new THREE.Mesh(albumGeometry, materials);
    // Position it prominently in front of the camera
    albumMesh.position.set(-.7, .8, shelf.position.z); // Center it in front of camera
    scene.add(albumMesh);
    console.log('Album mesh created and added to scene');
    // If a cover was requested before mesh was ready, apply it now
    if (pendingAlbumCoverUrl) {
        console.log('Applying pending album cover:', pendingAlbumCoverUrl);
        setAlbumCover(pendingAlbumCoverUrl, pendingAlbumName || "Album");
        pendingAlbumCoverUrl = null;
        pendingAlbumName = null;
    }
    // --- Room, Floor, Ceiling, Lighting, Walls, Laptop ---
    // --- Add Floor ---
    const wallHeight = 5, wallThickness = 0.05, wallExtra = 2;
    const shelfBack = shelf.position.z + (shelfMax.z - shelfMin.z) / 2;
    const backWallOffset = Math.abs(tableMin.z - shelfBack) + 1;
    const expandedMinX = tableMin.x - wallExtra;
    const expandedMaxX = tableMax.x + wallExtra;
    const expandedWidth = expandedMaxX - expandedMinX;
    const expandedMinZ = shelfBack - backWallOffset;
    const expandedMaxZ = tableMax.z + wallExtra;
    const expandedDepth = expandedMaxZ - expandedMinZ;
    const floorY = tableMin.y;
    const floorGeometry = new THREE.BoxGeometry(expandedWidth, 0.05, expandedDepth);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set((expandedMinX + expandedMaxX) / 2, floorY - 0.025, (expandedMinZ + expandedMaxZ) / 2);
    scene.add(floor);
    // --- Add Ceiling and Light ---
    const ceilingY = floorY + wallHeight;
    const ceilingGeometry = new THREE.BoxGeometry(expandedWidth, 0.05, expandedDepth);
    const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.position.set((expandedMinX + expandedMaxX) / 2, ceilingY + 0.025, (expandedMinZ + expandedMaxZ) / 2);
    scene.add(ceiling);
    const lightSphereGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const lightSphereMaterial = new THREE.MeshStandardMaterial({ color: 0x0509f7, emissive: 0x0509f7, emissiveIntensity: 30 });
    const lightSphere = new THREE.Mesh(lightSphereGeometry, lightSphereMaterial);
    lightSphere.position.set((expandedMinX + expandedMaxX) / 2, ceilingY + 0.1, (expandedMinZ + expandedMaxZ) / 2);
    scene.add(lightSphere);
    const bluePointLight = new THREE.PointLight(0x0509f7, 10, 10);
    bluePointLight.position.copy(lightSphere.position);
    scene.add(bluePointLight);
    // --- Add Walls ---
    const wallTexture = await textureLoader.loadAsync('wall.jpg');
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(expandedWidth / 2, wallHeight / 2);
    const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture });
    const backWallGeometry = new THREE.BoxGeometry(expandedWidth, wallHeight + 5, wallThickness);
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.set((expandedMinX + expandedMaxX) / 2, floorY + wallHeight / 2, expandedMinZ + wallThickness / 2);
    scene.add(backWall);
    const leftWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, expandedDepth);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.set(expandedMinX - wallThickness / 2, floorY + wallHeight / 2, (expandedMinZ + expandedMaxZ) / 2);
    scene.add(leftWall);
    const rightWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, expandedDepth);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.position.set(expandedMaxX + wallThickness / 2, floorY + wallHeight / 2, (expandedMinZ + expandedMaxZ) / 2);
    scene.add(rightWall);
    // --- Load Laptop Model ---
    const laptopGltf = await loader.loadAsync('laptop.gltf');
    laptop = laptopGltf.scene;
    laptop.scale.set(0.25, 0.25, 0.25);
    const laptopX = tableMin.x + 0.7;
    const laptopZ = (tableMin.z + tableMax.z) / 2;
    const laptopY = tableTop + 0.35;
    laptop.position.set(laptopX, laptopY, laptopZ);
    // --- Apply Materials to Laptop ---
    const screenTexture = await textureLoader.loadAsync('minecraft.jpg');
    laptop.traverse((child) => {
        if (child.isMesh) {
            if (child.name && child.name.toLowerCase().includes('screen')) {
                const screenMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
                child.material = screenMaterial;
                screenTexture.encoding = THREE.sRGBEncoding;
                screenTexture.flipY = true;
                screenMaterial.map = screenTexture;
                screenMaterial.emissiveMap = screenTexture;
                screenMaterial.emissive = new THREE.Color(0xffffff);
                screenMaterial.emissiveIntensity = 1;
                screenMaterial.needsUpdate = true;
            } else {
                child.material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.15 });
            }
        }
    });
    scene.add(laptop);
    // Find the tone arm (recordArmPivot)
    toneArm = model.getObjectByName('recordArmPivot');
    if (toneArm) {
        toneArmRestRotation = toneArm.rotation.y;
        toneArmPlayRotation = toneArmRestRotation - (Math.PI / 6);
        toneArmTarget = toneArmRestRotation;
    }
}

function addAlbumsToShelf() {
    if (!shelf || !shelfBox) return;
    // Remove old album meshes
    albumMeshes.forEach(mesh => scene.remove(mesh));
    albumMeshes = [];
    // Add new album meshes
    const albumDepth = 0.05, albumHeight = 1, albumWidth = 1;
    const geometry = new THREE.BoxGeometry(albumDepth, albumHeight, albumWidth);
    const shelfMax = shelfBox.max;
    for (let i = 0; i < Math.max(0, numAlbums - 1); i++) {
        const material = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(shelfMax.x - 0.1 - (i * albumDepth), shelfY + 2.8, shelfZ);
        scene.add(mesh);
        albumMeshes.push(mesh);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    // Update tooltips
    updateTooltips();
    
    // Animate tone arm
    if (toneArm && toneArmAnimating) {
        const diff = toneArmTarget - toneArm.rotation.y;
        if (Math.abs(diff) > 0.001) {
            toneArm.rotation.y += diff * 0.1;
        } else {
            toneArm.rotation.y = toneArmTarget;
            toneArmAnimating = false;
        }
    }
    // Animate record spinning
    if (record && isRecordSpinning) {
        record.rotation.y += 0.1; // Adjust speed as needed (0.01 radians per frame)
    }
    controls.update();
    renderer.render(scene, camera);
}

// Create tooltip DOM elements
function createTooltips() {
    // Album tooltip
    albumTooltip = document.createElement('div');
    albumTooltip.style.position = 'absolute';
    albumTooltip.style.display = 'none';
    albumTooltip.style.background = 'rgba(0, 0, 0, 0.8)';
    albumTooltip.style.color = 'white';
    albumTooltip.style.padding = '8px 12px';
    albumTooltip.style.borderRadius = '4px';
    albumTooltip.style.pointerEvents = 'none';
    albumTooltip.style.fontSize = '14px';
    albumTooltip.style.zIndex = '1000';
    albumTooltip.style.maxWidth = '200px';
    document.body.appendChild(albumTooltip);

    // Laptop tooltip
    laptopTooltip = document.createElement('div');
    laptopTooltip.style.position = 'absolute';
    laptopTooltip.style.display = 'none';
    laptopTooltip.style.background = 'rgba(0, 0, 0, 0.8)';
    laptopTooltip.style.color = 'white';
    laptopTooltip.style.padding = '8px 12px';
    laptopTooltip.style.borderRadius = '4px';
    laptopTooltip.style.pointerEvents = 'none';
    laptopTooltip.style.fontSize = '14px';
    laptopTooltip.style.zIndex = '1000';
    laptopTooltip.innerHTML = 'Minecraft Java Edition';
    document.body.appendChild(laptopTooltip);

    // Record player tooltip
    recordPlayerTooltip = document.createElement('div');
    recordPlayerTooltip.style.position = 'absolute';
    recordPlayerTooltip.style.display = 'none';
    recordPlayerTooltip.style.background = 'rgba(0, 0, 0, 0.8)';
    recordPlayerTooltip.style.color = 'white';
    recordPlayerTooltip.style.padding = '12px 16px';
    recordPlayerTooltip.style.borderRadius = '6px';
    recordPlayerTooltip.style.pointerEvents = 'none';
    recordPlayerTooltip.style.fontSize = '14px';
    recordPlayerTooltip.style.zIndex = '1000';
    recordPlayerTooltip.style.maxWidth = '300px';
    recordPlayerTooltip.style.lineHeight = '1.4';
    document.body.appendChild(recordPlayerTooltip);
}

// Mouse move handler for tooltips
function onMouseMove(event) {
    if (!camera || !renderer) return;
    
    // Calculate mouse position in normalized device coordinates
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Position tooltips near the cursor
    const tooltipX = event.clientX + 15;
    const tooltipY = event.clientY + 15;
    
    if (albumTooltip) {
        albumTooltip.style.left = tooltipX + 'px';
        albumTooltip.style.top = tooltipY + 'px';
    }
    if (laptopTooltip) {
        laptopTooltip.style.left = tooltipX + 'px';
        laptopTooltip.style.top = tooltipY + 'px';
    }
    if (recordPlayerTooltip) {
        recordPlayerTooltip.style.left = tooltipX + 'px';
        recordPlayerTooltip.style.top = tooltipY + 'px';
    }
}

// Update tooltips based on raycasting
function updateTooltips() {
    if (!camera || !raycaster) return;
    
    raycaster.setFromCamera(mouse, camera);

    // Album tooltip
    if (albumMesh && albumTooltip) {
        const albumIntersects = raycaster.intersectObject(albumMesh);
        if (albumIntersects.length > 0) {
            albumTooltip.innerHTML = currentAlbumName;
            albumTooltip.style.display = 'block';
        } else {
            albumTooltip.style.display = 'none';
        }
    }

    // Laptop tooltip
    if (laptop && laptopTooltip) {
        const laptopIntersects = raycaster.intersectObject(laptop, true);
        const onLaptop = laptopIntersects.length > 0;
        laptopTooltip.style.display = onLaptop ? 'block' : 'none';
    }

    // Record player tooltip (U-Turn model and record)
    if (recordPlayerTooltip && (model || record)) {
        let onRecordPlayer = false;
        
        // Check intersections with the U-Turn model
        if (model) {
            const modelIntersects = raycaster.intersectObject(model, true);
            if (modelIntersects.length > 0) {
                onRecordPlayer = true;
            }
        }
        
        // Check intersections with the vinyl record
        if (record && !onRecordPlayer) {
            const recordIntersects = raycaster.intersectObject(record);
            if (recordIntersects.length > 0) {
                onRecordPlayer = true;
            }
        }

        if (onRecordPlayer && nowPlayingInfo) {
            // Show Now Playing info
            const { albumName, artistName, side, tracks } = nowPlayingInfo;
            let tooltipContent = `<div style="font-weight: bold; margin-bottom: 4px;">Now Playing</div>`;
            tooltipContent += `<div style="font-weight: bold;">${albumName}</div>`;
            tooltipContent += `<div style="opacity: 0.8; margin-bottom: 6px;">by ${artistName}</div>`;
            tooltipContent += `<div style="font-weight: bold; margin-bottom: 4px;">Side ${side}</div>`;
            
            if (tracks && tracks.length > 0) {
                tooltipContent += `<div style="font-size: 12px; opacity: 0.9;">`;
                tracks.forEach((track, index) => {
                    tooltipContent += `${index + 1}. ${track.name}<br>`;
                });
                tooltipContent += `</div>`;
            }
            
            recordPlayerTooltip.innerHTML = tooltipContent;
            recordPlayerTooltip.style.display = 'block';
        } else if (onRecordPlayer) {
            // Show generic record player info when not playing
            recordPlayerTooltip.innerHTML = '<div style="font-weight: bold;">U-Turn Audio Orbit Plus</div><div style="opacity: 0.8;">Turntable</div>';
            recordPlayerTooltip.style.display = 'block';
        } else {
            recordPlayerTooltip.style.display = 'none';
        }
    }
}

export function setAlbumName(albumName) {
    currentAlbumName = albumName;
    if (albumTooltip) {
        albumTooltip.innerHTML = albumName;
    }
}

export function setNowPlayingInfo(playingInfo) {
    nowPlayingInfo = playingInfo;
    console.log('Now playing info updated:', playingInfo);
}

export function clearNowPlayingInfo() {
    nowPlayingInfo = null;
    console.log('Now playing info cleared');
}
