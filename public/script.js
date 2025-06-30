import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const width = window.innerWidth, height = window.innerHeight;

const camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
camera.position.z = 1.5;
camera.position.y = .5;
camera.rotateX(-.4);

const scene = new THREE.Scene();

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 2);
scene.add(directionalLight);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputEncoding = THREE.sRGBEncoding; // Add this for correct color output
renderer.setSize(width, height);
renderer.setClearColor(0xff0000);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// --- Tooltip and Raycasting Setup ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let albumMesh = null; // Will hold the album cover mesh

// Create album tooltip element
const tooltip = document.createElement('div');
tooltip.style.position = 'absolute';
tooltip.style.display = 'none';
tooltip.style.background = 'rgba(0, 0, 0, 0.7)';
tooltip.style.color = 'white';
tooltip.style.padding = '5px 10px';
tooltip.style.borderRadius = '3px';
tooltip.style.pointerEvents = 'none'; // So it doesn't interfere with other mouse events
tooltip.innerHTML = "Head Hunters by Herbie Hancock";
document.body.appendChild(tooltip);

// Create screen tooltip element
const screenTooltip = document.createElement('div');
screenTooltip.style.position = 'absolute';
screenTooltip.style.display = 'none';
screenTooltip.style.background = 'rgba(0, 0, 0, 0.7)';
screenTooltip.style.color = 'white';
screenTooltip.style.padding = '5px 10px';
screenTooltip.style.borderRadius = '3px';
screenTooltip.style.pointerEvents = 'none';
screenTooltip.innerHTML = "Minecraft";
document.body.appendChild(screenTooltip);

// Create pop-up screen element
const popupScreen = document.createElement('div');
popupScreen.style.position = 'fixed';
popupScreen.style.display = 'none';
popupScreen.style.bottom = '0';
popupScreen.style.left = '20%';
popupScreen.style.width = '60%';
popupScreen.style.height = '400px';
popupScreen.style.background = 'rgba(250, 250, 250, 0.95)';
popupScreen.style.border = '1px solid #ccc';
popupScreen.style.borderBottom = 'none';
popupScreen.style.boxShadow = '0 -4px 8px rgba(0,0,0,0.2)';
popupScreen.style.zIndex = '1000';
popupScreen.style.borderTopLeftRadius = '10px';
popupScreen.style.borderTopRightRadius = '10px';
document.body.appendChild(popupScreen);

function onMouseMove(event) {
    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Position tooltips near the cursor
    const tooltipX = (event.clientX + 15) + 'px';
    const tooltipY = (event.clientY + 15) + 'px';
    tooltip.style.left = tooltipX;
    tooltip.style.top = tooltipY;
    screenTooltip.style.left = tooltipX;
    screenTooltip.style.top = tooltipY;
}
window.addEventListener('mousemove', onMouseMove, false);

// Add keydown listener for pop-up
window.addEventListener('keydown', (event) => {
    if (event.key === 'p') {
        const isHidden = popupScreen.style.display === 'none';
        popupScreen.style.display = isHidden ? 'block' : 'none';
    }
});

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
let model;
let table;
let shelf; // add a variable for the shelf
let laptop = null; // Will hold the laptop model

async function init() {
    try {
        const axesHelper = new THREE.AxesHelper( 5 );
        scene.add( axesHelper );
        // --- Load U-Turn Model ---
        const uturnGltf = await loader.loadAsync('uturn.glb');
        model = uturnGltf.scene;
        model.scale.set(0.1, 0.1, 0.1);
        model.rotateY(Math.PI * -0.5);

        // --- Create and place vinyl record ---
        const originalCylinder = model.getObjectByName("Cylinder");

        if (originalCylinder) {
            const vinylTexture = await textureLoader.loadAsync('vinyl.png');

            // Use the local bounding box of the cylinder to define the new geometry
            const localBox = new THREE.Box3().setFromObject(originalCylinder);
            const localSize = new THREE.Vector3();
            localBox.getSize(localSize);

            const recordRadius = localSize.x / 2; // Radius in local space
            const recordHeight = localSize.y * 1.1; // Slightly thicker than the platter in local space

            const recordGeometry = new THREE.CylinderGeometry(recordRadius, recordRadius, recordHeight, 32);
            const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x010101 });
            const vinylMaterial = new THREE.MeshStandardMaterial({ map: vinylTexture });

            // The new record will be a sibling of the original cylinder
            const record = new THREE.Mesh(recordGeometry, [blackMaterial, vinylMaterial, blackMaterial]);

            // Copy the local position of the original cylinder
            record.position.copy(originalCylinder.position);
            // Place it slightly above the original in local y
            record.position.y += localSize.y;

            // Add the record to the same parent as the original cylinder
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
        const shelfBox = new THREE.Box3().setFromObject(shelf);
        const shelfMin = shelfBox.min;
        const shelfMax = shelfBox.max;
        const tableMin = tableBox.min;
        const tableMax = tableBox.max;
        const shelfY = tableMin.y - shelfMin.y;
        const shelfZ = tableMin.z - (shelfMax.z - shelfMin.z) / 2 - 1;
        shelf.position.set(
            (tableMin.x + tableMax.x) / 2 + 0.5 - (shelfMax.x + shelfMin.x) / 2,
            shelfY,
            shelfZ
        );
        scene.add(shelf);

        // --- Album Configuration ---
        const numAlbums = 40; // Total number of albums, including the detailed one.
        const albumWidth = 1, albumHeight = 1, albumDepth = 0.05;

        // --- Add Detailed Album Cover ---
        const albumTexture = await textureLoader.loadAsync("https://upload.wikimedia.org/wikipedia/en/5/54/Herbie-Hancock-Head-Hunters.png");
        const materials = [
            new THREE.MeshStandardMaterial({ color: 0x111111 }), // right
            new THREE.MeshStandardMaterial({ color: 0x111111 }), // left
            new THREE.MeshStandardMaterial({ color: 0x111111 }), // top
            new THREE.MeshStandardMaterial({ color: 0x111111 }), // bottom
            new THREE.MeshStandardMaterial({ map: albumTexture }), // front
            new THREE.MeshStandardMaterial({ color: 0x111111 })  // back
        ];
        const albumGeometry = new THREE.BoxGeometry(albumWidth, albumHeight, albumDepth);
        albumMesh = new THREE.Mesh(albumGeometry, materials);
        const shelfCenterX = (shelfBox.min.x + shelfBox.max.x) / 2 - 1.3;
        albumMesh.position.set(shelfCenterX + .6, shelfY + 2.8, shelfZ);
        scene.add(albumMesh);

        // --- Add Additional Album Stacks ---
        const extraAlbums = Math.max(0, numAlbums - 1);
        const topStackCount = Math.min(extraAlbums, 24); // Up to 24 on top stack
        const bottomStackCount = Math.max(0, extraAlbums - 24); // The rest go on the bottom

        // Helper function to generate a random muted color
        function getRandomMutedColor() {
            const hue = Math.random();
            const saturation = 0.3 + Math.random() * 0.2; // Low saturation
            const lightness = 0.4 + Math.random() * 0.2; // Mid-range lightness
            return new THREE.Color().setHSL(hue, saturation, lightness);
        }

        const individualAlbumGeometry = new THREE.BoxGeometry(albumDepth, albumHeight, albumWidth);

        if (topStackCount > 0) {
            const topStackXStart = shelfBox.max.x - 0.1 - (albumDepth / 2);
            for (let i = 0; i < topStackCount; i++) {
                const material = new THREE.MeshStandardMaterial({ color: getRandomMutedColor() });
                const album = new THREE.Mesh(individualAlbumGeometry, material);
                album.position.set(
                    topStackXStart - (i * albumDepth),
                    shelfY + 2.8, // Top shelf Y
                    shelfZ
                );
                scene.add(album);
            }
        }

        if (bottomStackCount > 0) {
            const bottomStackXStart = shelfBox.max.x - 0.1 - (albumDepth / 2);
            const bottomShelfY = shelfY + 1.4; // Approximate y for the bottom shelf level
            for (let i = 0; i < bottomStackCount; i++) {
                const material = new THREE.MeshStandardMaterial({ color: getRandomMutedColor() });
                const album = new THREE.Mesh(individualAlbumGeometry, material);
                album.position.set(
                    bottomStackXStart - (i * albumDepth),
                    bottomShelfY,
                    shelfZ
                );
                scene.add(album);
            }
        }

        // --- Create Room Geometry ---
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

        // --- Add Floor ---
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

        // --- Start Animation Loop ---
        renderer.setAnimationLoop(render);

    } catch (error) {
        console.error('An error happened during initialization:', error);
    }
}

init();

/*
function animate(time) {
    if (model) {
        model.rotation.y = time / 1000;
    }
    renderer.render(scene, camera);
}
*/

function render() {
    // Raycasting for tooltips
    raycaster.setFromCamera(mouse, camera);

    // Album tooltip
    if (albumMesh) {
        const albumIntersects = raycaster.intersectObject(albumMesh);
        tooltip.style.display = albumIntersects.length > 0 ? 'block' : 'none';
    }

    // Screen tooltip
    if (laptop) {
        const screenIntersects = raycaster.intersectObject(laptop, true);
        const onScreen = screenIntersects.some(intersect => intersect.object.name && intersect.object.name.toLowerCase().includes('screen'));
        screenTooltip.style.display = onScreen ? 'block' : 'none';
    }

    // Remove WASD camera movement logic
    controls.update();
    renderer.render(scene, camera);
}