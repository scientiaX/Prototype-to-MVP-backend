# Render Deployment Guide

## Current Status
✅ Backend deployed at: https://prototype-to-mvp-backend.onrender.com
❌ MongoDB not connected (needs setup)

## Fix MongoDB Connection

### Option 1: MongoDB Atlas (Recommended - Free Tier)

1. **Create MongoDB Atlas Account**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for free
   - Create a free M0 cluster

2. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/prototype-mvp?retryWrites=true&w=majority`

3. **Set in Render**
   - Go to your Render service dashboard
   - Click "Environment" tab
   - Add environment variable:
     - Key: `MONGODB_URI`
     - Value: (paste your MongoDB Atlas connection string)
   - Click "Save Changes" (this will redeploy)

4. **Other Required Environment Variables**
   ```
   NODE_ENV=production
   PORT=3001
   OPENAI_API_KEY=sk-your-comet-api-key
   OPENAI_BASE_URL=https://api.cometapi.com/v1
   JWT_SECRET=your-super-secure-jwt-secret
   CORS_ORIGIN=https://your-frontend-url.com

   # Groq AI (for problem generation, evaluation)
   AI_API=your-groq-api-key-1
   AI_API2=your-groq-api-key-2

   # Cloudflare Workers AI (for realtime follow-ups)
   AI_API_RESPONSE=your-cloudflare-api-token
   CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
   ```

### Option 2: Render Private Services (Paid)

1. Create a new PostgreSQL/MongoDB service in Render
2. Link it to your backend service
3. Use the internal connection string

## Verify Deployment

After setting MongoDB URI:

1. Check health endpoint: https://prototype-to-mvp-backend.onrender.com/health
   - Should show: `"database": "connected"`

2. Check root endpoint: https://prototype-to-mvp-backend.onrender.com/
   - Should show API info with available endpoints

## Troubleshooting

### MongoDB Connection Fails
- Check MONGODB_URI is set correctly in Render environment
- For Atlas: ensure IP whitelist includes `0.0.0.0/0` (allow all)
- Check username/password in connection string are correct

### Deprecated Warnings (Fixed)
- Removed `useNewUrlParser` and `useUnifiedTopology` options
- Using latest Mongoose connection syntax

### 404 Errors (Fixed)
- Added root route `/` with API documentation
- Updated `/health` to show database status
