# Deployment Guide

This guide covers deploying the Fantasy Baseball Auction Tool to production using **Vercel (frontend)** and **Railway (backend)**.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
┌───────▼────────┐              ┌────────▼────────┐
│  Vercel (CDN)  │              │     Railway     │
│   Static SPA   │  API calls   │  Express Server │
└────────────────┘◄─────────────┤   PostgreSQL    │
                                 │      Redis      │
                                 └─────────────────┘
```

**Frontend**: Deployed to Vercel as static files (React SPA)
**Backend**: Deployed to Railway with PostgreSQL and Redis plugins

---

## Prerequisites

### Accounts Needed

1. **GitHub** - For code hosting and CI/CD triggers
2. **Vercel** - For frontend deployment (free tier available)
3. **Railway** - For backend, database, and Redis (5 free credits/month)

### Tools Needed

```bash
npm install -g vercel
npm install -g @railway/cli
```

---

## Phase 1: Backend Deployment (Railway)

### 1.1 Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect the `railway.toml` configuration

### 1.2 Add PostgreSQL Plugin

1. In Railway project → "New" → "Database" → "PostgreSQL"
2. Railway automatically sets `DATABASE_URL` environment variable
3. No additional configuration needed

### 1.3 Add Redis Plugin

1. In Railway project → "New" → "Database" → "Redis"
2. Railway automatically sets `REDIS_URL` environment variable
3. No additional configuration needed

### 1.4 Set Environment Variables

In Railway dashboard → Your service → "Variables" tab, add:

```env
# Required
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-app.vercel.app
CORS_ORIGINS=https://your-app.vercel.app
JWT_SECRET=<generate-secure-32-char-string>
JWT_REFRESH_SECRET=<generate-different-32-char-string>

# Optional but recommended
LOG_LEVEL=info
SENTRY_DSN=<your-sentry-dsn>

# Auto-injected by Railway (no need to set)
# DATABASE_URL=<from-postgresql-plugin>
# REDIS_URL=<from-redis-plugin>
```

**Generate secure JWT secrets**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 1.5 Deploy Backend

Railway will auto-deploy on every push to `main`. To deploy manually:

```bash
railway up
```

Or using npm script:
```bash
npm run deploy:backend
```

### 1.6 Run Database Migrations

After first deployment:

```bash
railway run npm run db:migrate:deploy
```

### 1.7 Verify Backend Health

Visit: `https://your-backend.railway.app/api/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-29T...",
  "environment": "production",
  "uptime": 123.45,
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

---

## Phase 2: Frontend Deployment (Vercel)

### 2.1 Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the `vercel.json` configuration

### 2.2 Set Environment Variables

In Vercel dashboard → Your project → "Settings" → "Environment Variables":

```env
VITE_API_URL=https://your-backend.railway.app
```

**Important**: Don't include trailing slash in `VITE_API_URL`

### 2.3 Deploy Frontend

Vercel auto-deploys on every push to `main`. To deploy manually:

```bash
vercel --prod
```

Or using npm script:
```bash
npm run deploy:frontend
```

### 2.4 Verify Frontend

Visit: `https://your-app.vercel.app`

Check that:
1. App loads correctly
2. API calls work (check Network tab in DevTools)
3. No CORS errors in console

---

## Phase 3: Configure Custom Domain (Optional)

### 3.1 Add Domain to Vercel

1. In Vercel dashboard → Your project → "Settings" → "Domains"
2. Add your domain (e.g., `fantasyauction.com`)
3. Follow DNS configuration instructions

### 3.2 Add Subdomain for API (Optional)

If you want `api.fantasyauction.com` for backend:

1. In Railway → Your service → "Settings" → "Custom Domain"
2. Add `api.fantasyauction.com`
3. Update DNS with Railway's CNAME

Update frontend env:
```env
VITE_API_URL=https://api.fantasyauction.com
```

Update backend CORS:
```env
FRONTEND_URL=https://fantasyauction.com
CORS_ORIGINS=https://fantasyauction.com
```

---

## Phase 4: CI/CD with GitHub Actions

### 4.1 Create Deployment Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # Run tests and linting
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit
      - run: npm run build

  # Auto-deploy to Railway and Vercel
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Both Vercel and Railway auto-deploy via GitHub integration
      # This job just ensures tests pass before deployment
      - run: echo "Deployment triggered automatically"
```

---

## Environment Variables Reference

### Backend (.env on Railway)

```env
# Database (auto-injected by Railway)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Security
JWT_SECRET=<32-char-secret>
JWT_REFRESH_SECRET=<32-char-secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Environment
NODE_ENV=production
PORT=3001

# CORS
FRONTEND_URL=https://your-app.vercel.app
CORS_ORIGINS=https://your-app.vercel.app

# Optional
LOG_LEVEL=info
SENTRY_DSN=<sentry-dsn>
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-secret>
```

### Frontend (.env.production on Vercel)

```env
# API URL (required)
VITE_API_URL=https://your-backend.railway.app
```

---

## Troubleshooting

### Frontend can't reach backend

**Symptom**: CORS errors or 404s on API calls

**Solutions**:
1. Check `VITE_API_URL` is set correctly in Vercel
2. Verify `CORS_ORIGINS` includes your Vercel domain in Railway
3. Ensure backend is deployed and healthy (`/api/health`)
4. Check browser DevTools → Network tab for actual URL being called

### Database connection errors

**Symptom**: 503 errors from `/api/health`

**Solutions**:
1. Verify `DATABASE_URL` is set in Railway
2. Run migrations: `railway run npm run db:migrate:deploy`
3. Check Railway logs for connection errors
4. Ensure PostgreSQL plugin is running

### Redis not working

**Symptom**: Slow performance, file cache warnings in logs

**Solutions**:
1. Verify `REDIS_URL` is set in Railway
2. Check Redis plugin is running in Railway dashboard
3. Backend should work without Redis (falls back to file cache)
4. Check logs for Redis connection errors

### Build failures

**Symptom**: Deployment fails with build errors

**Solutions**:
1. Run `npm run build` locally to test
2. Check TypeScript errors: `npm run type-check`
3. Ensure all dependencies are in `package.json` (not just `devDependencies`)
4. Check Railway/Vercel build logs for specific errors

---

## Monitoring and Maintenance

### Check Application Health

**Backend**:
```bash
curl https://your-backend.railway.app/api/health
```

**Frontend**:
```bash
curl -I https://your-app.vercel.app
```

### View Logs

**Railway**:
- Dashboard → Your service → "Deployments" → Click deployment → "Logs"

**Vercel**:
- Dashboard → Your project → "Functions" → Filter by errors

### Database Backups

Railway PostgreSQL includes automatic daily backups. To create manual backup:

1. Railway dashboard → PostgreSQL plugin
2. "Backups" tab → "Create Backup"

### Redis Persistence

Railway Redis uses RDB persistence by default. Data survives restarts.

---

## Cost Estimation

### Railway (Backend + Database + Redis)

- **Free tier**: $5 in credits/month
- **Hobby**: $20/month (includes $5 credit)
- Typical usage: ~$15-25/month for small-medium traffic

### Vercel (Frontend)

- **Free tier**: 100GB bandwidth/month
- **Pro**: $20/month for team features
- Typical usage: Free tier sufficient for small-medium traffic

### Total Monthly Cost

- **Development**: $0 (Railway free credits + Vercel free tier)
- **Small production**: $15-25/month
- **Medium production**: $40-60/month

---

## Security Checklist

Before going to production:

- [ ] JWT secrets are secure random strings (32+ chars)
- [ ] CORS restricted to your domain (not `*`)
- [ ] HTTPS enforced (automatic with Railway/Vercel)
- [ ] Database backups enabled
- [ ] Error tracking configured (Sentry)
- [ ] Rate limiting enabled (already configured)
- [ ] Secrets not in code (use environment variables)
- [ ] `.env` files in `.gitignore`

---

## Rollback Procedure

### Roll back frontend

```bash
vercel rollback
```

Or in Vercel dashboard → "Deployments" → Click previous deployment → "Promote to Production"

### Roll back backend

In Railway dashboard:
1. Go to "Deployments"
2. Click on previous successful deployment
3. Click "Redeploy"

### Roll back database

```bash
railway run npm run db:migrate:rollback
```

Or restore from backup in Railway dashboard.

---

*Last Updated: December 2025*
