import { useEffect, useState } from 'react';
import { getAccessToken, getTopAlbums, initPlayer, getUserProfile } from '../src/spotifyAuth';
import { User } from '../src/models';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [libraryAlbums, setLibraryAlbums] = useState([]);
  const [topAlbums, setTopAlbums] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Await the dynamic import to ensure main.js is loaded and its event listeners are active
      // before we proceed with any logic that might dispatch events.
      await import('../src/main');

      const hasToken = !!getAccessToken();
      setIsAuthenticated(hasToken);

      if (hasToken) {
        initPlayer(); // Initialize the Web Playback SDK
        const profile = await getUserProfile();
        if (profile) {
          const currentUser = new User(profile);
          currentUser.loadLibrary();
          setUser(currentUser);
          const loadedLibraryAlbums = currentUser.library.getAllAlbums();
          setLibraryAlbums(loadedLibraryAlbums);

          // Dispatch a custom event with the user's library.
          // The listener in main.js is now guaranteed to be ready.
          window.dispatchEvent(new CustomEvent('libraryUpdated', { detail: loadedLibraryAlbums }));

          if (loadedLibraryAlbums.length === 0) {
            console.log("Empty library, fetching top albums for onboarding.");
            const albums = await getTopAlbums();
            setTopAlbums(albums);
            setShowOnboarding(true);
          }
        }
      }
    };

    init();

    // A storage event in another tab (like logging out) should trigger a reload 
    // to ensure a clean state, rather than trying to re-run init.
    const onStorage = () => {
        console.log("Storage changed, reloading page to sync state.");
        window.location.reload();
    };
    window.addEventListener('storage', onStorage);
    
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const handleAddAlbumToLibrary = (albumData) => {
    if (user) {
      user.library.addAlbum(albumData);
      user.saveLibrary();
      const updatedLibrary = user.library.getAllAlbums();
      setLibraryAlbums(updatedLibrary);
      setTopAlbums(topAlbums.filter(a => a.id !== albumData.id));
      // Dispatch a custom event with the updated library
      window.dispatchEvent(new CustomEvent('libraryUpdated', { detail: updatedLibrary }));
    }
  };

  const handleFinishOnboarding = () => {
    setShowOnboarding(false);
  };

  return (
    <div>
      <div style={{ position: 'absolute', zIndex: 1, color: 'white', margin: 16, fontFamily: 'Arial, sans-serif', maxWidth: '350px' }}>
        <h1>Threeify</h1>
        {!isAuthenticated && <p>Press "p" to authenticate and play music</p>}
        
        {isAuthenticated && !user && <p>Loading user profile...</p>}

        {user && showOnboarding && (
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(20,20,20,0.95)', padding: '30px', borderRadius: '15px',
            color: 'white', zIndex: 100, textAlign: 'center', border: '1px solid #333',
            maxHeight: '80vh', overflowY: 'auto'
          }}>
            <h2>Welcome to Threeify!</h2>
            <p style={{ opacity: 0.8, marginBottom: '25px' }}>Here are some of your top albums. Add them to your virtual shelf to get started.</p>
            <div>
              {topAlbums.map(album => (
                <div key={album.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', textAlign: 'left' }}>
                  <img src={album.images[0]?.url} alt={album.name} style={{ width: '50px', height: '50px', marginRight: '15px', borderRadius: '4px' }} />
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{album.name}</div>
                    <div style={{ fontSize: '14px', opacity: 0.7 }}>{album.artists[0].name}</div>
                  </div>
                  <button onClick={() => handleAddAlbumToLibrary(album)} style={{
                    background: '#1db954', color: 'white', border: 'none', padding: '8px 12px',
                    borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold'
                  }}>Add</button>
                </div>
              ))}
            </div>
            <button onClick={handleFinishOnboarding} style={{
              marginTop: '20px', background: '#555', color: 'white', border: 'none',
              padding: '10px 20px', borderRadius: '20px', cursor: 'pointer'
            }}>Done</button>
          </div>
        )}

        {user && !showOnboarding && (
          <div>
            <p style={{ color: '#1db954' }}>✅ Logged in as {user.profile.display_name}!</p>
            <p>Press "p" to play a random top song.</p>
            {libraryAlbums.length > 0 ? (
              <div>
                <h3>Your Library (Press 1-5 to play):</h3>
                {libraryAlbums.slice(0, 5).map((album, index) => (
                  <div key={album.spotifyData.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px', fontWeight: 'bold' }}>{index + 1}.</span>
                    <img
                      src={album.spotifyData.images[0]?.url}
                      alt={album.spotifyData.name}
                      style={{ width: '40px', height: '40px', marginRight: '8px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{album.spotifyData.name}</div>
                      <div style={{ fontSize: '12px', opacity: 0.8 }}>{album.spotifyData.artists[0].name}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>Your library is empty. Find some albums to add!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}