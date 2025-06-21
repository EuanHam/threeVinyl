// Spotify Web API functions
import { getAccessToken } from './auth.js';
import { getDeviceId, isWebPlayerEnabled, webPlayerTogglePlay } from './webPlayer.js';

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
    console.log('Playing song with token:', token);
    if (!token) {
        console.error('Access token is missing. Please authenticate first.');
        return;
    }

    try {
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
        console.log('Top tracks response:', data);
        if (!data.items || data.items.length === 0) {
            console.error('No top tracks found.');
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * data.items.length);
        const songUri = data.items[randomIndex].uri;
        console.log('Playing song:', songUri);

        // Try web player first, fall back to regular API
        if (isWebPlayerEnabled()) {
            try {
                return await playOnWebPlayer([songUri]);
            } catch (error) {
                console.warn('Web player song playback failed, falling back to regular API:', error);
                alert('Web player not ready yet, using your active device instead. If no music starts, please start playing something on Spotify first.');
                return await playOnActiveDevice([songUri]);
            }
        } else {
            return await playOnActiveDevice([songUri]);
        }
    } catch (error) {
        console.error('Error playing song:', error);
        alert('Failed to play song. Please try again or check your Spotify connection.');
    }
};

export const playAlbum = async (albumUri) => {
    const token = getAccessToken();
    if (!token) {
        console.error('Access token is missing. Please authenticate first.');
        return;
    }

    console.log('Attempting to play album:', albumUri);

    try {
        // Try web player first, but with enhanced error handling for albums
        if (isWebPlayerEnabled()) {
            try {
                return await playAlbumOnWebPlayer(albumUri);
            } catch (error) {
                console.warn('Web player album playback failed, falling back to regular API:', error);
                alert('Web player not ready yet, using your active device instead. If no music starts, please start playing something on Spotify first.');
                return await playOnActiveDevice(null, albumUri);
            }
        } else {
            return await playOnActiveDevice(null, albumUri);
        }
    } catch (error) {
        console.error('Error playing album:', error);
        alert('Failed to play album. Please try again or check your Spotify connection.');
    }
};

export const togglePlayPause = async () => {
    const token = getAccessToken();
    if (!token) {
        console.error('Access token is missing. Please authenticate first.');
        return;
    }

    try {
        // Try web player first
        if (isWebPlayerEnabled()) {
            return webPlayerTogglePlay();
        } else {
            return togglePlayPauseOnActiveDevice();
        }
    } catch (error) {
        console.error('Error toggling play/pause:', error);
    }
};

// Web Player playback functions
const playOnWebPlayer = async (uris = null, contextUri = null) => {
    const token = getAccessToken();
    const deviceId = getDeviceId();
    
    if (!deviceId) {
        console.error('Web player device ID not available');
        throw new Error('Web player device ID not available');
    }

    console.log('Playing on web player - URIs:', uris, 'Context:', contextUri, 'Device:', deviceId);

    // First, ensure the device is active by checking devices list with retry
    let webPlayerDevice = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!webPlayerDevice && attempts < maxAttempts) {
        attempts++;
        console.log(`Checking for web player device (attempt ${attempts}/${maxAttempts})...`);
        
        const devices = await getAvailableDevices();
        webPlayerDevice = devices.find(d => d.id === deviceId);
        
        if (!webPlayerDevice && attempts < maxAttempts) {
            console.log('Web player device not found, waiting and retrying...');
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }
    
    if (!webPlayerDevice) {
        console.warn('Web player device not found in devices list after multiple attempts');
        throw new Error('Web player device not found in Spotify devices list - it may not be ready yet');
    }
    
    console.log('Web player device found:', webPlayerDevice);

    // If device is not active, try to transfer playback first
    if (!webPlayerDevice.is_active) {
        console.log('Web player device is not active, transferring playback...');
        try {
            await transferPlaybackToWebPlayer(deviceId, token);
            // Wait a bit for the transfer to complete
            await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (transferError) {
            console.warn('Failed to transfer playback, continuing anyway:', transferError);
        }
    }

    const body = { device_id: deviceId };
    if (uris) {
        body.uris = uris;
    } else if (contextUri) {
        body.context_uri = contextUri;
    }

    try {
        const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (playResponse.status === 401) {
            console.log('Token expired during play request');
            window.localStorage.removeItem('spotify_access_token');
            alert('Your Spotify session has expired. Please press "p" again to re-authenticate.');
            throw new Error('Token expired');
        }

        if (playResponse.status === 404) {
            console.error('Device not found (404) - Web Player device may not be fully initialized');
            console.log('Available devices:', await getAvailableDevices());
            throw new Error('Web Player device not ready (404) - please wait a moment and try again');
        }

        if (!playResponse.ok) {
            const errorData = await playResponse.text();
            console.error('Play request failed:', playResponse.status, errorData);
            throw new Error(`Play request failed: ${playResponse.status} - ${errorData}`);
        } else {
            console.log('Song/Album started successfully on web player');
        }
    } catch (error) {
        console.error('Web player playback error:', error);
        throw error;
    }
};

// Specialized album playback for Web Player with fallback handling
const playAlbumOnWebPlayer = async (albumUri) => {
    const token = getAccessToken();
    const deviceId = getDeviceId();
    
    if (!deviceId) {
        throw new Error('Web player device ID not available');
    }

    console.log('Playing album on web player:', albumUri, 'Device ID:', deviceId);

    // First, try the direct context_uri approach
    try {
        const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                context_uri: albumUri,
                device_id: deviceId 
            })
        });

        if (playResponse.status === 401) {
            window.localStorage.removeItem('spotify_access_token');
            throw new Error('Token expired');
        }

        if (playResponse.ok) {
            console.log('Album started successfully on web player via context_uri');
            return;
        } else {
            const errorData = await playResponse.text();
            console.warn('Direct album play failed:', playResponse.status, errorData);
            throw new Error(`Direct play failed: ${playResponse.status}`);
        }
    } catch (error) {
        console.warn('Context URI method failed, trying track-by-track approach:', error);
        
        // Fallback: Get album tracks and play the first one with album context
        try {
            const albumId = albumUri.split(':')[2]; // Extract ID from spotify:album:id
            const tracksResponse = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=1`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!tracksResponse.ok) {
                throw new Error('Failed to get album tracks');
            }
            
            const tracksData = await tracksResponse.json();
            if (tracksData.items && tracksData.items.length > 0) {
                const firstTrackUri = tracksData.items[0].uri;
                
                // Play the first track with album context
                const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        context_uri: albumUri,
                        offset: { uri: firstTrackUri },
                        device_id: deviceId 
                    })
                });
                
                if (playResponse.ok) {
                    console.log('Album started successfully on web player via track offset');
                    return;
                } else {
                    throw new Error(`Offset play failed: ${playResponse.status}`);
                }
            } else {
                throw new Error('No tracks found in album');
            }
        } catch (trackError) {
            console.error('Track-based fallback also failed:', trackError);
            throw trackError;
        }
    }
};

// Fallback functions for regular Spotify API
const playOnActiveDevice = async (uris = null, contextUri = null) => {
    const token = getAccessToken();
    
    // Check for active devices
    const devices = await getAvailableDevices();
    const activeDevices = devices.filter(device => device.is_active);

    if (activeDevices.length === 0) {
        alert(`No active devices found. Found these devices: ${devices.map(d => d.name).join(', ')}. Please start playing music on one of them first, or wait for the web player to initialize.`);
        return;
    }

    const body = {};
    if (uris) {
        body.uris = uris;
    } else if (contextUri) {
        body.context_uri = contextUri;
    }

    const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
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
        console.log('Song/Album started successfully on active device');
        alert('Started playing!');
    }
};

const togglePlayPauseOnActiveDevice = async () => {
    const token = getAccessToken();
    
    // Check for active devices
    const devices = await getAvailableDevices();
    const activeDevices = devices.filter(device => device.is_active);

    if (activeDevices.length === 0) {
        alert('No active devices found. Please start playing music first or wait for the web player to initialize.');
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
                    uri: album.uri,
                    image: album.images[0]?.url,
                    artist: album.artists[0]?.name
                });
                
                if (albums.length >= 5) break; // Limit to top 5
            }
        }
        
        console.log('Top albums:', albums);
        return albums;
    } catch (error) {
        console.error('Error getting top albums:', error);
        return [];
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
            console.log('Token expired, clearing stored token');
            window.localStorage.removeItem('spotify_access_token');
            return null;
        }

        if (response.status === 204) {
            // No active playback
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting playback state:', error);
        return null;
    }
};
