# Development Guide

## Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd github-task-extension
make setup

# Edit .env with your GitHub OAuth credentials
# Then start development
make dev
```

## Development Workflow

### Daily Development
```bash
make dev           # Start both servers
make test          # Run tests
make lint          # Check code quality
```

### With Redis (for caching)
```bash
make dev-redis     # Starts Redis container and servers
```

### Building
```bash
make build         # Build for production
make clean         # Clean build artifacts
```

## Project Structure

```
├── src/                    # Backend source code
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── middleware/        # Express middleware
│   └── utils/             # Utilities
├── frontend/              # Frontend source code
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API clients
│   │   └── utils/         # Frontend utilities
│   └── public/            # Static assets
├── .kiro/specs/           # Feature specifications
└── docs/                  # Documentation
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# GitHub OAuth (required)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Optional
REDIS_URL=redis://localhost:6379
ENABLE_REDIS=false
JWT_SECRET=your_jwt_secret
```

## GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth App:
   - Application name: `GitHub Task Extension`
   - Homepage URL: `http://localhost:3001`
   - Authorization callback URL: `http://localhost:3001/login`
3. Copy Client ID and Secret to `.env`

## Testing

```bash
make test              # All tests
make test-backend      # Backend only
make test-frontend     # Frontend only
make test-watch        # Watch mode
```

## Debugging

### VSCode
- Use F5 to start debugging
- Configurations available:
  - Debug Backend
  - Debug Backend with Redis
  - Debug Tests

### Manual Debugging
```bash
# Backend with debugger
npm run dev -- --inspect

# Frontend with React DevTools
npm run dev:frontend
```

## Docker Development

```bash
make docker-up         # Start all services
make redis-start       # Redis only
make docker-down       # Stop services
```

## Code Quality

```bash
make lint              # Check linting
make format            # Fix formatting
make commit-check      # Pre-commit checks
```

## Troubleshooting

### Port Already in Use
```bash
# Kill processes on ports 3000/3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Redis Connection Issues
```bash
make redis-status      # Check Redis status
make redis-start       # Start Redis
# Or disable Redis: ENABLE_REDIS=false
```

### Build Issues
```bash
make clean             # Clean build artifacts
make dev-reset         # Full reset
```

### Cache Issues
```bash
make cache-clear       # Clear Redis cache
rm -rf node_modules/.cache/  # Clear build cache
```

## Performance Tips

1. **Use Redis for caching** (set `ENABLE_REDIS=true`)
2. **Enable hot reload** (default in development)
3. **Use TypeScript strict mode** (already enabled)
4. **Monitor bundle size** (`npm run build:frontend`)

## Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Make changes and test: `make test`
3. Check code quality: `make commit-check`
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Create Pull Request

## Useful Commands

```bash
# Health check
make health

# Show current status
make status

# View logs
make logs

# Reset everything
make dev-reset
```

## IDE Setup

### VSCode Extensions (Recommended)
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Auto Rename Tag
- Bracket Pair Colorizer
- GitLens
- Thunder Client (for API testing)

### Settings
VSCode settings are included in `.vscode/settings.json`

## API Testing

Use Thunder Client, Postman, or curl:

```bash
# Health check
curl http://localhost:3000/health

# Get issues (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/issues/owner/repo
```

## Deployment

See main README.md for production deployment instructions.