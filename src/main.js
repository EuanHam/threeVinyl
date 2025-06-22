import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { authenticate, getAccessToken, playRandomTopSong, getTopAlbums, playAlbum, togglePlayPause, getCurrentPlaybackState, getPlayerReady } from './spotifyAuth';

console.log('Spotify access token:', getAccessToken());

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

    // lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 2);
    scene.add(directionalLight);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000); // change to something else later
    document.body.appendChild(renderer.domElement);

    // orbit controls though remove later for some other control system?
    controls = new OrbitControls(camera, renderer.domElement);

    const loader = new GLTFLoader();
    console.log('Attempting to load model from: /uturn.glb');
    
    loader.load(
        '/uturn.glb',
        function (gltf) {
            console.log('GLTF loaded successfully:', gltf);
            model = gltf.scene;
            scene.add(model);
            
            model.scale.set(0.1, 0.1, 0.1);
            model.position.set(0, 0, 0);
            model.rotation.y = -1 * Math.PI / 2; 
            
            // recordArmPivot component
            recordArmPivot = model.getObjectByName('recordArmPivot');
            if (recordArmPivot) {
                console.log('Found recordArmPivot:', recordArmPivot);
                // store original rotation
                recordArmOriginalRotation = recordArmPivot.rotation.y;
                recordArmTargetRotation = recordArmOriginalRotation;
            } else {
                console.warn('recordArmPivot not found in model');
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
        // maybe add some other fallback or just say threeify can't be used
        function (error) {
            console.error('An error happened loading the model:', error);
            console.log('Falling back to green box');
            const boxGeometry = new THREE.BoxGeometry();
            const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const box = new THREE.Mesh(boxGeometry, boxMaterial);
            scene.add(box);
        }
    );

    // window resize
    window.addEventListener('resize', onWindowResize);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    
    // check playback state every 2 seconds to avoid excessive api calls
    const now = Date.now();
    if (now - lastPlaybackCheck > 2000 && getAccessToken()) {
        lastPlaybackCheck = now;
        checkPlaybackState();
    }
    

    if (recordArmPivot) {
        const rotationDiff = recordArmTargetRotation - recordArmPivot.rotation.y;
        if (Math.abs(rotationDiff) > 0.001) {
            recordArmPivot.rotation.y += rotationDiff * 0.05; 
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
            // only update if we're not in a pending playback state
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
            // when music starts playing, immediately move arm to playing position
            recordArmTargetRotation = recordArmOriginalRotation - (Math.PI / 6);
            console.log('Music playing - moving arm to playing position');
        } else {
            // when music stops, immediately return to original position
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
        window.dispatchEvent(new CustomEvent('albumsLoaded', { detail: topAlbums }));
    }
}

function handleKeyPress(event) {
    if (event.key === 'p') {
        if (!getAccessToken()) {
            console.log('No access token, authenticating...');
            sessionStorage.setItem('playAfterAuth', 'true');
            authenticate();
        } else {
            console.log('Access token found, preparing to play random top song...');
            startDelayedPlayback(() => playRandomTopSong());
            if (topAlbums.length === 0) {
                loadTopAlbums();
            }
        }
    } else if (event.key === ' ') {
        event.preventDefault(); 
        if (getAccessToken()) {
            if (isPlaying) {
                togglePlayPause();
            } else {
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

window.addEventListener('load', () => {
    const token = getAccessToken();
    if (token) {
        console.log('Token found on load.');
        if (sessionStorage.getItem('playAfterAuth') === 'true') {
            sessionStorage.removeItem('playAfterAuth');

            const maxWaitTime = 10000; // 10 seconds
            const checkInterval = 500; // 0.5 seconds
            let timeWaited = 0;

            console.log('Waiting for Spotify Player to be ready for auto-play...');

            const playerReadyInterval = setInterval(() => {
                if (getPlayerReady()) {
                    clearInterval(playerReadyInterval);
                    console.log('Player is ready. Playing random top song automatically.');
                    startDelayedPlayback(playRandomTopSong);
                } else {
                    timeWaited += checkInterval;
                    if (timeWaited >= maxWaitTime) {
                        clearInterval(playerReadyInterval);
                        console.warn('Player did not become ready in time for auto-play.');
                        alert('Could not start music automatically. Please press "p" again.');
                    }
                }
            }, checkInterval);
        }
    }
    loadTopAlbums();
});

window.addEventListener('keydown', handleKeyPress);
init();

function startDelayedPlayback(playbackFunction) {
    if (playbackDelayTimer) {
        clearTimeout(playbackDelayTimer);
    }
    
    pendingPlayback = true;
    recordArmTargetRotation = recordArmOriginalRotation - (Math.PI / 6);
    console.log('Starting delayed playback - moving arm to playing position');
    
    playbackDelayTimer = setTimeout(() => {
        playbackFunction();
        pendingPlayback = false;
        isPlaying = true;
        console.log('2-second delay complete - music should now be playing');
    }, 2000);
}