# GitHub Task Extension

A comprehensive GitHub issue management system with advanced task management features, built with Node.js, TypeScript, and React.

## Features

- **Enhanced Issue Management**: View and manage GitHub issues with advanced metadata
- **Dependency Tracking**: Parse and visualize issue dependencies
- **Real-time Synchronization**: Webhook integration for automatic updates
- **Priority & Category System**: Organize issues with custom metadata
- **Team Workload Management**: Track team member assignments and workload
- **Progress Dashboard**: Visual overview of project progress and statistics

## Architecture

- **Backend**: Node.js + TypeScript + Express.js
- **Frontend**: React + TypeScript + Material-UI
- **Database**: GitHub as single source of truth + Redis for caching
- **Authentication**: GitHub OAuth
- **Real-time Updates**: GitHub Webhooks

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- GitHub OAuth App (for authentication)
- Redis (optional, for caching)

### Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd github-task-extension
```

2. Set up the development environment:
```bash
make setup
```

3. Edit `.env` file with your GitHub OAuth credentials

4. Start development servers:
```bash
make dev
```

That's it! Both backend and frontend will start automatically.

### Alternative Installation

If you prefer npm commands:

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your GitHub OAuth credentials
```

3. Start the development servers:
```bash
npm run dev:full
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379
ENABLE_REDIS=false

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Logging
LOG_LEVEL=info
```

### GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App with:
   - Application name: `GitHub Task Extension`
   - Homepage URL: `http://localhost:3001`
   - Authorization callback URL: `http://localhost:3001/login`
3. Copy the Client ID and Client Secret to your `.env` file

### Webhook Setup (Optional)

For real-time synchronization:

1. Go to your repository Settings > Webhooks
2. Add webhook with:
   - Payload URL: `http://your-domain.com/api/webhooks/github`
   - Content type: `application/json`
   - Secret: Your webhook secret from `.env`
   - Events: Issues, Issue comments, Labels

## Development

### Available Commands

**Quick Commands (using Makefile):**
```bash
make help          # Show all available commands
make dev           # Start both backend and frontend
make dev-redis     # Start with Redis enabled
make build         # Build both backend and frontend
make test          # Run all tests
make clean         # Clean build artifacts
make setup         # Set up development environment
```

**Development:**
```bash
make dev-backend   # Start only backend
make dev-frontend  # Start only frontend
make dev-reset     # Reset development environment
```

**Testing:**
```bash
make test-backend  # Run backend tests only
make test-frontend # Run frontend tests only
make test-watch    # Run tests in watch mode
```

**Docker & Redis:**
```bash
make redis-start   # Start Redis container
make redis-stop    # Stop Redis container
make docker-up     # Start all services with Docker
make docker-down   # Stop Docker services
```

**Utilities:**
```bash
make lint          # Run linting
make format        # Format code
make health        # Check application health
make status        # Show current status
```

**NPM Scripts (alternative):**
- `npm run dev:full` - Start both backend and frontend
- `npm run build:all` - Build both backend and frontend
- `npm test` - Run all tests

### Testing

```bash
# Run all tests
npm test

# Run backend tests only
npm test -- --testPathPattern=src

# Run frontend tests only
npm run test:frontend

# Run tests in watch mode
npm run test:watch
npm run test:frontend:watch
```

### Redis Setup (Optional)

For better performance with caching:

```bash
# Using Docker
npm run redis:start

# Or install Redis locally
# macOS: brew install redis
# Ubuntu: sudo apt-get install redis-server
```

## API Documentation

### Authentication Endpoints

- `GET /api/auth/github` - Get GitHub OAuth URL
- `POST /api/auth/callback` - Handle OAuth callback
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout user

### Issue Management

- `GET /api/issues` - Get issues with metadata
- `GET /api/issues/:owner/:repo/:number` - Get specific issue
- `PUT /api/issues/:owner/:repo/:number/metadata` - Update issue metadata

### Metadata Management

- `GET /api/metadata/options` - Get available metadata options
- `POST /api/metadata/extract` - Extract metadata from labels
- `POST /api/metadata/convert` - Convert metadata to labels

### Dependency Analysis

- `POST /api/dependencies/parse` - Parse dependencies from issue body
- `POST /api/dependencies/validate` - Validate dependency relationships
- `POST /api/dependencies/graph` - Build dependency graph

### Webhooks

- `POST /api/webhooks/github` - GitHub webhook endpoint
- `GET /api/webhooks/stats` - Get webhook statistics
- `GET /api/webhooks/health` - Webhook health check

## Deployment

### Production Build

```bash
# Build both backend and frontend
npm run build:all

# Start production server
npm start
```

### Docker Deployment

```bash
# Build and start with Docker Compose
npm run docker:up

# With Redis
npm run docker:up:redis
```

### Environment Configuration

For production, ensure these environment variables are set:

- `NODE_ENV=production`
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
- `JWT_SECRET` (use a strong, random secret)
- `GITHUB_WEBHOOK_SECRET` (for webhook security)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- Create an issue in this repository
- Check the [documentation](docs/)
- Review the [API documentation](#api-documentation)