import { useEffect, useState } from 'react';
import { getAccessToken, getTopAlbums, initPlayer, getUserProfile, playAlbum, getCurrentPlaybackState } from '../src/spotifyAuth';
import { User } from '../src/models';

const formatDuration = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [libraryAlbums, setLibraryAlbums] = useState([]);
  const [topAlbums, setTopAlbums] = useState([]); // For onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [playingAlbum, setPlayingAlbum] = useState(null);
  const [playbackState, setPlaybackState] = useState(null);
  const [playingSide, setPlayingSide] = useState(null);

  // Effect to poll for playback state
  useEffect(() => {
    const interval = setInterval(async () => {
      if (getAccessToken()) {
        const state = await getCurrentPlaybackState();
        setPlaybackState(state);
        if (state && !state.is_playing) {
          setPlayingAlbum(null);
          setPlayingSide(null);
        }
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, []);

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

  const handleSelectAlbum = (album) => {
    setSelectedAlbum(album);
    console.log(`Selected album:`, album.spotifyData.name);
  };

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

  const handlePlaySide = (sideLetter) => {
    if (selectedAlbum) {
      console.log(`Requesting to play Side ${sideLetter} of ${selectedAlbum.spotifyData.name}`);
      // Tell the 3D scene to start its animation immediately
      window.dispatchEvent(new CustomEvent('playbackInitiated'));
      // Call the actual playback function
      playAlbum(selectedAlbum, sideLetter);
      setPlayingSide(sideLetter);
      setPlayingAlbum(selectedAlbum);
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
          /* No margin needed here anymore */
        }
        .bottom-controls-container {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10;
            background-color: rgba(20, 20, 20, 0.9);
            padding: 10px 20px;
            border-radius: 25px;
            border: 1px solid #333;
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .selected-album-info {
          display: flex;
          align-items: center;
          gap: 12px;
          color: white;
        }
        .selected-album-info img {
          width: 40px;
          height: 40px;
          border-radius: 4px;
        }
        .selected-album-info div {
          display: flex;
          flex-direction: column;
        }
        .selected-album-info strong {
          font-weight: bold;
        }
        .selected-album-info span {
          font-size: 12px;
          opacity: 0.8;
        }
        .library-list {
          max-height: 350px;
          overflow-y: auto;
          margin-top: 16px;
          padding-right: 10px; /* For scrollbar */
        }
        .album-card {
          background-color: #282828;
          border: 1px solid #404040;
          padding: 12px;
          margin-bottom: 8px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: background-color 0.2s, border-color 0.2s;
        }
        .album-card:hover {
          background-color: #383838;
        }
        .album-card.selected {
          background-color: #555;
          border-color: #555;
        }
        .album-card-art {
          width: 50px;
          height: 50px;
          border-radius: 4px;
          margin-right: 12px;
        }
        .album-card-info {
          flex-grow: 1;
        }
        .album-card-info div {
          font-weight: bold;
        }
        .album-card-info span {
          font-size: 14px;
          opacity: 0.8;
        }
        .now-playing-container {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          color: white;
          background-color: rgba(20, 20, 20, 0.9);
          padding: 15px 25px;
          border-radius: 15px;
          border: 1px solid #333;
          text-align: center;
          width: 400px;
        }
        .now-playing-container h3 {
          margin: 0 0 5px 0;
          font-size: 16px;
        }
        .now-playing-container p {
          margin: 0 0 15px 0;
          font-size: 14px;
          opacity: 0.8;
        }
        .track-list {
          list-style: none;
          padding: 0;
          margin: 0;
          text-align: left;
        }
        .track-list li {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 14px;
        }
        .track-list .track-name {
          opacity: 0.9;
        }
        .track-list .track-duration {
          opacity: 0.7;
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
            
            <div className="library-list">
              {libraryAlbums.map((album) => (
                <div 
                  key={album.id} 
                  className={`album-card ${selectedAlbum?.id === album.id ? 'selected' : ''}`}
                  onClick={() => handleSelectAlbum(album)}
                >
                  <img 
                    src={album.spotifyData.images[2]?.url || album.spotifyData.images[0]?.url} 
                    alt={album.spotifyData.name} 
                    className="album-card-art"
                  />
                  <div className="album-card-info">
                    <div>{album.spotifyData.name}</div>
                    <span>{album.spotifyData.artists[0].name}</span>
                  </div>
                </div>
              ))}
            </div>

            {libraryAlbums.length > 0 && !selectedAlbum && (
                <p style={{marginTop: '16px'}}>Select an album from your library to begin.</p>
            )}

            {libraryAlbums.length === 0 && !showOnboarding && (
                <p>Your library is empty. Find some albums to add!</p>
            )}
          </div>
        )}
      </div>

      {playbackState && playbackState.is_playing && playingAlbum && playingSide && (
        <div className="now-playing-container">
          <h3>Now Playing: {playingAlbum.spotifyData.name}</h3>
          <p>By {playingAlbum.spotifyData.artists[0].name} - Side {playingSide}</p>
          <ul className="track-list">
            {playingAlbum.getSide(playingSide).tracks.map((track, index) => (
              <li key={track.id}>
                <span className="track-name">{index + 1}. {track.name}</span>
                <span className="track-duration">{formatDuration(track.duration_ms)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedAlbum && (
        <div className="bottom-controls-container">
            <div className="selected-album-info">
              <img 
                src={selectedAlbum.spotifyData.images[2]?.url || selectedAlbum.spotifyData.images[0]?.url} 
                alt={selectedAlbum.spotifyData.name} 
              />
              <div>
                <strong>{selectedAlbum.spotifyData.name}</strong>
                <span>{selectedAlbum.spotifyData.artists[0].name}</span>
              </div>
            </div>
            {renderSideButtons()}
        </div>
      )}
    </div>
  );
}