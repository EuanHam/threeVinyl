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
    const codeVerifier = generateRandomString(128);
    window.localStorage.setItem('spotify_code_verifier', codeVerifier);

    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);

    const scope = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-top-read user-read-currently-playing';

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
            console.log('Token response:', data);
            if (data.access_token) {
                window.localStorage.setItem('spotify_access_token', data.access_token);
                console.log('Token stored:', data.access_token);
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

export const getUserProfile = async () => {
    const token = getAccessToken();
    if (!token) return null;

    try {
        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401) {
            console.log('Token expired, clearing stored token');
            window.localStorage.removeItem('spotify_access_token');
            return null;
        }
        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }
        return await response.json();
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
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

    if (playerReady && deviceId) {
        console.log(`Using Web Playback SDK with device ID: ${deviceId}`);
        try {
            // Get user's top tracks
            const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error(`Failed to get top tracks: ${response.statusText}`);
            }
            const data = await response.json();
            if (!data.items || data.items.length === 0) {
                console.warn('No top tracks found for the user.');
                return;
            }

            // Pick a random song
            const randomTrack = data.items[Math.floor(Math.random() * data.items.length)];
            console.log(`Playing random top song: ${randomTrack.name} by ${randomTrack.artists[0].name}`);

            // Play it using the Web Playback SDK
            const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                method: 'PUT',
                body: JSON.stringify({ uris: [randomTrack.uri] }),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });

            if (!playResponse.ok) {
                console.error('Failed to play random song:', playResponse.status, await playResponse.text());
                if (playResponse.status === 404) {
                    alert("Spotify player device not found. It might have disconnected. Please try refreshing the page.");
                    playerReady = false;
                    deviceId = null;
                }
            }
        } catch (error) {
            console.error('Error playing random song with SDK:', error);
        }
    } else {
        // Fallback removed, show alert instead
        console.warn('Play command issued but Web Playback SDK not ready. Please wait a moment and try again.');
        alert('Spotify player is initializing. Please try again in a moment.');
    }
};

export const getTopAlbums = async () => {
    const token = getAccessToken();
    if (!token) return [];

    try {
        // 1. Get user's top tracks to find out their favorite albums
        const tracksResponse = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (tracksResponse.status === 401) {
            console.log('Token expired, clearing stored token');
            window.localStorage.removeItem('spotify_access_token');
            return [];
        }

        const tracksData = await tracksResponse.json();
        if (!tracksData.items) return [];

        // 2. Extract unique album IDs from the tracks
        const albumIds = new Set();
        for (const track of tracksData.items) {
            albumIds.add(track.album.id);
        }

        // We can only fetch 20 albums at a time. Let's take the first 20.
        const uniqueAlbumIds = Array.from(albumIds).slice(0, 20);

        if (uniqueAlbumIds.length === 0) {
            return [];
        }

        // 3. Fetch the full album details for these IDs
        const albumsResponse = await fetch(`https://api.spotify.com/v1/albums?ids=${uniqueAlbumIds.join(',')}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!albumsResponse.ok) {
            throw new Error(`Failed to get album details: ${albumsResponse.statusText}`);
        }

        const albumsData = await albumsResponse.json();
        
        // The API returns an object with an 'albums' array.
        // Filter out any null albums that might be returned.
        const fullAlbums = albumsData.albums.filter(album => album);

        // 4. For each album, ensure we have the full track list, handling pagination
        const detailedAlbums = await Promise.all(fullAlbums.map(async (album) => {
            if (album.tracks.next) {
                let tracks = album.tracks.items;
                let nextUrl = album.tracks.next;
                while (nextUrl) {
                    const tracksResponse = await fetch(nextUrl, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!tracksResponse.ok) break; // Stop if we hit an error
                    const tracksData = await tracksResponse.json();
                    tracks = tracks.concat(tracksData.items);
                    nextUrl = tracksData.next;
                }
                album.tracks.items = tracks;
            }
            return album;
        }));

        return detailedAlbums.slice(0, 10); // Return top 10 full album objects

    } catch (error) {
        console.error('Error getting top albums:', error);
        return [];
    }
};

export const playAlbum = async (albumObject, sideLetter = null) => {
    const token = getAccessToken();
    if (!playerReady || !deviceId) {
        console.error('Cannot play album: player not ready.');
        // Let the UI handle this with a more user-friendly message if needed
        return;
    }

    let urisToPlay = [];
    let contextUri = null;
    let playOptions = {};

    if (sideLetter) {
        const side = albumObject.getSide(sideLetter);
        if (side && side.tracks.length > 0) {
            urisToPlay = side.tracks.map(track => track.uri);
            playOptions.uris = urisToPlay;
            console.log(`Playing side ${sideLetter} of ${albumObject.spotifyData.name} with tracks:`, urisToPlay);
        } else {
            console.warn(`Side ${sideLetter} not found or is empty for album ${albumObject.spotifyData.name}.`);
            alert(`Side ${sideLetter} is not available for this album.`);
            return;
        }
    } else {
        // Play the full album from the beginning
        contextUri = albumObject.spotifyData.uri;
        playOptions.context_uri = contextUri;
        playOptions.offset = { position: 0 }; // Ensure it starts from the first track
        console.log(`Playing full album: ${albumObject.spotifyData.name}`);
    }

    try {
        // 1. Set shuffle and repeat mode before playing.
        // These calls are important for the "album experience".
        await fetch(`https://api.spotify.com/v1/me/player/set-shuffle?state=false&device_id=${deviceId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        await fetch(`https://api.spotify.com/v1/me/player/set-repeat?state=off&device_id=${deviceId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        // 2. Start playback with the chosen context or track URIs.
        const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            body: JSON.stringify(playOptions),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!playResponse.ok) {
            const errorText = await playResponse.text();
            console.error('Failed to play album/side:', playResponse.status, errorText);
            if (playResponse.status === 404) {
                alert("Spotify player device not found. It might have disconnected. Please try refreshing the page.");
                // Consider updating player state here
                // playerReady = false;
                // deviceId = null;
            }
        } else {
            console.log('Playback command sent successfully.');
        }
    } catch (error) {
        console.error('Error during playAlbum execution:', error);
    }
};

export const togglePlayPause = async () => {
    const token = getAccessToken();
    if (!token) {
        console.error('Access token is missing.');
        return;
    }

    // We should use the SDK device if it's ready
    const urlSuffix = (playerReady && deviceId) ? `?device_id=${deviceId}` : '';

    try {
        const state = await getCurrentPlaybackState();
        if (state && state.is_playing) {
            await fetch(`https://api.spotify.com/v1/me/player/pause${urlSuffix}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
            });
        } else {
            const response = await fetch(`https://api.spotify.com/v1/me/player/play${urlSuffix}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            
            if (!response.ok && response.status === 404) {
                 alert('No active Spotify device found. Please start playback on a device first or wait for the web player to connect.');
            }
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
let isInitializing = false;

// Flag to track if we should use Web Playback SDK or fall back to regular API
// let useWebPlaybackSDK = true; // These seem unused now
// let fallbackToRegularAPI = false;

// Load Spotify Web Playback SDK
const loadSDK = () => {
    const existingScript = document.getElementById('playerSDK');

    if (existingScript) return;

    const script = document.createElement('script');
    script.id = 'playerSDK';
    script.type = 'text/javascript';
    script.async = true;
    script.defer = true;
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onload = () => console.log("Spotify SDK loaded");
    script.onerror = (error) => console.error("Error loading Spotify SDK:", error);

    document.head.appendChild(script);
};

function setupPlayerListeners(playerInstance) {
    // Error handling
    playerInstance.addListener('initialization_error', ({ message }) => {
        console.error('Failed to initialize player:', message);
        alert(`Error: Could not initialize Spotify Player. ${message}`);
        isInitializing = false;
    });
    playerInstance.addListener('authentication_error', ({ message }) => {
        console.error('Failed to authenticate player:', message);
        alert(`Error: Could not authenticate Spotify Player. ${message}. Try logging out and back in.`);
        isInitializing = false;
    });
    playerInstance.addListener('account_error', ({ message }) => {
        console.error('Spotify account error:', message);
        alert(`Error: Spotify account error. ${message}. A Premium account is required.`);
        isInitializing = false;
    });
    playerInstance.addListener('playback_error', ({ message }) => {
        console.error('Playback error:', message);
    });

    // Playback status updates
    playerInstance.addListener('player_state_changed', state => {
        if (state) {
            console.log('Player state changed:', state);
        }
    });

    // Ready
    playerInstance.addListener('ready', ({ device_id }) => {
        console.log('Web Playback SDK is ready. Device ID:', device_id);
        deviceId = device_id;
        playerReady = true;
        isInitializing = false;
        // Automatically transfer playback to this new device
        takeOver(getAccessToken(), device_id);
    });

    // Not Ready
    playerInstance.addListener('not_ready', ({ device_id }) => {
        console.log('Device has gone offline:', device_id);
        playerReady = false;
        deviceId = null;
    });
}

function doInitPlayer() {
    if (player) return;

    const token = getAccessToken();
    if (!token) {
        console.warn("Can't initialize player, no access token found after SDK load.");
        isInitializing = false;
        return;
    }

    console.log("Spotify SDK Ready, initializing player...");

    player = new window.Spotify.Player({
        name: 'Threeify Web Player',
        getOAuthToken: cb => {
            const currentToken = getAccessToken();
            console.log("Player requesting token, providing it.");
            cb(currentToken);
        },
        volume: 0.5
    });

    setupPlayerListeners(player);

    // Connect to the player!
    player.connect().then(success => {
        if (success) {
            console.log('The Web Playback SDK successfully connected to Spotify!');
        } else {
            console.error('The Web Playback SDK failed to connect.');
            isInitializing = false;
        }
    }).catch(error => {
        console.error('Error connecting the Web Playback SDK:', error);
        isInitializing = false;
    });
}

// Initialize the Spotify Web Playback SDK
export const initPlayer = () => {
    if (player || isInitializing) {
        console.log("Player initialization already in progress or completed.");
        return;
    }
    console.log("Initializing Spotify Player...");
    isInitializing = true;

    // If SDK is already loaded, just set up the player
    if (window.Spotify) {
        doInitPlayer();
        return;
    }

    // Otherwise, set up the callback
    window.onSpotifyWebPlaybackSDKReady = doInitPlayer;

    // And load the script if it's not already on the page
    if (!document.getElementById('playerSDK')) {
        loadSDK();
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

// Export functions and getters for external use
export { loadSDK };
export const getPlayerReady = () => playerReady;
export const getDeviceId = () => deviceId;
export const searchAlbums = async (query) => {
    const token = getAccessToken();
    if (!token || !query) return [];

    try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=20`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to search for albums');
        }

        const data = await response.json();
        return data.albums ? data.albums.items : [];
    } catch (error) {
        console.error('Error searching albums:', error);
        return [];
    }
};

export const getAlbumDetails = async (albumId) => {
    const token = getAccessToken();
    if (!token) return null;

    try {
        const response = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch album details for ID ${albumId}`);
        }

        const album = await response.json();
        
        // Handle track pagination, which is crucial
        if (album.tracks && album.tracks.next) {
            let tracks = album.tracks.items;
            let nextUrl = album.tracks.next;
            while (nextUrl) {
                const tracksResponse = await fetch(nextUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!tracksResponse.ok) break; // Stop if we hit an error
                const tracksData = await tracksResponse.json();
                tracks = tracks.concat(tracksData.items);
                nextUrl = tracksData.next;
            }
            album.tracks.items = tracks;
        }
        
        return album;

    } catch (error) {
        console.error('Error getting album details:', error);
        return null;
    }
};