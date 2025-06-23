import { partitionVinylSides } from './utils/partitionVinylSides.js';
import { db } from './firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Represents a single side of a vinyl record.
 */
class Side {
    constructor(tracks = []) {
        this.tracks = tracks;
        this.duration = tracks.reduce((sum, track) => sum + track.duration_ms, 0);
    }
}

/**
 * Represents a single vinyl disc with two sides.
 */
class Disc {
    constructor(sideA, sideB) {
        this.A = sideA;
        this.B = sideB;
    }
}

/**
 * Represents an album, which can contain multiple discs.
 */
class Album {
    constructor(spotifyAlbumData) {
        this.spotifyData = spotifyAlbumData;
        this.discs = [];
        this.partitionTracksIntoDiscs();
    }

    partitionTracksIntoDiscs() {
        if (!this.spotifyData.tracks || !this.spotifyData.tracks.items) {
            console.error('Album data is missing tracks:', this.spotifyData);
            return;
        }

        const tracks = this.spotifyData.tracks.items;
        const sidesAsTrackArrays = partitionVinylSides(tracks);

        const sides = sidesAsTrackArrays.map(trackArray => new Side(trackArray));

        for (let i = 0; i < sides.length; i += 2) {
            const sideA = sides[i];
            const sideB = (i + 1 < sides.length) ? sides[i + 1] : new Side(); // Create empty side B if needed
            const disc = new Disc(sideA, sideB);
            this.discs.push(disc);
        }
    }

    getSide(sideLetter) {
        const sideIndex = sideLetter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
        const discIndex = Math.floor(sideIndex / 2);
        const sideInDisc = sideIndex % 2 === 0 ? 'A' : 'B';

        if (this.discs[discIndex] && this.discs[discIndex][sideInDisc]) {
            return this.discs[discIndex][sideInDisc];
        }
        return null;
    }
}

/**
 * Represents the user's music library.
 */
class Library {
    constructor() {
        this.albums = new Map(); // Use a map for easier access by ID
        this.playlists = []; // For future use
    }

    addAlbum(spotifyAlbumData) {
        if (!this.albums.has(spotifyAlbumData.id)) {
            const album = new Album(spotifyAlbumData);
            this.albums.set(album.spotifyData.id, album);
            console.log(`Album "${album.spotifyData.name}" added to library.`);
            return album;
        }
        console.log(`Album "${spotifyAlbumData.name}" is already in the library.`);
        return this.albums.get(spotifyAlbumData.id);
    }

    removeAlbum(albumId) {
        if (this.albums.has(albumId)) {
            const albumName = this.albums.get(albumId).spotifyData.name;
            this.albums.delete(albumId);
            console.log(`Album "${albumName}" removed from library.`);
            return true;
        }
        console.log(`Album with ID "${albumId}" not found in library.`);
        return false;
    }

    getAlbum(albumId) {
        return this.albums.get(albumId);
    }

    getAllAlbums() {
        return Array.from(this.albums.values());
    }
}

/**
 * Represents the current user.
 */
class User {
    constructor(spotifyProfile) {
        this.profile = spotifyProfile;
        this.library = new Library();
    }

    // Methods to save/load library to/from Firestore
    async saveLibrary() {
        if (!this.profile || !this.profile.id) {
            console.error("Cannot save library: user profile or ID is missing.");
            return;
        }
        const libraryRef = doc(db, 'libraries', this.profile.id);
        
        // Create a lean version of the library data to minimize storage
        const libraryData = {
            albums: this.library.getAllAlbums().map(album => {
                const spotifyData = album.spotifyData;
                return {
                    id: spotifyData.id,
                    name: spotifyData.name,
                    uri: spotifyData.uri,
                    artist: spotifyData.artists[0]?.name || 'Unknown Artist',
                    image: spotifyData.images[0]?.url || null,
                    tracks: spotifyData.tracks.items.map(track => ({
                        uri: track.uri,
                        duration_ms: track.duration_ms,
                        name: track.name,
                        track_number: track.track_number
                    }))
                };
            })
        };

        try {
            await setDoc(libraryRef, libraryData);
            console.log('Lean library saved to Firestore.');
        } catch (error) {
            console.error("Error saving library to Firestore:", error);
        }
    }

    async loadLibrary() {
        if (!this.profile || !this.profile.id) {
            console.error("Cannot load library: user profile or ID is missing.");
            return;
        }
        const libraryRef = doc(db, 'libraries', this.profile.id);
        try {
            const docSnap = await getDoc(libraryRef);
            if (docSnap.exists()) {
                const libraryData = docSnap.data();
                if (libraryData.albums) {
                    libraryData.albums.forEach(minimalAlbumData => {
                        // Rehydrate the minimal data into the structure the Album class expects
                        const rehydratedAlbumData = {
                            ...minimalAlbumData,
                            artists: [{ name: minimalAlbumData.artist }],
                            images: [{ url: minimalAlbumData.image }],
                            tracks: {
                                items: minimalAlbumData.tracks
                            }
                        };
                        this.library.addAlbum(rehydratedAlbumData);
                    });
                }
                console.log('Library loaded from Firestore and rehydrated.');
            } else {
                console.log('No saved library found in Firestore for this user.');
            }
        } catch (error) {
            console.error("Error loading library from Firestore:", error);
        }
    }
}

export { User, Library, Album, Disc, Side };
