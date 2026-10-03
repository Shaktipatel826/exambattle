# ExamiQ - AI-Powered Competitive Exam Study, Revision & Realtime Multiplayer Battle Platform

ExamiQ is a complete production-grade web application built for Indian competitive exam aspirants (SSC, Railway, Banking, UP Police, UPSI, UPSSSC, etc.).

It unifies **Study + AI Study Lab + Notes + Practice + PYQs + Mock Tests + Realtime Multiplayer Battles + Spaced Repetition Revision + Gamification**.

---

## 🚀 Key Features

1. **Student Dashboard & Gamification**: XP points (+10 per correct answer), Level progression, 7-Day Streaks, Target Exam customization, and Daily Mission checklists.
2. **AI Study Lab & File Processing**: Upload TXT, CSV (transcript handling with timestamps), PDF, DOCX, XLSX to automatically generate Short Notes, One-Liners, Key Concepts, Important Points, Common Confusions, and MCQs using the official `@google/generative-ai` SDK.
3. **Realtime Multiplayer Battle Arena**: Compete in 1v1 or 3-player battle rooms with room codes (e.g. `K7P4XZ`), synchronized questions, server-authoritative timer countdown, live player presence (`Thinking` / `Answered`), server-side scoring, and instant Rematch.
4. **Question Bank & PYQ Engine**: Full taxonomy supporting Indian Polity, History (Ancient, Medieval, Modern), Geography, Economics, Science, Computer, Mathematics, Current Affairs, and UP State Exams with official PYQ tags and verification badges.
5. **Wrong Question Notebook & Spaced Repetition**: Automatically saves mistakes and calculates revision intervals (1, 3, 7, 14, 30 days) to eliminate weak topics.
6. **Admin Control Hub**: Question entry, bulk document import with duplicate detection & missing answer validation, AI Question Generator, and pending review approval queue.

---

## 🛠️ Stack & Tech Architecture

- **Backend**: Node.js, Express.js, Socket.io Server, Mongoose ODM, JWT Auth, Multer, `@google/generative-ai` SDK
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Socket.io Client
- **Database**: MongoDB (with fallback in-memory store adapter for out-of-the-box operation)

---

## 💻 Quick Start Guide

### 1. Installation
```bash
npm run install:all
```

### 2. Environment Setup
Create `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/shakti_exam_db
JWT_SECRET=super_secret_shakti_jwt_key_2026_exam_app
GEMINI_API_KEY=your_google_gemini_api_key
```

### 3. Run Development Servers
```bash
# Terminal 1: Backend Server (Port 5000)
npm run dev:server

# Terminal 2: Frontend Vite App (Port 3000)
npm run dev:client
```

### 4. Build for Production
```bash
npm run build:client
npm start
```

---

## 🔐 Pre-configured Demo Accounts

- **Student Login**: `student@shakti.com` / `student123`
- **Admin Login**: `admin@shakti.com` / `admin123`
