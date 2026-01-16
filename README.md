# Dooweed

A personal finance tracker that actually understands your receipts. Built for efficiency, privacy, and "I don't want to manually enter data" vibes.

![Next.js 16](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js&logoColor=white) 
![React 19](https://img.shields.io/badge/React_19-blue?style=flat-square&logo=react&logoColor=white)
![Tailwind 4](https://img.shields.io/badge/Tailwind_4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Turso](https://img.shields.io/badge/Turso-green?style=flat-square&logo=sqlite&logoColor=white)

## ✨ Why Dooweed?

Traditional finance apps make you manually tag everything. Dooweed uses a hybrid AI approach to automate the boring stuff.

*   **🤖 Hybrid Scanning**: 
    *   **Privacy-First OCR**: Tesseract.js runs locally in your browser for fast, basic text extraction.
    *   **Agentic Intelligence**: Fails over to **DeepSeek V3** (via API) for ultra-accurate receipt parsing at a fraction of the cost of GPT-4.
*   **💸 Smart Currency**:
    *   **Dual Display**: See your transactions in both standard currency (e.g., USD) and your home currency (IDR) simultaneously.
    *   **Intelligent Caching**: Exchange rates are cached server-side to keep the UI snappy and API bills low.
*   **✅ Confidence Automation**:
    *   **Auto-Verify**: High-confidence scans are automatically verified.
    *   **Review Mode**: Speed-run through low-confidence scans in a dedicated batch interface.
*   **📊 Insights**: Beautiful, interactive charts powered by Recharts.

## 🛠️ The Stack (Bleeding Edge)

*   **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server Actions)
*   **Library**: [React 19](https://react.dev/) (RC)
*   **Database**: [Turso](https://turso.tech/) (LibSQL, Edge-ready)
*   **ORM**: [Drizzle](https://orm.drizzle.team/)
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
*   **AI/LLM**: DeepSeek V3 (for structured data extraction)
*   **OCR**: Tesseract.js (WASM)

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
# Get a key at https://platform.deepseek.com/
DEEPSEEK_API_KEY="sk-..."

# App Config
DEFAULT_USER_ID="default-user"
```

### 3. Database Setup
Push the schema to your Turso database:
```bash
npx drizzle-kit push
```

### 4. Run It
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## 🤝 Roadmap

- [ ] Multi-user Auth (Clerk/Auth.js)
- [ ] Export to CSV/Excel
- [ ] Investment Portfolio Tracking

## 📄 License
IDC, ITS MADE BY AI
