// Web Playback SDK integration
let player = null;
let deviceId = null;
let playerReady = false;
let isWebPlayerActive = false;

// Load Spotify Web Playback SDK
export const loadSDK = () => {
    console.log('=== LOADING SPOTIFY SDK ===');
    
    if (window.Spotify) {
        console.log('Spotify SDK already loaded');
        return Promise.resolve();
    }

    const existingScript = document.getElementById('playerSDK');
    if(existingScript) {
        console.log('SDK script already exists, removing and reloading');
        existingScript.remove();
    }

    return new Promise((resolve, reject) => {
        // Set up the global callback first
        window.onSpotifyWebPlaybackSDKReady = () => {
            console.log('=== SPOTIFY SDK READY CALLBACK TRIGGERED ===');
            resolve();
        };

        const script = document.createElement('script');
        script.id = 'playerSDK';
        script.type = 'text/javascript';
        script.async = true;
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        
        script.onload = () => {
            console.log("Spotify SDK script loaded successfully");
            // Don't resolve here, wait for the SDK ready callback
        };
        
        script.onerror = (error) => {
            console.error("Failed to load Spotify SDK script:", error);
            reject(error);
        };

        document.head.appendChild(script);
        
        // Timeout fallback
        setTimeout(() => {
            if (!window.Spotify) {
                console.error('Spotify SDK failed to load within 10 seconds');
                reject(new Error('SDK load timeout'));
            }
        }, 10000);
    });
};

// Initialize the Spotify Web Playback SDK
export const initializeWebPlayer = async (token) => {
    if (!token) {
        console.error('Cannot initialize web player: no token provided');
        return;
    }
    
    console.log('=== STARTING WEB PLAYER INITIALIZATION ===');
    console.log('Token provided:', !!token);

    try {
        // Load SDK and wait for it to be ready
        await loadSDK();
        
        console.log('SDK loaded, window.Spotify available:', !!window.Spotify);
        
        // Now initialize the player
        initPlayer(token);
        
    } catch (error) {
        console.error('Failed to load SDK:', error);
        isWebPlayerActive = false;
        alert('Failed to load Spotify Web Player SDK. Falling back to regular API - you\'ll need Spotify open on another device.');
    }
};

const initPlayer = (token) => {
    console.log('=== INITIALIZING SPOTIFY WEB PLAYER ===');
    
    // Notify UI that web player is initializing
    window.dispatchEvent(new CustomEvent('webPlayerInitializing'));
    
    if (!window.Spotify) {
        console.error('window.Spotify is not available when trying to initialize player');
        isWebPlayerActive = false;
        return;
    }
    
    console.log('Creating new Spotify.Player with token:', !!token);
    
    player = new Spotify.Player({
        name: 'ThreeVinyl Player',
        getOAuthToken: cb => { cb(token); },
        volume: 0.8
    });

    console.log('Player created:', !!player);

        // Error handling with fallback
        player.addListener('initialization_error', ({ message }) => { 
            console.error('Initialization error:', message); 
            isWebPlayerActive = false;
            alert('Web Player initialization failed. Falling back to regular Spotify API - you\'ll need Spotify open on another device.');
        });
        
        player.addListener('authentication_error', ({ message }) => { 
            console.error('Authentication error:', message);
            isWebPlayerActive = false;
            alert('Web Player authentication failed. Falling back to regular Spotify API - you\'ll need Spotify open on another device.');
        });
        
        player.addListener('account_error', ({ message }) => { 
            console.error('Account error:', message);
            isWebPlayerActive = false;
            alert('Account error: ' + message + '. Web Playback SDK requires Spotify Premium. Falling back to regular API - you\'ll need Spotify open on another device.');
        });
        
        player.addListener('playback_error', ({ message }) => { 
            console.error('Playback error:', message); 
        });

        // Playback status updates
        player.addListener('player_state_changed', state => {
            if(!state) {
                console.log('Player state is null - player might be paused');
                // Dispatch event for UI updates
                window.dispatchEvent(new CustomEvent('playerStateChanged', { 
                    detail: { 
                        isPlaying: false,
                        track: null 
                    } 
                }));
                return;
            }
            
            console.log('Player state changed:', state);
            // Dispatch custom event for main.js to listen to
            window.dispatchEvent(new CustomEvent('playerStateChanged', { 
                detail: { 
                    isPlaying: !state.paused,
                    track: state.track_window.current_track,
                    position: state.position,
                    duration: state.duration
                } 
            }));
        });

        // Ready
        player.addListener('ready', ({ device_id }) => {
            console.log('Web Player ready with Device ID:', device_id);
            deviceId = device_id;
            playerReady = true;
            isWebPlayerActive = true;
            
            // Transfer playback to this device
            transferPlayback(token, device_id);
            
            // Notify that web player is ready
            window.dispatchEvent(new CustomEvent('webPlayerReady', { 
                detail: { deviceId: device_id } 
            }));
        });

        // Not Ready
        player.addListener('not_ready', ({ device_id }) => {
            console.log('Web Player device has gone offline:', device_id);
            playerReady = false;
            isWebPlayerActive = false;
        });

        // Connect to the player
        console.log('Attempting to connect to Spotify Web Player...');
        player.connect().then(success => {
            if (success) {
                console.log('Successfully connected to Spotify Web Player');
            } else {
                console.error('Failed to connect to Spotify Web Player - this usually means:');
                console.error('1. No Spotify Premium account');
                console.error('2. Browser not supported');
                console.error('3. Network connectivity issues');
                isWebPlayerActive = false;
                alert('Failed to connect to Spotify Web Player. This requires Spotify Premium. Falling back to regular API - you\'ll need Spotify open on another device.');
            }
        }).catch(error => {
            console.error('Error connecting to Spotify Web Player:', error);
            isWebPlayerActive = false;
            alert('Error connecting to Spotify Web Player: ' + error.message + '. Falling back to regular API - you\'ll need Spotify open on another device.');
        });

        window.player = player;
};

// Transfer playback to our virtual device
const transferPlayback = async (accessToken, deviceId) => {
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

// Web Player control functions
export const webPlayerTogglePlay = () => {
    if (player && playerReady) {
        return player.togglePlay();
    }
    return Promise.reject('Player not ready');
};

export const webPlayerPlay = () => {
    if (player && playerReady) {
        return player.resume();
    }
    return Promise.reject('Player not ready');
};

export const webPlayerPause = () => {
    if (player && playerReady) {
        return player.pause();
    }
    return Promise.reject('Player not ready');
};

// Getters
export const getDeviceId = () => deviceId;
export const isPlayerReady = () => playerReady;
export const isWebPlayerEnabled = () => {
    console.log('Checking if web player is enabled:', {
        isWebPlayerActive,
        playerReady,
        deviceId,
        hasSpotifySDK: !!window.Spotify
    });
    return isWebPlayerActive;
};
