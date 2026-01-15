# Dooweed - Smart Expense & Receipt Tracker

A modern, high-performance personal finance application built with Next.js 14, featuring AI-powered receipt scanning, budget tracking, and detailed financial reports.

## 🚀 Key Features

*   **📊 Interactive Dashboard**: Real-time overview of your financial health with beautiful charts.
*   **🧾 Smart Receipt Scanner**: 
    *   **Client-side OCR** using Tesseract.js (Privacy-first).
    *   **Batch Upload**: Scan multiple receipts at once.
    *   **Intelligent Parsing**: Auto-detects merchant, date, amount, and currency.
    *   **Currency Conversion**: Real-time exchange rates via Frankfurter API.
*   **💸 Transaction Management**: Efficiently track income and expenses with categories.
*   **🔁 Recurring Transactions**: Automated handling of subscriptions and regular bills.
*   **💰 Budgeting**: Set monthly limits per category and track progress.
*   **📈 Advanced Reports**: Visual breakdowns of spending habits over time.
*   **🎨 Premium UI/UX**: Fully responsive design with glassmorphism aesthetics and dark mode.

## 🛠️ Tech Stack

*   **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Database**: [Turso (LibSQL)](https://turso.tech/)
*   **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
*   **OCR**: [Tesseract.js](https://tesseract.projectnaptha.com/)
*   **Charts**: [Recharts](https://recharts.org/)
*   **Icons**: [Lucide React](https://lucide.dev/)

## 📦 Getting Started

### Prerequisites

*   Node.js 18+ installed
*   npm or pnpm

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/dooweed.git
    cd dooweed
    ```

2.  **Install dependencies**
    ```bash
    npm install
    # or
    pnpm install
    ```

3.  **Environment Setup**
    Create a `.env.local` file in the root directory (this file will be ignored by git):
    ```env
    TURSO_DATABASE_URL=libsql://your-db-url.turso.io
    TURSO_AUTH_TOKEN=your-auth-token
    DEFAULT_USER_ID=default-user
    ```

4.  **Database Setup (Turso)**
    
    You need a Turso database to run this project.
    
    *Option A: Fast Setup (Turso CLI)*
    1.  Install Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash` (user windows pake wsl wak)
    2.  Login: `turso auth login`
    3.  Create DB: `turso db create dooweed-db`
    4.  Get URL: `turso db show dooweed-db --url` -> Copy to `TURSO_DATABASE_URL`
    5.  Get Token: `turso db tokens create dooweed-db` -> Copy to `TURSO_AUTH_TOKEN`

    *Option B: Turso Dashboard*
    1.  Go to [turso.tech](https://turso.tech) and sign up/login.
    2.  Create a new Database.
    3.  Copy the **Database URL** and **Auth Token** to your `.env.local` file.

5.  **Push Schema to Database**
    Initialize your database tables using Drizzle Kit:
    ```bash
    npx drizzle-kit push
    ```

6.  **Run Development Server**
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
