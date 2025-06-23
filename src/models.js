import { partitionVinylSides } from './utils/partitionVinylSides.js';

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

    // Methods to save/load library to/from localStorage could go here
    saveLibrary() {
        const libraryData = {
            albums: this.library.getAllAlbums().map(album => album.spotifyData)
        };
        localStorage.setItem(`threeify-library-${this.profile.id}`, JSON.stringify(libraryData));
        console.log('Library saved to localStorage.');
    }

    loadLibrary() {
        const savedData = localStorage.getItem(`threeify-library-${this.profile.id}`);
        if (savedData) {
            const libraryData = JSON.parse(savedData);
            libraryData.albums.forEach(albumData => {
                this.library.addAlbum(albumData);
            });
            console.log('Library loaded from localStorage.');
        } else {
            console.log('No saved library found in localStorage.');
        }
    }
}

export { User, Library, Album, Disc, Side };
