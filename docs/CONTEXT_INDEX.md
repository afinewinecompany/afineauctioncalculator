# Context Index for Claude Agents

## Quick Navigation

Use this index to quickly find relevant documentation for your task.

---

## By Agent Type

### Frontend Developer
| Document | When to Read |
|----------|--------------|
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | **Always** - Component structure, state management |
| [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md) | Adding/modifying components |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Setup, styling patterns |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | Understanding overall project |

### Backend Architect
| Document | When to Read |
|----------|--------------|
| [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) | **Always** - Complete schema, API layer design |
| [API_DESIGN.md](./API_DESIGN.md) | **Always** - REST endpoints, auth, WebSocket |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | Understanding data model |
| [../database/SETUP.md](../database/SETUP.md) | Database setup instructions |

### Database Architect
| Document | When to Read |
|----------|--------------|
| [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) | **Always** - Full schema with 14 tables |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | Understanding data requirements |
| [API_DESIGN.md](./API_DESIGN.md) | API data requirements |

### Fullstack Developer
| Document | When to Read |
|----------|--------------|
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | **Always** - Overall architecture |
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | Frontend changes |
| [API_DESIGN.md](./API_DESIGN.md) | Backend changes |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Development workflow |

### Test Engineer
| Document | When to Read |
|----------|--------------|
| [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md) | Understanding component interfaces |
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | Business logic location |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Testing setup section |

### UI/UX Designer
| Document | When to Read |
|----------|--------------|
| [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md) | Available UI components |
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | Styling patterns |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | Feature overview |

### Debugger
| Document | When to Read |
|----------|--------------|
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | State flow, component relationships |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Debugging section |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | Key files reference |

---

## By Task

### Understanding the Project
1. [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) - Start here
2. [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) - Data flow

### Setting Up Development
1. [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - Quick start

### Modifying Components
1. [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md) - Component inventory
2. [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) - Patterns

### Building Backend
1. [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) - Schema
2. [API_DESIGN.md](./API_DESIGN.md) - Endpoints
3. [../database/SETUP.md](../database/SETUP.md) - Database setup

### Adding Features
1. [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) - Current vs planned
2. [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - Feature checklist

---

## Key Files Quick Reference

### Must-Read Source Files

| File | Purpose |
|------|---------|
| `src/lib/types.ts` | All TypeScript interfaces |
| `src/App.tsx` | Root state management |
| `src/lib/calculations.ts` | Business logic |
| `src/components/DraftRoom.tsx` | Main draft interface |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies |
| `vite.config.ts` | Build configuration |
| `tsconfig.json` | TypeScript settings |
| `database/prisma/schema.prisma` | ORM schema |

---

## Project Summary

**Fantasy Baseball Auction Tool**

- **Purpose**: Optimize fantasy baseball draft budgets
- **Status**: MVP complete, ready for backend
- **Frontend**: React 18 + TypeScript + Vite + Tailwind
- **Backend (planned)**: PostgreSQL + Node.js + Prisma
- **Storage**: localStorage (current) → API (planned)

### Key Features
1. League configuration (scoring, rosters)
2. Draft room with player queue
3. Real-time inflation tracking
4. Value analysis (deal quality)
5. Post-draft analytics

### Open Work
1. Backend API implementation
2. JWT authentication
3. WebSocket for real-time drafts
4. Testing framework setup
5. Mobile optimization

---

## Document Versions

| Document | Version | Last Updated |
|----------|---------|--------------|
| PROJECT_CONTEXT.md | 1.0 | December 2024 |
| FRONTEND_ARCHITECTURE.md | 1.0 | December 2024 |
| API_DESIGN.md | 1.0 | December 2024 |
| COMPONENT_REFERENCE.md | 1.0 | December 2024 |
| DEVELOPMENT_GUIDE.md | 1.0 | December 2024 |
| DATABASE_ARCHITECTURE.md | 1.0 | December 2024 |

---

*This index is maintained by the context-manager agent*
