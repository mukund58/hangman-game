# Hangman — A Modern Multiplayer Word Guessing Game

A complete, modular Python 3.11+ Hangman game featuring a ruled-notebook paper aesthetic built with **Flet**, pure domain logic, **SQLite/JSON** score persistence, and an authoritative **WebSockets** multiplayer server.

---

## 1. Project Architecture

```text
hangman/
├── main.py                     # Flet application entry point
├── requirements.txt            # Python dependencies (flet, websockets, pytest)
├── README.md                   # Documentation, setup, networking & testing guide
├── game/
│   ├── __init__.py
│   ├── logic.py                # Pure HangmanGame domain class & state machine
│   ├── words.py                # WordDatabase loader & difficulty classifier
│   └── scoring.py              # ScoringEngine (100 + 20 * lives) + SQLite/JSON
├── ui/
│   ├── __init__.py
│   ├── home.py                 # Responsive 2-column layout & mode controller
│   ├── game_screen.py          # Left column: paper board, word setter, keyboard
│   ├── sidebar.py              # Right column: modes, status, scores, live chat
│   ├── multiplayer_screen.py   # Online room modal & top pink room code banner
│   └── components.py           # Flet Canvas progressive sketch & A-Z keyboard
├── networking/
│   ├── __init__.py
│   ├── server.py               # Authoritative asyncio WebSockets room server
│   ├── client.py               # Non-blocking async WebSocket client for Flet
│   └── protocol.py             # Wire message types & safe JSON validation
├── data/
│   └── words.json              # 120 unique words across 12 categories & 4 tiers
└── tests/
    ├── test_logic.py           # Unit tests for HangmanGame rules & edge cases
    ├── test_scoring.py         # Unit tests for single-award scoring & SQLite/JSON
    └── test_networking.py      # Security & isolation tests for multiplayer rooms
```

---

## 2. Scoring System & Difficulty Classification

### Scoring Formula
- **Winning a round**: `100 base points + (20 × remaining_lives)` (up to **220 points** for a flawless 6-life solve).
- **Losing or resigning**: `0 points`.
- **Single-Award Guarantee**: `HangmanGame.score_awarded` ensures a completed round can never award points more than once.

### Word Difficulty Classification
Words are organized across **12 categories** (`Animals`, `Food & drink`, `Geography`, `Sport`, `Jobs`, `Nature`, `Objects`, `The body`, `Music`, `Transport`, `Clothes`, `School`) and **4 difficulty levels**:
- **Easy**: 5 letters, familiar vocabulary, high vowel ratio.
- **Medium**: 6–7 letters, moderate unique letter count.
- **Hard**: 8–13 letters or compound/multi-word phrases (`KOMODO DRAGON`).
- **Fiendish**: Words with rare consonants (`J, Q, X, Z, K, V, Y`), hyphenation (`JIU-JITSU`), or low vowel ratios (`RHYTHM`, `FJORD`, `AXOLOTL`).

---

## 3. Linux Installation & Virtual Environment Setup

Open a terminal in the `hangman/` directory and run:

```bash
# 1. Create a Python 3.11+ virtual environment
python3 -m venv .venv

# 2. Activate the virtual environment
source .venv/bin/activate

# 3. Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 4. Running the Application & Online Server

### Run Single-Player & Pass-and-Play (Desktop GUI)
```bash
python main.py
```

### Run the Authoritative Online Multiplayer Server
In a separate terminal (with `.venv` activated):
```bash
python -m networking.server
```
By default, the server listens on `ws://0.0.0.0:8765`. You can customize the host and port with environment variables:
```bash
HANGMAN_WS_HOST=0.0.0.0 HANGMAN_WS_PORT=8765 python -m networking.server
```

### Connecting Two Clients on a Local Network (LAN)
1. Find the host computer's LAN IP address on Linux:
   ```bash
   hostname -I
   # Example output: 192.168.1.42
   ```
2. Start the server on the host machine:
   ```bash
   HANGMAN_WS_HOST=0.0.0.0 HANGMAN_WS_PORT=8765 python -m networking.server
   ```
3. On **Computer 1 (Host Player)**:
   ```bash
   HANGMAN_WS_URL=ws://192.168.1.42:8765 python main.py
   ```
   Select **A friend online** → **Create a room** and copy the generated room code.
4. On **Computer 2 (Friend on the same Wi-Fi/LAN)**:
   ```bash
   HANGMAN_WS_URL=ws://192.168.1.42:8765 python main.py
   ```
   Select **A friend online**, paste the room code into **Join a room**, and click **Join**.

### Playing Over the Public Internet
To connect players across different networks over the public internet:
1. **Cloud Hosting (Recommended)**: Deploy `networking/server.py` on a cloud VM or PaaS (e.g., Google Cloud Run, Fly.io, Render, or a VPS) behind TLS (`wss://your-domain.example.com`), and set `HANGMAN_WS_URL=wss://your-domain.example.com`.
2. **Secure Tunneling for Quick Testing**: Run `ngrok http 8765` or `cloudflared tunnel --url http://localhost:8765` on the machine running `networking.server`, and share the generated `wss://...` URL with your friend via `HANGMAN_WS_URL`.
3. **Firewall / Port Forwarding**: If hosting directly from home, allow TCP port `8765` through `ufw` (`sudo ufw allow 8765/tcp`) and forward port `8765` on your router.

---

## 5. Running the Automated Tests (pytest)

Run the full test suite from the `hangman/` directory:

```bash
PYTHONPATH=. pytest -v
# Or use the zero-dependency runner:
python3 run_tests.py
```

---

## 6. Deploying to Microsoft Azure

Because Hangman uses **WebSockets** for real-time online multiplayer and **Flet** for the GUI, you can deploy the project to Microsoft Azure in two ways:
- **Architecture 1**: Deploy the **Authoritative Python WebSocket Server** (`networking/server.py`) to Azure so desktop Flet clients (`python main.py`) anywhere in the world can connect via `wss://`.
- **Architecture 2**: Deploy both the **Flet Web App** (`flet run --web`) and the **WebSocket Server** using **Azure Container Apps** or **Azure App Service**.

### Prerequisites
1. Install the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`) and sign in:
   ```bash
   az login
   ```
2. Create a Resource Group (e.g., in `eastus` or `centralindia`):
   ```bash
   az group create --name rg-hangman-game --location eastus
   ```

---

### Option A: Deploy to Azure Container Apps (Recommended for WebSockets + Flet)

Azure Container Apps natively supports WebSockets (`wss://`), automatic TLS certificates, and scale-to-zero or persistent single-instance rooms.

#### Step 1: Verify the `Dockerfile` in `hangman/Dockerfile`
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default port exposed by Azure
ENV HANGMAN_WS_HOST=0.0.0.0
ENV HANGMAN_WS_PORT=8765
EXPOSE 8765

# Run the authoritative WebSocket server
CMD ["python", "-m", "networking.server"]
```
*(Note: To host the Flet Web GUI inside the container instead, change `EXPOSE 8000` and `CMD ["flet", "run", "--web", "--host", "0.0.0.0", "--port", "8000", "main.py"]`.)*

#### Step 2: Deploy with a Single Azure CLI Command
From inside the `hangman/` directory, run:

```bash
az containerapp up \
  --name hangman-ws-server \
  --resource-group rg-hangman-game \
  --location eastus \
  --environment env-hangman \
  --source . \
  --target-port 8765 \
  --ingress external
```

#### Step 3: Lock Replica Count to 1 (Important for In-Memory Multiplayer Rooms)
Since `RoomManager` stores active rooms in memory, set `min-replicas=1` and `max-replicas=1` so both players in a match always hit the same server instance:

```bash
az containerapp update \
  --name hangman-ws-server \
  --resource-group rg-hangman-game \
  --min-replicas 1 \
  --max-replicas 1
```

#### Step 4: Connect Your Flet Clients to Azure
Azure will output a public FQDN such as `https://hangman-ws-server.<region>.azurecontainerapps.io`. Connect any local Flet client over secure WebSockets (`wss://` on port 443):

```bash
HANGMAN_WS_URL=wss://hangman-ws-server.<region>.azurecontainerapps.io python main.py
```

---

### Option B: Deploy to Azure App Service (Linux Python 3.11 Web App)

If you have an **Azure Student (`Azure for Students`)** subscription, **Azure App Service (B1 Basic or F1 Free tier)** is an easy way to host the server without Docker.

#### Step 1: Create the App Service Plan and Python 3.11 Web App
From inside the `hangman/` directory:

```bash
az webapp up \
  --name hangman-multiplayer-<your-unique-id> \
  --resource-group rg-hangman-game \
  --runtime "PYTHON:3.11" \
  --sku B1 \
  --location eastus
```

#### Step 2: Enable WebSockets on Azure App Service
WebSockets are disabled by default on Azure App Service. Enable them with:

```bash
az webapp config set \
  --name hangman-multiplayer-<your-unique-id> \
  --resource-group rg-hangman-game \
  --web-sockets-enabled true
```

#### Step 3: Configure Port & Startup Command
Azure App Service injects the `PORT` (or `WEBSITES_PORT`) environment variable (default `8000`). Set `HANGMAN_WS_PORT=8000` and configure the startup command:

```bash
az webapp config appsettings set \
  --name hangman-multiplayer-<your-unique-id> \
  --resource-group rg-hangman-game \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true HANGMAN_WS_HOST=0.0.0.0 HANGMAN_WS_PORT=8000 WEBSITES_PORT=8000

az webapp config set \
  --name hangman-multiplayer-<your-unique-id> \
  --resource-group rg-hangman-game \
  --startup-file "python -m networking.server"
```

#### Step 4: Connect Players to Your Azure App Service URL
Once deployed, connect two players from anywhere using `wss://`:

```bash
HANGMAN_WS_URL=wss://hangman-multiplayer-<your-unique-id>.azurewebsites.net python main.py
```

---

### Option C: Deploy the Full-Stack Web App (`server.ts` + React + WebSockets) to Azure App Service

To deploy the full-stack browser version located in the workspace root:

```bash
# 1. Build the frontend bundle
npm install
npm run build

# 2. Deploy to Azure App Service (Node 20 LTS)
az webapp up \
  --name hangman-web-<your-unique-id> \
  --resource-group rg-hangman-game \
  --runtime "NODE:20-lts" \
  --sku B1

# 3. Enable WebSockets and set PORT=3000
az webapp config set \
  --name hangman-web-<your-unique-id> \
  --resource-group rg-hangman-game \
  --web-sockets-enabled true

az webapp config appsettings set \
  --name hangman-web-<your-unique-id> \
  --resource-group rg-hangman-game \
  --settings NODE_ENV=production WEBSITES_PORT=3000 PORT=3000
```

