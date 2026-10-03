# Complete Setup Guide

## Prerequisites
- Node.js v18+ (Tested on v24.19.0)
- npm v9+ (Tested on v11.17.0)
- Optional: MongoDB running locally or MongoDB Atlas connection string.

## Detailed Installation Steps

1. **Clone or navigate to project directory**:
   ```bash
   cd "c:\Users\shakti patel\Downloads\shakti"
   ```

2. **Install all server and client dependencies**:
   ```bash
   npm run install:all
   ```

3. **Configure Environment Variables**:
   Copy `server/.env.example` to `server/.env`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/shakti_exam_db
   JWT_SECRET=super_secret_shakti_jwt_key_2026_exam_app
   GEMINI_API_KEY=
   ```

4. **Launch Application**:
   - Backend API & Socket Server: `npm run dev:server` (Starts http://localhost:5000)
   - Frontend React App: `npm run dev:client` (Starts http://localhost:3000)

5. **Test Account Access**:
   Open browser at `http://localhost:3000` and use the quick login buttons.
