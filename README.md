# Hangman — A Modern Multiplayer Word Guessing Game

A complete, modular Python 3.11+ Hangman game featuring a ruled-notebook paper aesthetic built with **Flet**, pure domain logic, **SQLite/JSON** score persistence, and an authoritative **WebSockets** multiplayer server (plus a live interactive web preview).

---

## 1. Project Architecture (`hangman/`)

```text
hangman/
├── main.py                     # Flet application entry point
├── requirements.txt            # Python dependencies (flet, websockets, pytest)
├── Dockerfile                  # Container definition for Azure Container Apps / Docker
├── README.md                   # Documentation, setup, networking, Azure & testing guide
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

## 2. Linux Installation & Running Locally

```bash
cd hangman
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Run automated unit tests (19 tests)
PYTHONPATH=. pytest -v

# Start the authoritative WebSocket server (Terminal 1)
python -m networking.server

# Launch the Flet desktop GUI (Terminal 2)
python main.py
```

---

## 3. Deploying to Microsoft Azure

Because Hangman uses **WebSockets** for real-time online multiplayer and **Flet** for the GUI, you can deploy the project to Microsoft Azure using **Azure Container Apps** or **Azure App Service**.

### Prerequisites
1. Install the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`) and sign in:
   ```bash
   az login
   ```
2. Create a Resource Group:
   ```bash
   az group create --name rg-hangman-game --location eastus
   ```

---

### Option A: Deploy to Azure Container Apps (Recommended for WebSockets + Flet)

Azure Container Apps natively supports WebSockets (`wss://`), automatic TLS certificates, and single-command source builds from `hangman/Dockerfile`.

1. **Deploy from the `hangman/` directory**:
   ```bash
   cd hangman
   az containerapp up \
     --name hangman-ws-server \
     --resource-group rg-hangman-game \
     --location eastus \
     --environment env-hangman \
     --source . \
     --target-port 8765 \
     --ingress external
   ```
2. **Pin Replicas to 1 (Required for In-Memory Multiplayer Rooms)**:
   ```bash
   az containerapp update \
     --name hangman-ws-server \
     --resource-group rg-hangman-game \
     --min-replicas 1 \
     --max-replicas 1
   ```
3. **Connect Flet Clients Over Secure WebSockets (`wss://`)**:
   ```bash
   HANGMAN_WS_URL=wss://hangman-ws-server.<region>.azurecontainerapps.io python main.py
   ```

---

### Option B: Deploy to Azure App Service (Linux Python 3.11 Runtime)

Ideal for **Azure for Students** subscriptions (`F1` Free or `B1` Basic tier):

1. **Create and deploy the Python 3.11 Web App**:
   ```bash
   cd hangman
   az webapp up \
     --name hangman-multiplayer-<your-unique-id> \
     --resource-group rg-hangman-game \
     --runtime "PYTHON:3.11" \
     --sku B1 \
     --location eastus
   ```
2. **Enable WebSockets**:
   ```bash
   az webapp config set \
     --name hangman-multiplayer-<your-unique-id> \
     --resource-group rg-hangman-game \
     --web-sockets-enabled true
   ```
3. **Set Environment Variables & Startup Command**:
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
4. **Connect Clients**:
   ```bash
   HANGMAN_WS_URL=wss://hangman-multiplayer-<your-unique-id>.azurewebsites.net python main.py
   ```

---

### Option C: Deploy the Full-Stack Web App (`server.ts` + React + WebSockets) to Azure App Service

To deploy the full-stack browser version from the repository root:

```bash
npm install
npm run build

az webapp up \
  --name hangman-web-<your-unique-id> \
  --resource-group rg-hangman-game \
  --runtime "NODE:20-lts" \
  --sku B1

az webapp config set \
  --name hangman-web-<your-unique-id> \
  --resource-group rg-hangman-game \
  --web-sockets-enabled true

az webapp config appsettings set \
  --name hangman-web-<your-unique-id> \
  --resource-group rg-hangman-game \
  --settings NODE_ENV=production WEBSITES_PORT=3000 PORT=3000
```
