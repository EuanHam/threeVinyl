// Authentication related functions
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

    // Include streaming scope for Web Playback SDK
    const scope = 'user-read-playback-state user-modify-playback-state user-top-read user-read-private streaming';

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
    console.log('handleRedirect called, code:', code);
    
    if (code) {
        const codeVerifier = window.localStorage.getItem('spotify_code_verifier');
        console.log('Code verifier:', codeVerifier);
        
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
                
                // Initialize the Web Player after successful authentication
                const { initializeWebPlayer } = await import('./webPlayer.js');
                initializeWebPlayer(data.access_token);
                
                return true; // Success
            } else {
                console.error('Failed to get access token:', data);
                return false;
            }
        } catch (error) {
            console.error('Error during token exchange:', error);
            return false;
        }
    }
    return false;
};

export const getAccessToken = () => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('spotify_access_token') || '';
};
