# Production Deployment Guide

## Building for Production

1. **Build Client**:
   ```bash
   npm run build:client
   ```

2. **Serve Built Assets**:
   The Express server in `server/src/index.js` is configured to serve static uploads and API routes. For production, you can configure Express to serve `client/dist`.

3. **Production Environment Variables**:
   Set `NODE_ENV=production` and ensure `GEMINI_API_KEY`, `MONGODB_URI`, and `JWT_SECRET` are securely stored.

4. **Process Manager**:
   Run with PM2:
   ```bash
   pm2 start server/src/index.js --name examiq-backend
   ```
