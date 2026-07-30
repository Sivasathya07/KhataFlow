# KhataFlow

KhataFlow is a voice-first retail bookkeeping and inventory platform. It provides a React dashboard, FastAPI service, MongoDB-backed inventory/customer APIs, JWT authentication, and a review-before-confirming local Whisper workflow.

## Repository structure

```text
KhataFlow/
├── client/                 # React + Vite + TypeScript application
│   ├── src/
│   │   ├── components/     # Shared UI components
│   │   ├── lib/            # Client utilities
│   │   └── main.tsx        # Application entry point
│   ├── components.json     # shadcn/ui configuration
│   ├── package.json
│   └── vite.config.ts
├── server/                 # FastAPI application
│   ├── app/
│   │   ├── api/            # HTTP route modules
│   │   ├── agents/         # AI agent orchestration
│   │   ├── database/       # Database connections and repositories
│   │   ├── models/         # MongoDB persistence models
│   │   ├── prompts/        # Prompt templates
│   │   ├── schemas/        # API request/response schemas
│   │   ├── services/       # Application services
│   │   ├── utils/          # Shared server utilities
│   │   ├── config.py       # Environment settings
│   │   └── main.py         # FastAPI application factory
│   ├── .env.example
│   └── requirements.txt
├── docs/                   # Architecture and product documentation
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB Atlas connection string

## How to Run KhataFlow

### Option 1: Quick Start with Docker Compose (Recommended)

Run the entire application (MongoDB + Backend API + Frontend Web App) with a single command:

```bash
# 1. Clone or open project root directory
cd KhataFlow

# 2. Start all services using Docker Compose
docker compose up --build
```

- **Frontend App**: Open [http://localhost:8080](http://localhost:8080)
- **Backend API Docs**: Open [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: Open [http://localhost:8000/health](http://localhost:8000/health)

---

### Option 2: Running Frontend & Backend Separately (Development Mode)

#### 1. Backend Server (FastAPI)

In terminal 1:

```bash
# Navigate to server directory
cd server

# Create and activate Python virtual environment
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On macOS / Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (if not already created)
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```

The API server will run at `http://localhost:8000`.

#### 2. Frontend Client (React + Vite)

In terminal 2:

```bash
# Navigate to client directory
cd client

# Install packages
npm install

# Start Vite dev server
npm run dev
```

The React web interface will open at `http://localhost:5173`.

---

### Verification & Health Check

Verify that the server is running properly:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"healthy"}
```

---

### Offline Voice Transcription Setup

Voice transactions run locally through Faster-Whisper. Set `WHISPER_MODEL` to the
default `base` model already in the Faster-Whisper cache, or to a locally mounted
CTranslate2 Whisper model directory. The service intentionally uses local files
only, so it never sends audio or transcripts to an external API and does not make
runtime model-download requests. FFmpeg must be installed and available on `PATH`
for browser WebM/OGG recordings.

AAC uploads are also accepted. The confirmed workflow uses a deterministic parser as
its safe offline fallback when external AI services are unavailable.

## Authentication and core APIs

Register with `POST /api/v1/auth/register`, then use `POST /api/v1/auth/login` and
`POST /api/v1/auth/refresh` to obtain JWTs. The public product, customer, and voice
workflow endpoints are grouped under `/api/v1`; interactive OpenAPI documentation is
available at `/docs`.

The included [Postman collection](docs/postman-collection.json) contains a health and
registration request. Customer APIs support create, search/pagination, and update;
inventory supports full product CRUD and optimistic locking.

## Containers

Copy `server/.env.example` to `server/.env`, supply MongoDB URI, a strong
`JWT_SECRET`, then run:

```bash
docker compose up --build
```

The web app is served on `http://localhost:8080` (API proxied at `/api/v1`); the API is also on port 8000 with docs at `/docs`.
For production, terminate TLS in front of the client container and rotate the JWT secret. `DEFAULT_BUSINESS_ID` unauthenticated access is **development only**.

### Groq AI assistant

Prefer Groq in `server/.env` (never commit real keys):

```env
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
LLM_BASE_URL=https://api.groq.com/openai/v1
```

Without a key, the assistant stays rule-based. Tenant overrides in Settings are optional OpenAI-compatible keys (masked when read back).

### UPI and WhatsApp reminders

```env
UPI_ID=your-business@upi
BUSINESS_UPI_NAME=Your Business Name
BUSINESS_WHATSAPP=9198XXXXXXXX
```

Payment reminders open `wa.me/{customerPhone}` with a prefilled UPI message. Put customer phones as country code + digits (e.g. `9198XXXXXXXX`). Automatic WhatsApp sending via Meta Cloud API is not configured; deep-links work with any staff WhatsApp.

### Auth notes

- Access + refresh JWTs; refresh tokens are rotated and revocable via `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me` returns the current profile
- Without SMTP in development, forgot-password / register responses include a copyable `devToken`

## New shop features

- **Quick Sale POS** (`#pos`) — barcode/SKU search, cart, GST, cash/UPI/card/credit
- **Customer payments** — `POST /api/v1/customers/{id}/payments` reduces outstanding balance
- **Suppliers** — CRUD + receive stock into inventory
- **Notifications** — in-app center for reminders, payments, stock receives
- **Daily close** — `GET /api/v1/daily-close` (+ CSV/PDF export)
- **GST / profit reports** — specialized aggregations (not sales-row clones)
- **Live dashboard insights** — `GET /api/v1/dashboard/insights`

## Deployment

For Docker Compose, the included configuration starts an isolated MongoDB instance.
For MongoDB Atlas, remove the `MONGODB_URI` override in `docker-compose.yml` and
provide the Atlas URI in `server/.env`. Set a long unique `JWT_SECRET`, production
`CORS_ORIGINS`, and a locally provisioned `WHISPER_MODEL` before deploying.

`render.yaml` provisions API and web services on Render; add `MONGODB_URI` and the
final web origin in the Render environment. `railway.json` deploys the API from its
Dockerfile; provision MongoDB/Atlas and configure the same secrets in Railway.
The API health probe is `GET /health`, and CI runs Python tests plus frontend lint
and production build on every push and pull request.

## Configuration

Server configuration is read from environment variables. Copy `server/.env.example` to `server/.env` before running locally. CORS defaults include Vite (`5173`) and Docker web (`8080`).

Mount a local Whisper model directory into the API container if needed; the service does not download models at runtime.

## Data model

The backend foundation includes Pydantic-validated MongoDB document models for users, customers, products, transactions, suppliers, notifications, and AI insights. See [the data-model reference](docs/data-model.md) for relationships and recommended indexes.

## UI foundation

The client uses Tailwind CSS v4, Fraunces + Source Sans 3 branding, and shadcn-style primitives. Theme preference (light/dark/system) is applied from Settings.

## Inventory vertical slice

The Inventory and Products pages use `VITE_API_URL` (see `client/.env.example`; Docker builds bake `/api/v1`). Configure `MONGODB_URI`, `MONGODB_DATABASE`, and the temporary `DEFAULT_BUSINESS_ID` in `server/.env` for local unauthenticated inventory reads in development only.

Inventory endpoints are exposed under `/api/v1/inventory/products`:

- `POST` — create a product
- `GET` — list/search products
- `GET /{productId}` — retrieve a product
- `PATCH /{productId}` — update product configuration with optimistic versioning
- `DELETE /{productId}` — delete a product (owner/manager)
