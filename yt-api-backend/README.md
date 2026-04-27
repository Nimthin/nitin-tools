# YouTube Audio API — Backend

A lightweight Python API that extracts audio stream URLs from YouTube using `yt-dlp`.

## How it works
1. Your website sends a YouTube URL to this API
2. The API uses `yt-dlp` to get all available audio streams
3. Returns direct download URLs — your browser downloads directly from YouTube's servers
4. No files are stored on the server

## Deploy to Render (Free)

### Step 1: Create a GitHub repo
1. Go to [github.com/new](https://github.com/new)
2. Name it `yt-audio-api` (or anything)
3. Make it **private**
4. Push this folder's contents to it:
   ```bash
   cd yt-api-backend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/yt-audio-api.git
   git push -u origin main
   ```

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com) and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Name**: `yt-audio-api`
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Plan**: `Free`
5. Click **Deploy**

### Step 3: Update your website
Once deployed, Render gives you a URL like `https://yt-audio-api-xxxx.onrender.com`.

Update the API URL in your website's code:
- File: `tools-logic/youtubeAudioDownloader.js`
- Change the fetch URL to your Render URL

## API Endpoints

### `GET /`
Health check. Returns `{ "status": "ok" }`

### `POST /extract`
Extract audio streams from a YouTube video.

**Request:**
```json
{ "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
```

**Response:**
```json
{
  "status": "success",
  "title": "Video Title",
  "author": "Channel Name",
  "duration": 212,
  "thumbnail": "https://...",
  "availableQualities": [
    { "bitrate": 160, "ext": "webm", "codec": "opus", "url": "https://...", "size": 3.2 }
  ]
}
```
