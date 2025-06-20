import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { authenticate, getAccessToken, handleRedirect, playRandomTopSong, getTopAlbums, playAlbum, togglePlayPause, getCurrentPlaybackState } from './spotifyAuth';

handleRedirect();

console.log('Spotify access token:', getAccessToken()); // Debug: See if token is set

let scene, camera, renderer, controls;
let model;
let recordArmPivot;
let recordArmOriginalRotation = 0;
let recordArmTargetRotation = 0;
let isPlaying = false;
let lastPlaybackCheck = 0;
let pendingPlayback = false;
let playbackDelayTimer = null;
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
            
            // Find the recordArmPivot component
            recordArmPivot = model.getObjectByName('recordArmPivot');
            if (recordArmPivot) {
                console.log('Found recordArmPivot:', recordArmPivot);
                // Store the original rotation
                recordArmOriginalRotation = recordArmPivot.rotation.y;
                recordArmTargetRotation = recordArmOriginalRotation;
            } else {
                console.warn('recordArmPivot not found in model');
                // Debug: Print all object names in the model
                model.traverse((child) => {
                    if (child.name) {
                        console.log('Found object:', child.name);
                    }
                });
            }
            
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
    
    // Check playback state every 2 seconds (to avoid too many API calls)
    const now = Date.now();
    if (now - lastPlaybackCheck > 2000 && getAccessToken()) {
        lastPlaybackCheck = now;
        checkPlaybackState();
    }
    
    // Smoothly animate the record arm pivot to target rotation
    if (recordArmPivot) {
        const rotationDiff = recordArmTargetRotation - recordArmPivot.rotation.y;
        if (Math.abs(rotationDiff) > 0.001) {
            recordArmPivot.rotation.y += rotationDiff * 0.05; // Smooth interpolation
        }
    }
    
    controls.update();
    renderer.render(scene, camera);
}

async function checkPlaybackState() {
    const playbackState = await getCurrentPlaybackState();
    if (playbackState) {
        const newIsPlaying = playbackState.is_playing || false;
        if (newIsPlaying !== isPlaying) {
            // Only update if we're not in a pending playback state
            if (!pendingPlayback) {
                isPlaying = newIsPlaying;
                updateArmPosition();
            }
        }
    }
}

function updateArmPosition() {
    if (recordArmPivot) {
        if (isPlaying) {
            // When music starts playing, immediately move arm to playing position
            recordArmTargetRotation = recordArmOriginalRotation - (Math.PI / 6);
            console.log('Music playing - moving arm to playing position');
        } else {
            // When music stops, immediately return to original position
            recordArmTargetRotation = recordArmOriginalRotation;
            console.log('Music stopped - returning arm to rest position');
        }
    }
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
            console.log('Access token found, preparing to play random top song...');
            startDelayedPlayback(() => playRandomTopSong());
            // Also load albums if not already loaded
            if (topAlbums.length === 0) {
                loadTopAlbums();
            }
        }
    } else if (event.key === ' ') {
        event.preventDefault(); // Prevent page scrolling
        if (getAccessToken()) {
            if (isPlaying) {
                // If music is playing, pause immediately (no delay)
                togglePlayPause();
            } else {
                // If music is paused, start delayed resume
                startDelayedPlayback(() => togglePlayPause());
            }
        } else {
            console.log('Not authenticated, cannot pause/resume');
        }
    } else if (['1', '2', '3', '4', '5'].includes(event.key)) {
        const albumIndex = parseInt(event.key) - 1;
        if (topAlbums.length === 0) {
            console.log('Albums not loaded yet, loading now...');
            loadTopAlbums().then(() => {
                if (topAlbums[albumIndex]) {
                    console.log(`Preparing to play album ${event.key}:`, topAlbums[albumIndex].name);
                    startDelayedPlayback(() => playAlbum(topAlbums[albumIndex].uri));
                } else {
                    alert(`No album available for key ${event.key}.`);
                }
            });
        } else if (topAlbums[albumIndex]) {
            console.log(`Preparing to play album ${event.key}:`, topAlbums[albumIndex].name);
            startDelayedPlayback(() => playAlbum(topAlbums[albumIndex].uri));
        } else {
            console.log(`No album available for key ${event.key}`);
            alert(`No album available for key ${event.key}. Only ${topAlbums.length} albums available.`);
        }
    }
}

// Initialize player on page load if we already have a token
window.addEventListener('load', () => {
    const token = getAccessToken();
    if (token) {
        console.log('Token found on load - ready to use regular Spotify API.');
    }
    loadTopAlbums();
});

// Load albums when page loads and when user authenticates
window.addEventListener('keydown', handleKeyPress);
init();

function startDelayedPlayback(playbackFunction) {
    // Clear any existing timer
    if (playbackDelayTimer) {
        clearTimeout(playbackDelayTimer);
    }
    
    // Set pending state and move arm immediately
    pendingPlayback = true;
    recordArmTargetRotation = recordArmOriginalRotation - (Math.PI / 6);
    console.log('Starting delayed playback - moving arm to playing position');
    
    // Start the 2-second timer for actual music playback
    playbackDelayTimer = setTimeout(() => {
        playbackFunction();
        pendingPlayback = false;
        isPlaying = true; // Set playing state since we just triggered playback
        console.log('2-second delay complete - music should now be playing');
    }, 2000);
}