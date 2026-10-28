FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Default host & port for the authoritative WebSocket server
ENV HANGMAN_WS_HOST=0.0.0.0
ENV HANGMAN_WS_PORT=8765
EXPOSE 8765

# Start the authoritative multiplayer WebSocket server
CMD ["python", "-m", "networking.server"]
