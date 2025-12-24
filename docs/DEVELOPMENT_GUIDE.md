# Development Guide

## Overview

This guide covers everything needed to set up, develop, and extend the Fantasy Baseball Auction Tool.

---

## Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| npm | 9+ | Package manager |
| Git | 2.x | Version control |
| VS Code | Latest | Recommended IDE |

### Optional (for backend development)

| Software | Version | Purpose |
|----------|---------|---------|
| PostgreSQL | 15+ | Database |
| Docker | 24+ | Container runtime |
| Redis | 7+ | Caching (optional) |

---

## Quick Start

```bash
# Clone repository
git clone <repository-url>
cd afineauctioncalculator

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
# http://localhost:3000
```

---

## Project Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Build for production to `/build` |

---

## Directory Structure

```
afineauctioncalculator/
├── src/
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui library
│   │   └── *.tsx            # Business components
│   ├── lib/
│   │   ├── types.ts         # TypeScript types
│   │   ├── calculations.ts  # Business logic
│   │   ├── mockData.ts      # Sample data
│   │   └── utils.ts         # Utilities
│   ├── assets/              # Static images
│   ├── App.tsx              # Root component
│   └── main.tsx             # Entry point
├── database/
│   ├── migrations/          # SQL migrations
│   ├── prisma/              # Prisma schema
│   └── SETUP.md             # DB setup guide
├── docs/                    # Documentation
├── .claude/                 # Claude agent configs
├── index.html               # HTML template
├── package.json             # Dependencies
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript config
└── README.md                # Project readme
```

---

## Development Workflow

### 1. Starting Development

```bash
npm run dev
```

This starts Vite with:
- Hot Module Replacement (HMR)
- Fast refresh for React components
- TypeScript type checking
- Port 3000 (auto-opens browser)

### 2. Making Changes

1. **Edit component files** in `src/components/`
2. **Changes appear instantly** via HMR
3. **Check browser console** for errors
4. **TypeScript errors** shown in terminal

### 3. Adding New Components

```bash
# Create new component file
touch src/components/NewComponent.tsx
```

```typescript
// src/components/NewComponent.tsx
import { FC } from 'react';

interface NewComponentProps {
  title: string;
  onAction: () => void;
}

export const NewComponent: FC<NewComponentProps> = ({ title, onAction }) => {
  return (
    <div className="p-4 bg-slate-900 rounded-lg">
      <h2 className="text-white">{title}</h2>
      <button onClick={onAction}>Click Me</button>
    </div>
  );
};
```

### 4. Adding UI Components (shadcn/ui)

```bash
# Add a new shadcn/ui component
npx shadcn-ui@latest add [component-name]

# Examples:
npx shadcn-ui@latest add combobox
npx shadcn-ui@latest add date-picker
```

---

## Type System

### Core Types (src/lib/types.ts)

```typescript
// League configuration
interface LeagueSettings {
  leagueName: string;
  numTeams: number;
  budgetPerTeam: number;
  scoringType: 'rotisserie' | 'h2h-categories' | 'h2h-points';
  projectionSystem: 'steamer' | 'batx' | 'ja';
  rosterSpots: RosterSpots;
  hittingCategories?: HittingCategories;
  pitchingCategories?: PitchingCategories;
  pointsSettings?: PointsSettings;
}

// Player data
interface Player {
  id: string;
  name: string;
  team: string;
  positions: string[];
  projectedValue: number;
  adjustedValue: number;
  projectedStats: ProjectedStats;
  status: 'available' | 'drafted' | 'onMyTeam';
  draftedPrice?: number;
  draftedBy?: string;
  tier?: number;
}

// User session
interface UserData {
  username: string;
  email: string;
  leagues: SavedLeague[];
  authProvider?: 'email' | 'google';
  profilePicture?: string;
}
```

### Adding New Types

```typescript
// 1. Define interface in src/lib/types.ts
export interface NewFeature {
  id: string;
  name: string;
  config: FeatureConfig;
}

// 2. Export from types.ts
export type { NewFeature };

// 3. Import in components
import type { NewFeature } from '../lib/types';
```

---

## State Management

### Current Pattern: React State + localStorage

```typescript
// App.tsx - Global state pattern
const [userData, setUserData] = useState<UserData | null>(null);

// Load from localStorage
useEffect(() => {
  const saved = localStorage.getItem('fantasyBaseballUser');
  if (saved) setUserData(JSON.parse(saved));
}, []);

// Save to localStorage
useEffect(() => {
  if (userData) {
    localStorage.setItem('fantasyBaseballUser', JSON.stringify(userData));
  }
}, [userData]);
```

### Passing State to Children

```typescript
// Parent passes state and handlers
<DraftRoom
  settings={currentLeague.settings}
  players={players}
  onComplete={handleDraftComplete}
/>

// Child uses props
function DraftRoom({ settings, players, onComplete }) {
  // Local state for draft-specific data
  const [myRoster, setMyRoster] = useState<Player[]>([]);
  // ...
}
```

---

## Styling Guide

### Tailwind CSS Patterns

```tsx
// Dark theme background
<div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">

// Card with glass effect
<div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700/50">

// Accent colors
<span className="text-emerald-400">   // Success/primary
<span className="text-amber-400">     // Warning
<span className="text-red-400">       // Error/danger
<span className="text-blue-400">      // Info

// Button gradient
<button className="bg-gradient-to-r from-emerald-600 to-green-700
  hover:from-emerald-700 hover:to-green-800
  shadow-lg shadow-emerald-500/30">
```

### Common Class Combinations

```tsx
// Page container
"min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950"

// Section card
"bg-slate-900 rounded-xl shadow-2xl border border-slate-700/50 p-6"

// Table header
"bg-slate-800/50 text-slate-300 font-medium"

// Form input
"bg-slate-800 border-slate-600 text-white placeholder-slate-400"
```

---

## Adding Features

### Feature Development Checklist

1. **Define types** in `src/lib/types.ts`
2. **Create component** in `src/components/`
3. **Add business logic** in `src/lib/calculations.ts`
4. **Wire up state** in parent component
5. **Add to routing** in `App.tsx` if new screen
6. **Update docs** if significant feature

### Example: Adding a New Draft Feature

```typescript
// 1. types.ts - Add interface
interface DraftTimer {
  duration: number;
  remaining: number;
  isPaused: boolean;
}

// 2. Create component
// src/components/DraftTimer.tsx
export function DraftTimer({ duration, onExpire }: DraftTimerProps) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          onExpire();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onExpire]);

  return <div className="text-2xl text-white">{remaining}s</div>;
}

// 3. Use in DraftRoom.tsx
<DraftTimer duration={30} onExpire={handleNominationExpire} />
```

---

## Testing (Recommended Setup)

### Install Testing Dependencies

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

### Configure Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Example Test

```typescript
// src/components/__tests__/PlayerQueue.test.tsx
import { render, screen } from '@testing-library/react';
import { PlayerQueue } from '../PlayerQueue';
import { mockPlayers } from '../../lib/mockData';

describe('PlayerQueue', () => {
  it('renders available players', () => {
    render(
      <PlayerQueue
        players={mockPlayers}
        onDraftPlayer={vi.fn()}
        onPlayerClick={vi.fn()}
      />
    );

    expect(screen.getByText('Aaron Judge')).toBeInTheDocument();
  });
});
```

---

## Building for Production

```bash
# Create production build
npm run build

# Output is in /build directory
```

### Build Output

```
build/
├── index.html
├── assets/
│   ├── index-[hash].js      # Bundled JS
│   ├── index-[hash].css     # Bundled CSS
│   └── [images]             # Optimized images
```

### Deployment Options

| Platform | Command/Process |
|----------|-----------------|
| Vercel | `vercel --prod` |
| Netlify | Drag & drop `/build` |
| GitHub Pages | Push to `gh-pages` branch |
| AWS S3 | `aws s3 sync build/ s3://bucket` |

---

## Backend Development

### Setting Up PostgreSQL

See [database/SETUP.md](../database/SETUP.md) for detailed instructions.

Quick start with Docker:

```bash
# Start PostgreSQL
docker run -d \
  --name fantasy-db \
  -e POSTGRES_USER=fantasy \
  -e POSTGRES_PASSWORD=fantasy123 \
  -e POSTGRES_DB=fantasy_baseball \
  -p 5432:5432 \
  postgres:15-alpine

# Run migrations
docker exec -i fantasy-db psql -U fantasy -d fantasy_baseball \
  < database/migrations/001_initial_schema.sql
```

### Creating Backend API

```bash
# Create server directory
mkdir server && cd server
npm init -y

# Install dependencies
npm install express cors dotenv prisma @prisma/client
npm install -D typescript @types/express @types/node ts-node-dev

# Initialize Prisma
npx prisma init
```

---

## Environment Variables

### Frontend (.env)

```env
# Currently none required for frontend MVP
# Future: API endpoints
VITE_API_URL=http://localhost:3001/api
```

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/fantasy_baseball

# Auth
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret

# Server
PORT=3001
NODE_ENV=development
```

---

## Debugging

### Browser DevTools

1. **React DevTools** - Component tree inspection
2. **Network Tab** - API calls (future)
3. **Application Tab** - localStorage inspection

### VS Code Debugging

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
```

---

## Code Style

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `DraftRoom.tsx` |
| Hooks | camelCase with `use` | `useDraftState` |
| Utilities | camelCase | `calculateInflation` |
| Types | PascalCase | `LeagueSettings` |
| Constants | SCREAMING_SNAKE | `MAX_BUDGET` |

### File Organization

```typescript
// Component file structure
import { useState, useEffect } from 'react';     // 1. React imports
import { Button } from '@/components/ui/button'; // 2. UI components
import { Player } from '../lib/types';           // 3. Types
import { calculateValue } from '../lib/utils';   // 4. Utilities

interface Props { }                              // 5. Interface

export function Component({ }: Props) {          // 6. Component
  // State
  // Effects
  // Handlers
  // Render
}
```

---

## Common Tasks

### Adding a New Screen

1. Create component in `src/components/NewScreen.tsx`
2. Add to `AppScreen` type in `App.tsx`
3. Add state and handler in `App.tsx`
4. Add conditional render in `App.tsx`

### Adding a New Form Field

1. Add type to `LeagueSettings` in `types.ts`
2. Add input in `SetupScreen.tsx` or `ScoringConfig.tsx`
3. Handle in form submission

### Modifying Calculations

1. Edit `src/lib/calculations.ts`
2. Update any components using the function
3. Add/update tests

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Port 3000 in use | Kill process or change port in `vite.config.ts` |
| Module not found | Run `npm install` |
| Type errors | Check `types.ts` for correct interface |
| HMR not working | Restart dev server |

### Getting Help

1. Check existing docs in `/docs`
2. Search codebase for similar patterns
3. Consult Claude agents in `.claude/agents/`

---

## Related Documentation

- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) - Project overview
- [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) - React architecture
- [API_DESIGN.md](./API_DESIGN.md) - API endpoints
- [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md) - Component inventory
- [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) - Database design
- [database/SETUP.md](../database/SETUP.md) - Database setup

---

*Document Version: 1.0*
*Last Updated: December 2024*
