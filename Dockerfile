FROM python:3.11-slim

# Install ffmpeg and git
RUN apt-get update && \
    apt-get install -y ffmpeg git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY yt-api-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY yt-api-backend/ .

# Run gunicorn
# Note: Render provides the PORT environment variable
CMD gunicorn -w 2 -b 0.0.0.0:$PORT app:app
