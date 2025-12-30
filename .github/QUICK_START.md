# CI/CD Quick Start Guide

## Prerequisites

- Node.js 20.x (use `nvm install` to auto-install from `.nvmrc`)
- npm (comes with Node.js)
- Git

## Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Verify installation
npm run lint
npm run type-check
npm run type-check:server
npm run test:unit

# 3. Build the project
npm run build
```

## Daily Development Workflow

### Before Starting Work

```bash
# Pull latest changes
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name
```

### During Development

```bash
# Start development server
npm run dev

# In another terminal, run tests in watch mode
npm run test:watch

# Run backend server (if needed)
npm run server:dev
```

### Before Committing

```bash
# Run all checks (this is what CI will run)
npm run lint:fix          # Fix linting issues
npm run type-check        # Check frontend types
npm run type-check:server # Check backend types
npm run test:unit         # Run unit tests
npm run build             # Verify build works

# If everything passes, commit
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

## Creating a Pull Request

1. **Push your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Go to GitHub** and create a Pull Request

3. **Wait for CI checks** to complete:
   - ✅ Lint
   - ✅ Type Check
   - ✅ Unit Tests
   - ✅ Build
   - ✅ Security Scan

4. **Address any failures** by pushing new commits

5. **Request review** when all checks pass

6. **Merge** after approval

## Common Commands

### Linting
```bash
npm run lint           # Check for issues
npm run lint:fix       # Auto-fix issues
```

### Type Checking
```bash
npm run type-check          # Frontend
npm run type-check:server   # Backend
```

### Testing
```bash
npm run test              # Interactive watch mode
npm run test:unit         # Run once
npm run test:coverage     # With coverage report
npm run test:ui           # Visual UI
npm run test:integration  # Integration tests
```

### Building
```bash
npm run build              # Build both
npm run build:frontend     # Build frontend only
npm run build:backend      # Build backend only
```

### Database (when implemented)
```bash
npm run db:migrate         # Run migrations (dev)
npm run db:migrate:deploy  # Run migrations (prod)
npm run db:generate        # Generate Prisma client
npm run db:studio          # Open Prisma Studio
npm run db:push            # Push schema changes
npm run db:seed            # Seed database
```

## Troubleshooting

### "ESLint errors"
```bash
npm run lint:fix
```

### "Type errors"
Check the error output and fix the reported issues in your code.

### "Tests failing"
```bash
npm run test:watch
# Fix tests interactively
```

### "Build failing"
```bash
npm run build
# Check console output for specific errors
```

### "Dependency issues"
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Node version mismatch"
```bash
nvm use
# or
nvm install
```

## CI/CD Pipeline Status

Check pipeline status:
- Go to **Actions** tab on GitHub
- View workflow runs
- Click on failed jobs to see logs

## Getting Help

1. Check `CI_CD_IMPLEMENTATION.md` for detailed documentation
2. Check `.github/workflows/README.md` for workflow details
3. Review error logs in GitHub Actions
4. Ask in team chat or create an issue

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run lint:fix` | Fix code style issues |
| `npm run type-check` | Check TypeScript types |
| `npm run test:unit` | Run unit tests |
| `npm run build` | Build for production |
| `npm run server:dev` | Run backend server |

---

**Remember**: The CI pipeline runs these same checks automatically. If they pass locally, they should pass in CI!
