# Three.js and Spotify Integration

This project demonstrates a simple application that combines Three.js for 3D rendering and the Spotify Playback SDK for music playback. The application displays a 3D box and allows users to play random top songs from Spotify using keyboard inputs.

## Project Structure

```
threejs-spotify-app
├── public
│   └── index.html        # HTML structure for the application
├── src
│   ├── main.js           # Entry point of the application
│   ├── spotifyAuth.js    # Handles Spotify authentication flow
│   └── threeBox.js       # Three.js logic to create and display a 3D box
├── package.json           # npm configuration file
├── .env                   # Environment variables for sensitive information
└── README.md              # Project documentation
```

## Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd threejs-spotify-app
   ```

2. **Install Dependencies**
   Make sure you have Node.js installed. Then run:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your Spotify credentials:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=your_secure_redirect_uri
   ```

4. **Run the Application**
   Start the application using:
   ```bash
   npm start
   ```

5. **Open in Browser**
   Navigate to `http://localhost:3000` (or the specified port) to view the application.

## Usage

- Press specific keys (as defined in `src/main.js`) to play random top songs from Spotify.
- The 3D box will be displayed using Three.js, providing a visual representation alongside the music playback.

## Notes

- Ensure that your Spotify application is set up correctly in the Spotify Developer Dashboard, and the redirect URI matches the one specified in your `.env` file.
- This project is a basic implementation and can be expanded with additional features such as song selection, volume control, and more advanced Three.js visuals.