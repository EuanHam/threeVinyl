// Remove: import { Client } from 'spotify-api-sdk';

// Use NEXT_PUBLIC_ prefix for env vars to expose to browser in Next.js
const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;
const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI;

function base64urlencode(a) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return await window.crypto.subtle.digest('SHA-256', data);
}

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export const authenticate = async () => {
    // Load SDK first
    loadSDK();
    
    const codeVerifier = generateRandomString(128);
    window.localStorage.setItem('spotify_code_verifier', codeVerifier);

    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);

    const scope = 'user-read-playback-state user-modify-playback-state user-top-read user-read-private';

    const authUrl = `https://accounts.spotify.com/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${codeChallenge}` +
        `&scope=${encodeURIComponent(scope)}`;

    window.location.href = authUrl;
};

export const handleRedirect = async () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    console.log('handleRedirect called, code:', code); // Debug
    if (code) {
        const codeVerifier = window.localStorage.getItem('spotify_code_verifier');
        console.log('Code verifier:', codeVerifier); // Debug
        const body = new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        });

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body.toString()
            });

            const data = await response.json();
            console.log('Token response:', data); // Debug
            if (data.access_token) {
                window.localStorage.setItem('spotify_access_token', data.access_token);
                console.log('Token stored:', data.access_token); // Debug
                window.history.replaceState({}, document.title, '/');
                
                // Don't automatically initialize player - let user choose
                console.log('Authentication successful. Player initialization skipped for now.');
            } else {
                console.error('Failed to get access token:', data);
            }
        } catch (error) {
            console.error('Error during token exchange:', error);
        }
    }
};

export const getAccessToken = () => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('spotify_access_token') || '';
};

export const getAvailableDevices = async () => {
    const token = getAccessToken();
    if (!token) return [];
    
    try {
        const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        // Check if token is expired
        if (response.status === 401) {
            console.log('Token expired, clearing stored token');
            window.localStorage.removeItem('spotify_access_token');
            alert('Your Spotify session has expired. Please authenticate again.');
            return [];
        }
        
        const data = await response.json();
        console.log('Available devices:', data.devices);
        return data.devices || [];
    } catch (error) {
        console.error('Error getting devices:', error);
        return [];
    }
};

export const playRandomTopSong = async () => {
    const token = getAccessToken();
    console.log('Playing song with token:', token); // Debug
    if (!token) {
        console.error('Access token is missing. Please authenticate first.');
        return;
    }

    // Default to fallback approach for now to avoid Web Playback SDK issues
    console.log('Using regular Spotify API (requires active device)');
    return playRandomTopSongFallback();
};

export const getTopAlbums = async () => {
    const token = getAccessToken();
    if (!token) return [];
    
    try {
        const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            console.log('Token expired, clearing stored token');
            window.localStorage.removeItem('spotify_access_token');
            return [];
        }
        
        const data = await response.json();
        if (!data.items) return [];
        
        // Extract unique albums from top tracks
        const albums = [];
        const albumIds = new Set();
        
        for (const track of data.items) {
            const album = track.album;
            if (!albumIds.has(album.id)) {
                albumIds.add(album.id);
                albums.push({
                    id: album.id,
                    name: album.name,
                    artist: album.artists[0].name,
                    uri: album.uri,
                    image: album.images[0]?.url
                });
                
                if (albums.length >= 5) break;
            }
        }
        
        console.log('Top albums:', albums);
        return albums;
    } catch (error) {
        console.error('Error getting top albums:', error);
        return [];
    }
};

export const playAlbum = async (albumUri) => {
    const token = getAccessToken();
    if (!token) {
        console.error('Access token is missing. Please authenticate first.');
        return;
    }

    // Use regular API approach
    try {
        // Check for active devices
        const devices = await getAvailableDevices();
        const activeDevices = devices.filter(device => device.is_active);

        if (activeDevices.length === 0) {
            alert(`No active devices found. Found these devices: ${devices.map(d => d.name).join(', ')}. Please start playing music on one of them first.`);
            return;
        }

        const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ context_uri: albumUri })
        });

        if (playResponse.status === 401) {
            console.log('Token expired during play request');
            window.localStorage.removeItem('spotify_access_token');
            alert('Your Spotify session has expired. Please press "p" again to re-authenticate.');
            return;
        }

        if (!playResponse.ok) {
            const errorData = await playResponse.text();
            console.error('Play album request failed:', playResponse.status, errorData);
            alert('Failed to play album. Make sure Spotify is open and active.');
        } else {
            console.log('Album started successfully');
            alert('Album started playing!');
        }
    } catch (error) {
        console.error('Error playing album:', error);
    }
};

export const togglePlayPause = async () => {
    const token = getAccessToken();
    if (!token) {
        console.error('Access token is missing. Please authenticate first.');
        return;
    }

    try {
        // Check for active devices
        const devices = await getAvailableDevices();
        const activeDevices = devices.filter(device => device.is_active);

        if (activeDevices.length === 0) {
            alert('No active devices found. Please start playing music first.');
            return;
        }

        // Get current playback state
        const stateResponse = await fetch('https://api.spotify.com/v1/me/player', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (stateResponse.status === 401) {
            console.log('Token expired during playback state request');
            window.localStorage.removeItem('spotify_access_token');
            alert('Your Spotify session has expired. Please press "p" again to re-authenticate.');
            return;
        }

        if (stateResponse.status === 204) {
            // No active playback
            console.log('No active playback to pause/resume');
            return;
        }

        const stateData = await stateResponse.json();
        const isPlaying = stateData.is_playing;

        // Toggle play/pause based on current state
        const endpoint = isPlaying ? 'pause' : 'play';
        const playPauseResponse = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (playPauseResponse.status === 401) {
            console.log('Token expired during play/pause request');
            window.localStorage.removeItem('spotify_access_token');
            alert('Your Spotify session has expired. Please press "p" again to re-authenticate.');
            return;
        }

        if (playPauseResponse.ok) {
            console.log(`Playback ${isPlaying ? 'paused' : 'resumed'}`);
        } else {
            console.error('Failed to toggle play/pause:', playPauseResponse.status);
        }
    } catch (error) {
        console.error('Error toggling play/pause:', error);
    }
};

export const getCurrentPlaybackState = async () => {
    const token = getAccessToken();
    if (!token) return null;

    try {
        const response = await fetch('https://api.spotify.com/v1/me/player', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            console.log('Token expired during playback state request');
            window.localStorage.removeItem('spotify_access_token');
            return null;
        }

        if (response.status === 204) {
            // No active playback
            return { is_playing: false };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting playback state:', error);
        return null;
    }
};

// Global variables for player state
let player = null;
let deviceId = null;
let playerReady = false;

// Flag to track if we should use Web Playback SDK or fall back to regular API
let useWebPlaybackSDK = true;
let fallbackToRegularAPI = false;

// Load Spotify Web Playback SDK
const loadSDK = () => {
    const existingScript = document.getElementById('playerSDK');

    if(existingScript) return;

    const script = document.createElement('script');
    script.id = 'playerSDK';
    script.type = 'text/javascript';
    script.async = false;
    script.defer = true;
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onload = () => console.log("Spotify SDK loaded");
    script.onerror = (error) => console.error("Error loading Spotify SDK:", error);

    document.head.appendChild(script);
};

// Initialize the Spotify Web Playback SDK
const initPlayer = (token) => {
    const setupPlayer = () => {
        player = new Spotify.Player({
            name: 'ThreeVinyl Player',
            getOAuthToken: cb => { cb(token); }
        });

        // Error handling
        player.addListener('initialization_error', ({ message }) => { 
            console.error('Initialization error:', message); 
            fallbackToRegularAPI = true;
            alert('Player initialization failed. Falling back to regular Spotify API. You\'ll need to have Spotify open on another device.');
        });
        player.addListener('authentication_error', ({ message }) => { 
            console.error('Authentication error:', message); 
            fallbackToRegularAPI = true;
            alert('Authentication error: ' + message + '. Falling back to regular Spotify API. You\'ll need to have Spotify open on another device.');
        });
        player.addListener('account_error', ({ message }) => { 
            console.error('Account error:', message); 
            fallbackToRegularAPI = true;
            alert('Account error: ' + message + '. Web Playback SDK requires Spotify Premium. Falling back to regular API - you\'ll need Spotify open on another device.');
        });
        player.addListener('playback_error', ({ message }) => { 
            console.error('Playback error:', message); 
        });

        // Playback status updates
        player.addListener('player_state_changed', state => {
            if(!state) {
                console.log('Player state is null');
                return;
            }
            
            console.log('Player state changed:', state);
            // Dispatch custom event for main.js to listen to
            window.dispatchEvent(new CustomEvent('playerStateChanged', { 
                detail: { 
                    isPlaying: !state.paused,
                    track: state.track_window.current_track 
                } 
            }));
        });

        // Ready
        player.addListener('ready', ({ device_id }) => {
            console.log('Ready with Device ID', device_id);
            deviceId = device_id;
            playerReady = true;
            
            // Transfer playback to this device
            takeOver(token, device_id);
        });

        // Not Ready
        player.addListener('not_ready', ({ device_id }) => {
            console.log('Device ID has gone offline', device_id);
            playerReady = false;
        });

        // Connect to the player
        player.connect();
        window.player = player;
    };

    if (window.Spotify) {
        setupPlayer();
    } else {
        window.onSpotifyWebPlaybackSDKReady = () => {
            setupPlayer();
        };
    }
};

// Take over playback to our virtual device
const takeOver = async (accessToken, deviceId) => {
    try {
        const response = await fetch(`https://api.spotify.com/v1/me/player`, {
            method: 'PUT',
            body: JSON.stringify({ device_ids: [deviceId], play: false }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
        });
        
        if (response.ok) {
            console.log('Successfully transferred playback to virtual device');
        } else {
            console.error('Failed to transfer playback:', response.status);
        }
    } catch (error) {
        console.error('Error transferring playback:', error);
    }
};

// Fallback function that uses the regular Spotify API (requires active device)
const playRandomTopSongFallback = async () => {
    const token = getAccessToken();
    if (!token) {
        console.error('Access token is missing. Please authenticate first.');
        return;
    }

    try {
        // Check for devices first
        const devices = await getAvailableDevices();
        console.log('All devices found:', devices);
        
        if (devices.length === 0) {
            alert('No Spotify devices found. Please open Spotify on any device and start playing a song, then try again.');
            return;
        }

        // Check for active devices
        const activeDevices = devices.filter(device => device.is_active);
        console.log('Active devices:', activeDevices);

        if (activeDevices.length === 0) {
            alert(`No active devices found. Found these devices: ${devices.map(d => d.name).join(', ')}. Please start playing music on one of them first.`);
            return;
        }

        const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            console.log('Token expired during top tracks request');
            window.localStorage.removeItem('spotify_access_token');
            alert('Your Spotify session has expired. Please press "p" again to re-authenticate.');
            return;
        }

        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            console.error('No top tracks found.');
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * data.items.length);
        const songUri = data.items[randomIndex].uri;
        console.log('Playing song:', songUri);

        const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: [songUri] })
        });

        if (playResponse.status === 401) {
            console.log('Token expired during play request');
            window.localStorage.removeItem('spotify_access_token');
            alert('Your Spotify session has expired. Please press "p" again to re-authenticate.');
            return;
        }

        if (!playResponse.ok) {
            const errorData = await playResponse.text();
            console.error('Play request failed:', playResponse.status, errorData);
        } else {
            console.log('Song started successfully');
            alert('Song started playing!');
        }
    } catch (error) {
        console.error('Error playing song:', error);
    }
};

// Export functions and getters for external use
export { loadSDK, initPlayer };
export const getPlayerReady = () => playerReady;
export const getDeviceId = () => deviceId;