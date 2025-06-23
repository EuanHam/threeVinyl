import { useEffect, useState } from 'react';
import { getAccessToken, getTopAlbums, initPlayer, getUserProfile, playAlbum } from '../src/spotifyAuth';
import { User } from '../src/models';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [libraryAlbums, setLibraryAlbums] = useState([]);
  const [topAlbums, setTopAlbums] = useState([]); // For onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);

  // Effect to initialize the app and handle user authentication
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
          await currentUser.loadLibrary(); // Now an async operation
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

  const handleAddAlbumToLibrary = async (albumData) => {
    if (user) {
      const album = user.library.addAlbum(albumData);
      await user.saveLibrary(); // Now an async operation
      const updatedLibrary = user.library.getAllAlbums();
      setLibraryAlbums(updatedLibrary);
      setTopAlbums(topAlbums.filter(a => a.id !== albumData.id));
      // Dispatch a custom event with the updated library
      window.dispatchEvent(new CustomEvent('libraryUpdated', { detail: updatedLibrary }));
      // Select the newly added album automatically
      setSelectedAlbum(album);
    }
  };

  const handleSelectAlbum = (album) => {
    setSelectedAlbum(album);
    console.log(`Selected album:`, album.spotifyData.name);
  };

  const handlePlaySide = (sideLetter) => {
    if (selectedAlbum) {
      console.log(`Requesting to play Side ${sideLetter} of ${selectedAlbum.spotifyData.name}`);
      // Tell the 3D scene to start its animation immediately
      window.dispatchEvent(new CustomEvent('playbackInitiated'));
      // Call the actual playback function
      playAlbum(selectedAlbum, sideLetter);
    }
  };

  const handleFinishOnboarding = () => {
    setShowOnboarding(false);
  };

  const renderSideButtons = () => {
    if (!selectedAlbum) return null;

    const sideButtons = [];
    selectedAlbum.discs.forEach((disc, discIndex) => {
      const sideALetter = String.fromCharCode('A'.charCodeAt(0) + discIndex * 2);
      const sideBLetter = String.fromCharCode('A'.charCodeAt(0) + discIndex * 2 + 1);

      if (disc.A && disc.A.tracks.length > 0) {
        sideButtons.push(
          <button key={sideALetter} onClick={() => handlePlaySide(sideALetter)} className="side-button">
            Side {sideALetter}
          </button>
        );
      }
      if (disc.B && disc.B.tracks.length > 0) {
        sideButtons.push(
          <button key={sideBLetter} onClick={() => handlePlaySide(sideBLetter)} className="side-button">
            Side {sideBLetter}
          </button>
        );
      }
    });

    return <div className="side-buttons-container">{sideButtons}</div>;
  };

  return (
    <div>
      <style jsx global>{`
        .side-button {
          background-color: #282828;
          border: 1px solid #404040;
          color: white;
          padding: 8px 16px;
          margin: 4px;
          border-radius: 20px;
          cursor: pointer;
          font-weight: bold;
          transition: background-color 0.2s;
        }
        .side-button:hover {
          background-color: #383838;
        }
        .side-buttons-container {
          margin-top: 12px;
        }
        .selected-album-view {
          background-color: rgba(20, 20, 20, 0.85);
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #333;
          margin-top: 16px;
        }
        .library-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 16px;
          margin-top: 12px;
        }
        .library-item {
          background-color: #1e1e1e;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
          cursor: pointer;
          transition: transform 0.2s, background-color 0.2s;
        }
        .library-item:hover {
          transform: translateY(-2px);
          background-color: #2c2c2c;
        }
        .library-item.selected {
          border: 2px solid #1db954;
          background-color: #2a2a2a;
        }
      `}</style>
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
            
            <div className="library-grid">
              {libraryAlbums.map((album) => (
                <div 
                  key={album.id} 
                  className={`library-item ${selectedAlbum?.id === album.id ? 'selected' : ''}`} 
                  onClick={() => handleSelectAlbum(album)}
                >
                  <img src={album.spotifyData.images[0]?.url} alt={album.spotifyData.name} />
                  <p>{album.spotifyData.name}</p>
                </div>
              ))}
            </div>

            {selectedAlbum ? (
              <div className="selected-album-view">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <img
                    src={selectedAlbum.spotifyData.images[0]?.url}
                    alt={selectedAlbum.spotifyData.name}
                    style={{ width: '60px', height: '60px', marginRight: '12px', borderRadius: '4px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{selectedAlbum.spotifyData.name}</div>
                    <div style={{ fontSize: '14px', opacity: 0.8 }}>{selectedAlbum.spotifyData.artists[0].name}</div>
                  </div>
                </div>
                {renderSideButtons()}
              </div>
            ) : (
              libraryAlbums.length > 0 && <p>Your library is ready. Select an album to begin.</p>
            )}

            {libraryAlbums.length === 0 && !showOnboarding && (
                <p>Your library is empty. Find some albums to add!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}