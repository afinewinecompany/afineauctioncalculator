# Railway Deployment Setup Guide

This guide walks you through deploying the Fantasy Baseball Auction Tool to Railway with both frontend and backend services.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Railway Project                     │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Frontend   │  │   Backend    │  │  PostgreSQL  │  │
│  │   (Static)   │  │   (Express)  │  │   (Plugin)   │  │
│  │              │→ │              │→ │              │  │
│  │  Port: 3000  │  │  Port: 3001  │  │  Port: 5432  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  Optional: ┌──────────────┐                            │
│            │    Redis     │                            │
│            │   (Plugin)   │                            │
│            └──────────────┘                            │
└─────────────────────────────────────────────────────────┘
```

## Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Connect your GitHub account and select `afineauctioncalculator`

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **+ New**
2. Select **Database** → **PostgreSQL**
3. Railway will automatically create `DATABASE_URL` variable

## Step 3: Create Backend Service

1. Click **+ New** → **GitHub Repo**
2. Select your repository again (this creates a second service)
3. **Rename the service** to `backend` (click the service name)
4. Go to **Settings** tab for this service
5. Under **Build & Deploy**:
   - Set **Config Path**: `railway.backend.toml`
   - Or manually set:
     - Build Command: `npm ci && npx prisma generate && npm run build:backend`
     - Start Command: `npx prisma migrate deploy && npm run start:backend`

## Step 4: Create Frontend Service

1. Click **+ New** → **GitHub Repo**
2. Select your repository again
3. **Rename the service** to `frontend`
4. Go to **Settings** tab for this service
5. Under **Build & Deploy**:
   - Set **Config Path**: `railway.frontend.toml`
   - Or manually set:
     - Build Command: `npm ci && npm run build:frontend`
     - Start Command: `npx serve dist -l $PORT`

## Step 5: Configure Environment Variables

### Backend Service Variables

Go to backend service → **Variables** tab and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | *(auto from PostgreSQL)* | Should be auto-linked |
| `NODE_ENV` | `production` | Required |
| `PORT` | `3001` | Railway sets this automatically |
| `JWT_SECRET` | *(generate 32+ char string)* | **Required** - Use a password generator |
| `JWT_REFRESH_SECRET` | *(generate 32+ char string)* | **Required** - Different from JWT_SECRET |
| `FRONTEND_URL` | `https://frontend-xxxx.railway.app` | Your frontend Railway URL |
| `CORS_ORIGINS` | `https://frontend-xxxx.railway.app` | Same as FRONTEND_URL |
| `LOG_LEVEL` | `info` | Optional |
| `REDIS_URL` | *(auto if Redis added)* | Optional |

**Generate secure secrets:**
```bash
# Run this in terminal to generate a secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend Service Variables

Go to frontend service → **Variables** tab and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | `https://backend-xxxx.railway.app` | Your backend Railway URL |

## Step 6: Link PostgreSQL to Backend

1. Click on your PostgreSQL service
2. Go to **Connect** tab
3. Click **Add Variable Reference**
4. Select your **backend** service
5. This ensures `DATABASE_URL` is available to the backend

## Step 7: Deploy

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Add Railway deployment configuration"
   git push origin main
   ```

2. Railway will automatically:
   - Build both services
   - Run database migrations (backend)
   - Start both services

## Step 8: Verify Deployment

### Check Backend Health
```bash
curl https://your-backend-xxxx.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-29T...",
  "database": "connected",
  "redis": "not_configured"
}
```

### Check Frontend
Visit `https://your-frontend-xxxx.railway.app` in your browser.

## Troubleshooting

### Build Failures

**Prisma generation error:**
- Ensure `DATABASE_URL` is set before build
- Check that PostgreSQL plugin is properly linked

**TypeScript errors:**
- Run `npm run type-check` locally first
- Fix any type errors before pushing

### Runtime Errors

**Database connection refused:**
- Verify `DATABASE_URL` is linked from PostgreSQL plugin
- Check PostgreSQL service is running

**CORS errors:**
- Ensure `CORS_ORIGINS` includes your frontend URL
- Include `https://` in the URL

**JWT errors:**
- Verify `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
- Both must be at least 32 characters

### View Logs

1. Click on a service in Railway
2. Go to **Deployments** tab
3. Click on the active deployment
4. View **Build Logs** or **Deploy Logs**

## Optional: Add Redis

For better caching performance:

1. Click **+ New** → **Database** → **Redis**
2. Link `REDIS_URL` to your backend service
3. Redeploy backend

## Custom Domain (Optional)

1. Go to service **Settings**
2. Under **Networking** → **Public Networking**
3. Click **Generate Domain** or add custom domain
4. Update `CORS_ORIGINS` and `FRONTEND_URL` with new domain

## Environment Variable Quick Reference

### Backend (Required)
```env
NODE_ENV=production
JWT_SECRET=<64-character-hex-string>
JWT_REFRESH_SECRET=<64-character-hex-string>
FRONTEND_URL=https://your-frontend.railway.app
CORS_ORIGINS=https://your-frontend.railway.app
```

### Frontend (Required)
```env
VITE_API_URL=https://your-backend.railway.app
```

---

## Commands Reference

```bash
# Local development
npm run dev              # Start frontend dev server
npm run server:dev       # Start backend dev server

# Database
npm run db:migrate       # Create/run migrations
npm run db:studio        # Open Prisma Studio GUI

# Build
npm run build            # Build both frontend and backend
npm run build:frontend   # Build frontend only
npm run build:backend    # Build backend only

# Test
npm run test:unit        # Run unit tests
npm run test:coverage    # Run tests with coverage
```
