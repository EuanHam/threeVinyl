import { useEffect, useState } from 'react';
import { getAccessToken, getTopAlbums } from '../src/spotify/index';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [topAlbums, setTopAlbums] = useState([]);

  useEffect(() => {
    // Dynamically import your main logic so it runs only on the client
    import('../src/main');
    
    const checkToken = async () => {
      const hasToken = !!getAccessToken();
      setIsAuthenticated(hasToken);
      
      if (hasToken) {
        const albums = await getTopAlbums();
        setTopAlbums(albums);
      }
    };
    
    checkToken();

    // Listen for albums being loaded from main.js
    const onAlbumsLoaded = (event) => {
      setTopAlbums(event.detail);
    };
    window.addEventListener('albumsLoaded', onAlbumsLoaded);

    // Poll for token for a short time after mount (to catch redirect)
    let interval = setInterval(checkToken, 500);
    setTimeout(() => clearInterval(interval), 3000);

    // Listen for storage changes (e.g., after redirect in another tab)
    const onStorage = () => checkToken();
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('albumsLoaded', onAlbumsLoaded);
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <div style={{ position: 'absolute', zIndex: 1, color: 'white', margin: 16, fontFamily: 'Arial, sans-serif' }}>
        <h1>Threeify</h1>
        {isAuthenticated ? (
          <div>
            <p style={{ color: '#1db954' }}>✅ Logged in to Spotify!</p>
            <p>Press "p" to play a random top song</p>
            {topAlbums.length > 0 && (
              <div>
                <h3>Your Top Albums (Press 1-5 to play):</h3>
                {topAlbums.map((album, index) => (
                  <div key={album.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px', fontWeight: 'bold' }}>{index + 1}.</span>
                    {album.image && (
                      <img
                        src={album.image}
                        alt={album.name}
                        style={{ width: '40px', height: '40px', marginRight: '8px' }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{album.name}</div>
                      <div style={{ fontSize: '12px', opacity: 0.8 }}>{album.artist}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p>Press "p" to authenticate and play music</p>
        )}
      </div>
    </div>
  );
}
