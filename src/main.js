import * as THREE from 'three';
import { authenticate, getAccessToken, handleRedirect, playRandomTopSong } from './spotifyAuth';

handleRedirect();

console.log('Spotify access token:', getAccessToken()); // Debug: See if token is set

let scene, camera, renderer;

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const boxGeometry = new THREE.BoxGeometry();
    const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    scene.add(box);

    camera.position.z = 5;

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function handleKeyPress(event) {
    if (event.key === 'p') {
        if (!getAccessToken()) {
            console.log('No access token, authenticating...');
            authenticate();
        } else {
            console.log('Access token found, playing random top song...');
            playRandomTopSong();
        }
    }
}

window.addEventListener('keydown', handleKeyPress);
init();