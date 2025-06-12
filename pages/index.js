import { useEffect, useState } from 'react';
import { getAccessToken } from '../src/spotifyAuth';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Dynamically import your main logic so it runs only on the client
    import('../src/main');
    // Check for token on mount and after possible redirect
    const checkToken = () => {
      setIsAuthenticated(!!getAccessToken());
    };
    checkToken();

    // Poll for token for a short time after mount (to catch redirect)
    let interval = setInterval(checkToken, 500);
    setTimeout(() => clearInterval(interval), 3000);

    // Listen for storage changes (e.g., after redirect in another tab)
    const onStorage = () => checkToken();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <div>
      <h1 style={{ position: 'absolute', zIndex: 1, color: 'white', margin: 16 }}>
        Three.js Spotify App
        <br />
        {isAuthenticated ? (
          <span style={{ color: '#1db954' }}>✅ Logged in to Spotify!<br />Press "p" to play a random top song.</span>
        ) : (
          <span>Press "p" to authenticate and play a random top song</span>
        )}
      </h1>
    </div>
  );
}
