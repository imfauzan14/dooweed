# Dooweed

A personal finance tracker that actually understands your receipts. Built for efficiency, privacy, and "I don't want to manually enter data" vibes.

![Next.js 16](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js&logoColor=white) 
![React 19](https://img.shields.io/badge/React_19-blue?style=flat-square&logo=react&logoColor=white)
![Tailwind 4](https://img.shields.io/badge/Tailwind_4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Turso](https://img.shields.io/badge/Turso-green?style=flat-square&logo=sqlite&logoColor=white)

## ✨ Why Dooweed?

Traditional finance apps make you manually tag everything. Dooweed uses a multi-tier AI approach to automate the boring stuff.

- **🤖 Hybrid Scanning**: 
    - **Local OCR**: Tesseract.js (WASM) runs in your browser for immediate, private text extraction.
    - **Agentic Enhancement**: Fails over to **DeepSeek V3** for semantic understanding, extracting structured data (merchants, dates, amounts) even from messy receipts.
- **💸 Intelligent Currencies**:
    - **Automatic Conversion**: Real-time exchange rates (Frankfurter/ExchangeRate-API).
    - **Smart Fallbacks**: If APIs fail, it uses a local cache or **LLM-based estimation** to ensure your data stays consistent.
    - **Home Currency Tracking**: All transactions are normalized to your base currency (e.g., IDR) for accurate reporting.
- **✅ Confidence-Based Workflow**:
    - **Auto-pilot**: High-confidence scans are verified automatically.
    - **Batch Review**: Speed-run through low-confidence scans in a dedicated interface.
- **📊 Financial Insights**: Interactive charts powered by Recharts, recurring transaction tracking, and budget management.

## 🛠️ The Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server Actions)
- **Library**: [React 19](https://react.dev/)
- **Database**: [Turso](https://turso.tech/) (SQLite at the edge)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **Auth**: Custom session-based authentication (Bcrypt, UUID, HttpOnly cookies)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **AI**: DeepSeek Chat (v3) for structured parsing
- **OCR**: Tesseract.js

## 📦 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/imfauzan14/dooweed.git
cd dooweed
npm install
```

### 2. Configure Environment
Create a `.env.local` file:

```bash
# Database (Turso)
TURSO_DATABASE_URL="libsql://your-db.turso.io"
TURSO_AUTH_TOKEN="your-turso-token"

# AI Parsing (DeepSeek)
DEEPSEEK_API_KEY="sk-..."

# App Config
DEFAULT_USER_ID="default-user"
```

### 3. Database Setup
Sync your schema with Turso:
```bash
npm run db:push
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## ⌨️ Available Scripts

- `npm run dev`: Start Next.js in development mode.
- `npm run db:push`: Push local schema changes directly to the database.
- `npm run db:generate`: Generate migration files for the schema.
- `npm run db:studio`: Open Drizzle Studio to explore your data.
- `npm run build`: Create a production-ready build.

## 🤝 Roadmap

- [x] Custom Session Auth
- [x] CSV Export
- [ ] Multi-user multi-tenancy refinements
- [ ] Investment Portfolio Tracking
- [ ] Receipt image storage (S3/Cloudflare R2)

## 📄 License
IDC, ITS MADE BY AI
