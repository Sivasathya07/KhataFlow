# KhataFlow 🧾⚡

**KhataFlow** is a modern, voice-first retail bookkeeping, POS, and inventory management platform designed for Indian small businesses and retail shopkeepers. It combines a high-performance React dashboard, an agentic FastAPI backend, MongoDB Atlas multi-tenant persistence, local offline voice recognition (Faster-Whisper), Groq AI business insights, and 1-click WhatsApp payment reminders.

---

## 🌟 Key Features

- **🎙️ Voice-First Bookkeeping & AI Chat**: Speak sales or queries in **English, Tamil, or Tanglish** (*"Sell 2 kg rice to Anita"* or *"Stock evvalo iruku?"*). Powered by offline Faster-Whisper and Groq LLaMA 3.3 AI agents.
- **🛒 Quick Sale POS**: Instant barcode/SKU search, live cart management, automatic GST calculation (CGST/SGST/IGST), and support for Cash, UPI, Card, or Credit (*Udhar*).
- **📘 Customer Credit Ledger (Khata)**: Track outstanding customer debts, record partial/full payments, and generate PDF payment receipts.
- **💬 1-Click WhatsApp Payment Reminders**: Send formatted WhatsApp payment reminders pre-filled with dynamic UPI payment links (`wa.me` deep-links).
- **📦 Inventory & Supplier Management**: Optimistic concurrency control for stock updates, low-stock reorder alerts, supplier tracking, and receiving purchase inventory.
- **📊 Daily Close & Tax Reports**: Instant daily closing summaries, GST tax collection reports, profit breakdown, and 1-click **PDF & CSV/Excel exports**.
- **🔒 Multi-Tenant Enterprise Security**: JWT access & refresh token rotation, bcrypt password hashing, tenant isolation by `businessId`, and strict CORS policies.

---

## 🛠️ Complete Tech Stack

| Domain | Technology / Library | Purpose & Description |
| :--- | :--- | :--- |
| **Frontend Core** | **React 19** + **TypeScript** | High-performance single page application (SPA) |
| **Build System** | **Vite 6** | Instant HMR development server and optimized bundle build |
| **Styling & UI** | **Tailwind CSS v4** + **shadcn/ui** | Modern responsive design system with dark/light themes |
| **Icons & Typography** | **Lucide React** + **Google Fonts** | Fraunces (Headings) + Source Sans 3 (Body) |
| **Client HTTP** | **Axios** | Interceptor-driven HTTP client with automatic JWT token refresh |
| **Speech APIs** | **Web Speech API** + **SpeechSynthesis** | Browser-native speech recognition & TTS voice response |
| **Backend Framework** | **FastAPI** (Python 3.11+) | Async high-concurrency Python REST API service |
| **Server Runtime** | **Uvicorn** / **Gunicorn** | ASGI web server for production and development |
| **Database** | **MongoDB / MongoDB Atlas** | Schema-validated document store with PyMongo driver |
| **AI LLM Agent** | **Groq API** (`llama-3.3-70b-versatile`) | Natural language understanding, transaction proposal generation & insights |
| **Voice Processing** | **Faster-Whisper** + **PyDub** + **FFmpeg** | Offline local CTranslate2 Whisper model for audio transcription |
| **Security & Auth** | **PyJWT** + **Bcrypt** | JWT Access & Refresh session security with token revocation |
| **PDF & Export** | **ReportLab** + **OpenPyXL** | Automated PDF invoice generation and Excel spreadsheet exports |
| **Reverse Proxy** | **Nginx** | Client SPA routing, static caching, gzip compression & API reverse proxy |
| **Containers & Deploy** | **Docker** + **Render** | Dockerized client & server containers with `render.yaml` orchestration |

---

## 📁 Repository Structure

```text
KhataFlow/
├── client/                     # React + Vite + TypeScript Frontend Application
│   ├── src/
│   │   ├── components/         # Reusable shadcn UI primitives (Button, Card, Input, etc.)
│   │   ├── features/           # Modular domain features:
│   │   │   ├── agent/          # AI voice chat & conversational bookkeeping interface
│   │   │   ├── auth/           # Login, Register, Password Reset & Auth Context
│   │   │   ├── customers/      # Credit ledger, payment collection & WhatsApp links
│   │   │   ├── dashboard/      # Business metrics, revenue charts & AI insights
│   │   │   ├── inventory/      # Stock catalogue, product management & reorder alerts
│   │   │   ├── pos/            # Point of Sale quick billing & receipt printing
│   │   │   ├── reports/        # Daily close, GST tax summaries & PDF/CSV exports
│   │   │   ├── settings/       # Shop configuration, UPI settings & API keys
│   │   │   ├── suppliers/      # Supplier registry & purchase receiving
│   │   │   ├── transactions/   # Invoice ledger, returns & itemized history
│   │   │   └── voice/          # Audio recorder modal & local Whisper integration
│   │   ├── lib/                # Axios API client & error extractor helpers
│   │   └── App.tsx             # Route orchestration & primary layout shell
│   ├── Dockerfile              # Production Nginx container build
│   ├── nginx.conf              # Production Nginx config (proxying /api/ to backend)
│   └── package.json
│
├── server/                     # FastAPI Python Backend Application
│   ├── app/
│   │   ├── agents/             # AI agent planner, executor & natural language parser
│   │   ├── api/                # REST API route handlers (/auth, /inventory, /pos, etc.)
│   │   ├── database/           # MongoDB Atlas connection pool & index initializers
│   │   ├── models/             # PyMongo document models with index metadata
│   │   ├── schemas/            # Pydantic v2 data validation schemas
│   │   ├── services/           # Business logic (transactions, voice, reports, WhatsApp)
│   │   ├── config.py           # Pydantic settings loading from environment
│   │   └── main.py             # FastAPI entrypoint, CORS & error handling middleware
│   ├── Dockerfile              # Python Docker container build
│   └── requirements.txt        # Python package dependencies
│
├── docs/                       # Architecture diagrams & API specification docs
├── render.yaml                 # Multi-service deployment spec for Render
├── docker-compose.yml          # Local containerized orchestration
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20.0 or higher
- **Python**: v3.11 or higher
- **MongoDB**: Local MongoDB instance or free MongoDB Atlas URI

---

### Option 1: Quick Start with Docker Compose (Recommended)

Run the complete application (Frontend + Backend API + Nginx Proxy) with one command:

```bash
# 1. Clone the repository
git clone https://github.com/Sivasathya07/KhataFlow.git
cd KhataFlow

# 2. Configure environment variables in server/.env
cp server/.env.example server/.env

# 3. Build and launch containers
docker compose up --build
```

- **Frontend App**: [http://localhost:8080](http://localhost:8080)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Endpoint**: [http://localhost:8000/health](http://localhost:8000/health)

---

### Option 2: Running Development Servers Separately

#### 1. Backend Service (FastAPI)

```bash
cd server

# Create and activate Python virtual environment
python -m venv .venv

# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On macOS / Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

#### 2. Frontend Web App (React + Vite)

```bash
cd client

# Install packages
npm install

# Start Vite dev server
npm run dev
```

The web application will open at `http://localhost:5173`.

---

## ⚙️ Environment Variables

Create a `server/.env` file with the following configuration:

```env
# Application
ENVIRONMENT=development
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:8080

# Database & Authentication
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DATABASE=khataflow
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# AI Agent (Groq / OpenAI)
GROQ_API_KEY=gsk_your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
LLM_BASE_URL=https://api.groq.com/openai/v1

# Voice Transcription (Offline Faster-Whisper)
WHISPER_MODEL=base

# Shop & Payment Reminders
UPI_ID=yourshop@upi
BUSINESS_UPI_NAME=Your Shop Name
BUSINESS_WHATSAPP=919876543210
```

---

## 📡 Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check probe |
| `POST` | `/api/v1/auth/register` | Register new business owner account |
| `POST` | `/api/v1/auth/login` | Authenticate and return JWT tokens |
| `POST` | `/api/v1/auth/refresh` | Rotate access token using valid refresh token |
| `GET` | `/api/v1/inventory/products` | Search & list inventory products |
| `POST` | `/api/v1/inventory/products` | Create product with pricing & stock levels |
| `POST` | `/api/v1/transactions` | Record sale, purchase, or return transaction |
| `GET` | `/api/v1/customers` | List customer credit ledgers & balances |
| `POST` | `/api/v1/customers/{id}/payments` | Record customer credit payment |
| `POST` | `/api/v1/customers/{id}/payment-reminder` | Generate WhatsApp prefilled payment link |
| `POST` | `/api/v1/agent/chat` | Send message/voice to Groq AI bookkeeping agent |
| `POST` | `/api/v1/voice/transcribe` | Transcribe recorded audio with local Faster-Whisper |
| `GET` | `/api/v1/reports/daily-close` | Daily closing financial summary & export |

---

## 🌐 Production Deployment (Render)

KhataFlow includes pre-configured **`render.yaml`** deployment manifests for [Render.com](https://render.com):

1. Connect your GitHub repository (`Sivasathya07/KhataFlow`) to Render.
2. Render will automatically provision two web services:
   - **`khataflow-api`**: Docker runtime running the FastAPI server.
   - **`khataflow-web`**: Docker runtime running Nginx + React SPA.
3. In Render Environment Settings for `khataflow-api`, configure `MONGODB_URI`, `JWT_SECRET`, and `GROQ_API_KEY`.
4. Deployments trigger automatically on every `git push origin main`.

---

## 🛡️ License

Distributed under the **MIT License**. See `LICENSE` for details.
