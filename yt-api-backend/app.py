from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import uuid
import glob

app = Flask(__name__)
CORS(app)

TEMP_DIR = os.path.join(os.path.dirname(__file__), 'temp')
os.makedirs(TEMP_DIR, exist_ok=True)

def cleanup_old_files():
    """Remove temp files older than 5 minutes"""
    import time
    for f in glob.glob(os.path.join(TEMP_DIR, '*')):
        if time.time() - os.path.getmtime(f) > 300:
            try:
                os.remove(f)
            except:
                pass

@app.route('/', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'yt-audio-api'})

@app.route('/info', methods=['POST'])
def get_info():
    """Get video info only (fast)"""
    data = request.get_json()
    url = data.get('url', '')

    if not url:
        return jsonify({'status': 'error', 'message': 'URL is required'}), 400

    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'impersonate': 'chrome',
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        thumbnails = info.get('thumbnails', [])
        thumbnail = thumbnails[-1]['url'] if thumbnails else None

        return jsonify({
            'status': 'success',
            'title': info.get('title', 'Unknown'),
            'author': info.get('uploader', info.get('channel', 'Unknown')),
            'duration': info.get('duration', 0),
            'thumbnail': thumbnail,
        })

    except Exception as e:
        print(f"Info error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/download', methods=['POST'])
def download_mp3():
    """Download audio and convert to MP3"""
    data = request.get_json()
    url = data.get('url', '')
    bitrate = data.get('bitrate', '192')

    if not url:
        return jsonify({'status': 'error', 'message': 'URL is required'}), 400

    cleanup_old_files()

    file_id = str(uuid.uuid4())[:8]
    output_path = os.path.join(TEMP_DIR, file_id)

    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'format': 'bestaudio/best',
            'impersonate': 'chrome',
            'outtmpl': output_path + '.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': bitrate,
            }],
        }
        
        # Windows Winget FFmpeg path fallback
        import glob
        winget_ffmpeg = glob.glob(r"C:\Users\*\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\ffmpeg-*\bin\ffmpeg.exe")
        if winget_ffmpeg:
            ydl_opts['ffmpeg_location'] = os.path.dirname(winget_ffmpeg[0])

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'audio')

        # Find the converted MP3 file
        mp3_path = output_path + '.mp3'
        if not os.path.exists(mp3_path):
            return jsonify({'status': 'error', 'message': 'Conversion failed. ffmpeg may not be installed.'}), 500

        safe_title = "".join(c for c in title if c.isalnum() or c in ' -_()[]').strip()

        return send_file(
            mp3_path,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name=f'{safe_title}.mp3',
        )

    except Exception as e:
        print(f"Download error: {e}")
        return jsonify({'status': 'error', 'message': 'Could not download this video.'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
