FROM python:3.11-slim

# Minimal system libs for MediaPipe (no X11/display needed with headless opencv)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# CRITICAL: install opencv-headless BEFORE mediapipe.
# MediaPipe's drawing_utils imports cv2 internally — if cv2 isn't present,
# pip installs opencv-contrib-python (GUI build) which requires libxcb/X11.
# Pre-installing the headless build prevents that.
RUN pip install --no-cache-dir opencv-python-headless
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
