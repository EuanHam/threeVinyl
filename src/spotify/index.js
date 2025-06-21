// Main export file for Spotify functionality
export { authenticate, handleRedirect, getAccessToken } from './auth.js';
export { 
    initializeWebPlayer, 
    isPlayerReady, 
    isWebPlayerEnabled, 
    getDeviceId 
} from './webPlayer.js';
export { 
    getAvailableDevices,
    playRandomTopSong,
    playAlbum,
    togglePlayPause,
    getTopAlbums,
    getCurrentPlaybackState
} from './api.js';
