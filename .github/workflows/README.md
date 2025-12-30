# CI/CD Workflows

This directory contains GitHub Actions workflows for continuous integration and deployment.

## Workflows

### 1. CI/CD Pipeline (`ci.yml`)

**Trigger**: Push to `main` or Pull Requests to `main`

**Jobs**:
1. **Lint** - Runs ESLint and TypeScript type checking
2. **Test** - Runs unit tests with coverage reporting
3. **Build** - Builds both frontend and backend
4. **Integration** - Runs integration tests (main branch only)
5. **Deploy Staging** - Deploys to staging environment (main branch only)
6. **Security** - Runs security scans (PRs only)

**Status Badges**:
```markdown
![CI/CD](https://github.com/USERNAME/REPO/workflows/CI%2FCD%20Pipeline/badge.svg)
```

### 2. Production Deployment (`deploy-production.yml`)

**Trigger**: Manual (workflow_dispatch)

**Jobs**:
1. **Validate** - Validates deployment confirmation
2. **Pre-Deployment Checks** - Runs all tests and builds
3. **Deploy Frontend** - Deploys to Vercel production
4. **Deploy Backend** - Deploys to Railway production
5. **Post-Deployment** - Verifies deployment health

**Requirements**:
- Type "DEPLOY" in the confirmation input
- Requires production environment approval

## Required Secrets

Configure these secrets in GitHub repository settings (Settings → Secrets and variables → Actions):

### Vercel
- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

### Railway
- `RAILWAY_TOKEN` - Railway API token

### Code Coverage (Optional)
- `CODECOV_TOKEN` - Codecov upload token

### Security Scanning (Optional)
- `SNYK_TOKEN` - Snyk API token

## Environment Setup

### Staging Environment
Configure in GitHub: Settings → Environments → New environment

- Name: `staging`
- No protection rules (auto-deploy on main)

### Production Environment
Configure in GitHub: Settings → Environments → New environment

- Name: `production`
- Protection rules:
  - [x] Required reviewers (1-2 reviewers)
  - [x] Wait timer: 5 minutes (optional)

## Local Testing

Before pushing, run these commands locally:

```bash
# Install dependencies
npm ci

# Run linting
npm run lint

# Run type checking
npm run type-check
npm run type-check:server

# Run tests
npm run test:unit

# Run build
npm run build
```

## Workflow Customization

### Modify Coverage Thresholds

Edit `vitest.config.ts`:
```typescript
coverage: {
  thresholds: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

### Change Deployment Conditions

Edit `.github/workflows/ci.yml`:
```yaml
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

### Add New Jobs

Follow this template:
```yaml
new-job:
  name: Job Name
  runs-on: ubuntu-latest
  needs: [previous-job]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
    - run: npm run your-command
```

## Troubleshooting

### Pipeline Failing

1. **Linting Errors**
   ```bash
   npm run lint:fix
   ```

2. **Type Errors**
   ```bash
   npm run type-check
   # Fix reported errors
   ```

3. **Test Failures**
   ```bash
   npm run test:coverage
   # Fix failing tests
   ```

4. **Build Errors**
   ```bash
   npm run build
   # Check console output
   ```

### Deployment Failing

1. **Check secrets** - Verify all required secrets are set
2. **Check environment** - Ensure environment is properly configured
3. **Check logs** - Review workflow logs in Actions tab
4. **Manual deployment** - Try deploying manually to isolate issue

### Coverage Not Uploading

- Verify `CODECOV_TOKEN` is set
- Check coverage files are being generated
- Review Codecov GitHub Action logs

## Best Practices

1. **Always test locally first** before pushing
2. **Keep workflows fast** - Parallel jobs when possible
3. **Use caching** - npm dependencies are cached automatically
4. **Monitor pipeline health** - Fix broken builds immediately
5. **Review security alerts** - Act on Dependabot and Snyk findings
6. **Keep secrets secure** - Never commit tokens or passwords

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Railway CLI Documentation](https://docs.railway.app/develop/cli)
- [Vitest Documentation](https://vitest.dev/)
- [ESLint Documentation](https://eslint.org/docs/latest/)
