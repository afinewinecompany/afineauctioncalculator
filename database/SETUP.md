# Database Setup Guide

This guide walks you through setting up the database for the Fantasy Baseball Auction Tool.

---

## Quick Start (Recommended: Supabase)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project
3. Wait for the database to be provisioned (~2 minutes)
4. Go to **Settings > Database** to get your connection string

### 2. Run Migrations

**Option A: Using Supabase SQL Editor**

1. Go to **SQL Editor** in Supabase dashboard
2. Copy the contents of `migrations/001_initial_schema.sql`
3. Paste and click **Run**

**Option B: Using psql CLI**

```bash
# Get your connection string from Supabase
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f migrations/001_initial_schema.sql
```

### 3. Configure Environment

Create a `.env` file in the project root:

```env
# Supabase
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_KEY=[YOUR-SERVICE-KEY]
```

---

## Alternative: Local Docker Setup

### 1. Start PostgreSQL Container

```bash
docker run -d \
  --name fantasy-baseball-db \
  -e POSTGRES_USER=fantasy \
  -e POSTGRES_PASSWORD=fantasy123 \
  -e POSTGRES_DB=fantasy_baseball \
  -p 5432:5432 \
  -v fantasy_baseball_data:/var/lib/postgresql/data \
  postgres:15-alpine
```

### 2. Run Migrations

```bash
# Wait for container to be ready
sleep 5

# Run migration
docker exec -i fantasy-baseball-db psql -U fantasy -d fantasy_baseball < migrations/001_initial_schema.sql
```

### 3. Configure Environment

```env
DATABASE_URL=postgresql://fantasy:fantasy123@localhost:5432/fantasy_baseball
```

---

## Alternative: Local PostgreSQL Installation

### macOS (Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@15

# Start service
brew services start postgresql@15

# Create database
createdb fantasy_baseball

# Run migration
psql -d fantasy_baseball -f migrations/001_initial_schema.sql
```

### Windows

1. Download from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run installer with default options
3. Open pgAdmin or psql
4. Create database `fantasy_baseball`
5. Run migration script

### Linux (Ubuntu/Debian)

```bash
# Install
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql

# Create database
sudo -u postgres createdb fantasy_baseball

# Run migration
sudo -u postgres psql -d fantasy_baseball -f migrations/001_initial_schema.sql
```

---

## Verify Installation

Connect to your database and run:

```sql
-- Check tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should see:
-- activity_log
-- draft_picks
-- draft_snapshots
-- league_players
-- league_point_values
-- league_roster_spots
-- league_scoring_categories
-- leagues
-- player_positions
-- player_projections
-- players
-- refresh_tokens
-- user_leagues
-- user_oauth_tokens
-- users

-- Check enums
SELECT typname FROM pg_type WHERE typcategory = 'E';

-- Should see:
-- auth_provider
-- draft_pick_status
-- league_role
-- league_status
-- projection_system
-- scoring_type

-- Test inflation function
SELECT calculate_inflation_rate('00000000-0000-0000-0000-000000000000'::UUID);
-- Should return 0 (no league exists)
```

---

## Seed Sample Data (Optional)

For development/testing, you can seed sample players:

```sql
-- Insert sample players (from mockData.ts)
INSERT INTO players (name, team, primary_position) VALUES
  ('Aaron Judge', 'NYY', 'OF'),
  ('Ronald Acuna Jr.', 'ATL', 'OF'),
  ('Mookie Betts', 'LAD', 'OF'),
  ('Freddie Freeman', 'LAD', '1B'),
  ('Jose Ramirez', 'CLE', '3B'),
  ('Corey Seager', 'TEX', 'SS'),
  ('Spencer Strider', 'ATL', 'SP'),
  ('Gerrit Cole', 'NYY', 'SP'),
  ('Emmanuel Clase', 'CLE', 'RP');

-- Add positions
INSERT INTO player_positions (player_id, position_code)
SELECT id, 'OF' FROM players WHERE name = 'Aaron Judge';

INSERT INTO player_positions (player_id, position_code)
SELECT id, 'OF' FROM players WHERE name = 'Ronald Acuna Jr.';

-- Add more as needed...

-- Insert projections
INSERT INTO player_projections (
  player_id, projection_system, season_year,
  home_runs, rbi, stolen_bases, batting_avg, projected_value, tier
)
SELECT
  id, 'steamer', 2025,
  58, 144, 10, 0.311, 51, 1
FROM players WHERE name = 'Aaron Judge';

-- Add more projections...
```

A full seed script is available at `database/seeds/sample_players.sql` (to be created).

---

## Redis Setup (Optional - for real-time features)

### Using Docker

```bash
docker run -d \
  --name fantasy-baseball-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### Using Upstash (Free Cloud Redis)

1. Go to [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy connection details to `.env`:

```env
REDIS_URL=redis://default:[PASSWORD]@[HOST]:6379
```

---

## Production Considerations

### Connection Pooling

For production, use a connection pooler:

**Supabase:** Built-in pgBouncer, use port 6543 instead of 5432

**Self-hosted:** Use PgBouncer

```bash
# In your connection string
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true
```

### Backups

**Supabase:** Automatic daily backups included

**Self-hosted:**

```bash
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20241223.sql
```

### SSL/TLS

Always use SSL in production:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

---

## Prisma ORM Setup (Recommended for API)

If building the API server with Node.js:

```bash
# Initialize Prisma
cd server
npm init -y
npm install prisma @prisma/client

# Initialize Prisma with existing database
npx prisma init

# Pull schema from database
npx prisma db pull

# Generate Prisma Client
npx prisma generate
```

Your `prisma/schema.prisma` will be auto-generated from the database.

---

## Troubleshooting

### Connection refused

```bash
# Check if PostgreSQL is running
docker ps | grep postgres
# or
systemctl status postgresql
```

### Permission denied

```bash
# Grant permissions (local dev only)
sudo -u postgres psql -c "ALTER USER your_user WITH SUPERUSER;"
```

### Migration failed

```bash
# Check error details
psql $DATABASE_URL -c "\dt"

# Drop and recreate (dev only!)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

---

## Next Steps

1. Set up the API server (see `server/README.md`)
2. Update the frontend to use API instead of localStorage
3. Configure authentication (JWT + OAuth)
4. Set up Redis for real-time draft features

---

*Last Updated: December 2024*
