# Threeify

This project is an online record player using Spotify's Playback SDK while being visualized using Three.js

## Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/EuanHam/threeVinyl.git
   cd threejs-spotify-app
   ```

2. **Install Dependencies**
   Install Node.js. Then run:
   ```bash
   npm install
   ```

3. **Configure the Environment**
   Create a `.env.local` file in the root directory and add your Spotify client ID. This information can be accessed by logging into Spotify's developer dashboard (https://developer.spotify.com/) and creating an app. Set the redirect URI as 'http://127.0.0.1:3000/auth/callback'
   ```
   NEXT_PUBLIC_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   NEXT_PUBLIC_REDIRECT_URI=http://127.0.0.1:3000/auth/callback
   ```

4. **Run the Application**
   Start the application using:
   ```bash
   npm run dev
   ```

5. **Open in Browser**
   Navigate to `http://localhost:3000`

## Usage
- This guide will assume you are using this on a Windows or MacOS device.
- Press p to authenticate with Spotify (now only requires authentication once!). The app should indicate that you are signed in.
- The app now creates a virtual Spotify player, so you no longer need to have the Spotify app open or any other device active.
- After authentication, pressing p will allow you to play a random top song.
- The 1-5 keys will allow you play your top 5 albums respectively.
- You can pause and resume songs using the space bar (note: it may take a second to respond because this app is supposed to simulate a record player)