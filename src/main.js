import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { authenticate, getAccessToken, handleRedirect, playRandomTopSong, getTopAlbums, playAlbum, togglePlayPause } from './spotifyAuth';

handleRedirect();

console.log('Spotify access token:', getAccessToken()); // Debug: See if token is set

let scene, camera, renderer, controls;
let model;
let topAlbums = [];

function init() {
    const width = window.innerWidth, height = window.innerHeight;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
    camera.position.z = 1.5;
    camera.position.y = .5;
    camera.rotateX(-.4);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 2);
    scene.add(directionalLight);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000); // Black background for contrast
    document.body.appendChild(renderer.domElement);

    // Add orbit controls
    controls = new OrbitControls(camera, renderer.domElement);

    // Load GLTF model with better debugging
    const loader = new GLTFLoader();
    console.log('Attempting to load model from: /uturn.glb');
    
    loader.load(
        '/uturn.glb', // File should be in public directory
        function (gltf) {
            console.log('GLTF loaded successfully:', gltf);
            model = gltf.scene;
            scene.add(model);
            
            model.scale.set(0.1, 0.1, 0.1);
            model.position.set(0, 0, 0);
            model.rotation.y = -1 * Math.PI / 2; // Rotate 90 degrees on Y axis
            
            console.log('Model added to scene successfully');
        },
        function (progress) {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        function (error) {
            console.error('An error happened loading the model:', error);
            console.log('Falling back to green box');
            // Fallback to green box if model fails to load
            const boxGeometry = new THREE.BoxGeometry();
            const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const box = new THREE.Mesh(boxGeometry, boxMaterial);
            scene.add(box);
        }
    );

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

async function loadTopAlbums() {
    if (getAccessToken()) {
        topAlbums = await getTopAlbums();
        console.log('Loaded top albums:', topAlbums);
        // Trigger a UI update by dispatching a custom event
        window.dispatchEvent(new CustomEvent('albumsLoaded', { detail: topAlbums }));
    }
}

function handleKeyPress(event) {
    if (event.key === 'p') {
        if (!getAccessToken()) {
            console.log('No access token, authenticating...');
            authenticate();
        } else {
            console.log('Access token found, playing random top song...');
            playRandomTopSong();
            // Also load albums if not already loaded
            if (topAlbums.length === 0) {
                loadTopAlbums();
            }
        }
    } else if (event.key === ' ') {
        event.preventDefault(); // Prevent page scrolling
        if (getAccessToken()) {
            togglePlayPause();
        } else {
            console.log('Not authenticated, cannot pause/resume');
        }
    } else if (['1', '2', '3', '4', '5'].includes(event.key)) {
        const albumIndex = parseInt(event.key) - 1;
        if (topAlbums.length === 0) {
            console.log('Albums not loaded yet, loading now...');
            loadTopAlbums().then(() => {
                if (topAlbums[albumIndex]) {
                    console.log(`Playing album ${event.key}:`, topAlbums[albumIndex].name);
                    playAlbum(topAlbums[albumIndex].uri);
                } else {
                    alert(`No album available for key ${event.key}.`);
                }
            });
        } else if (topAlbums[albumIndex]) {
            console.log(`Playing album ${event.key}:`, topAlbums[albumIndex].name);
            playAlbum(topAlbums[albumIndex].uri);
        } else {
            console.log(`No album available for key ${event.key}`);
            alert(`No album available for key ${event.key}. Only ${topAlbums.length} albums available.`);
        }
    }
}

// Load albums when page loads and when user authenticates
window.addEventListener('load', loadTopAlbums);
window.addEventListener('keydown', handleKeyPress);
init();