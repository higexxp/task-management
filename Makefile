# GitHub Task Extension - Development Makefile

.PHONY: help install dev dev-redis build test clean docker-up docker-down

# Default target
help:
	@echo "GitHub Task Extension - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make install     - Install all dependencies"
	@echo "  make dev         - Start both backend and frontend in development mode"
	@echo "  make dev-redis   - Start with Redis enabled"
	@echo "  make dev-backend - Start only backend server"
	@echo "  make dev-frontend- Start only frontend server"
	@echo ""
	@echo "Building:"
	@echo "  make build       - Build both backend and frontend"
	@echo "  make build-backend - Build only backend"
	@echo "  make build-frontend - Build only frontend"
	@echo ""
	@echo "Testing:"
	@echo "  make test        - Run all tests"
	@echo "  make test-backend - Run backend tests only"
	@echo "  make test-frontend - Run frontend tests only"
	@echo "  make test-watch  - Run tests in watch mode"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up   - Start services with Docker Compose"
	@echo "  make docker-down - Stop Docker services"
	@echo "  make redis-start - Start Redis container"
	@echo "  make redis-stop  - Stop Redis container"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean       - Clean build artifacts"
	@echo "  make lint        - Run linting for all code"
	@echo "  make format      - Format all code"
	@echo "  make logs        - Show application logs"

# Installation
install:
	@echo "📦 Installing dependencies..."
	npm install

# Development - Main commands
dev:
	@echo "🚀 Starting development servers (Backend + Frontend)..."
	npm run dev:full

dev-redis:
	@echo "🚀 Starting development servers with Redis..."
	@make redis-start
	@sleep 2
	ENABLE_REDIS=true npm run dev:full

dev-backend:
	@echo "🚀 Starting backend server only..."
	npm run dev

dev-frontend:
	@echo "🚀 Starting frontend server only..."
	npm run dev:frontend

# Building
build: build-backend build-frontend
	@echo "✅ Build completed!"

build-backend:
	@echo "🔨 Building backend..."
	npm run build

build-frontend:
	@echo "🔨 Building frontend..."
	npm run build:frontend

# Testing
test:
	@echo "🧪 Running all tests..."
	npm test

test-backend:
	@echo "🧪 Running backend tests..."
	npm test -- --testPathPattern=src

test-frontend:
	@echo "🧪 Running frontend tests..."
	npm run test:frontend

test-watch:
	@echo "🧪 Running tests in watch mode..."
	npm run test:watch

# Docker and Redis
docker-up:
	@echo "🐳 Starting Docker services..."
	npm run docker:up

docker-down:
	@echo "🐳 Stopping Docker services..."
	npm run docker:down

redis-start:
	@echo "🔴 Starting Redis container..."
	npm run redis:start

redis-stop:
	@echo "🔴 Stopping Redis container..."
	npm run redis:stop

redis-status:
	@echo "🔴 Redis container status:"
	npm run redis:status

# Utilities
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf dist/
	rm -rf node_modules/.cache/
	rm -rf frontend/dist/
	@echo "✅ Clean completed!"

lint:
	@echo "🔍 Running linting..."
	npm run lint
	npm run lint:frontend

lint-fix:
	@echo "🔧 Fixing linting issues..."
	npm run lint:fix
	npm run lint:frontend:fix

format: lint-fix
	@echo "✨ Code formatting completed!"

logs:
	@echo "📋 Showing application logs..."
	@if [ -f "app.log" ]; then tail -f app.log; else echo "No log file found. Start the application first."; fi

# Production
start:
	@echo "🚀 Starting production server..."
	npm start

# Quick setup for new developers
setup: install
	@echo "⚙️  Setting up development environment..."
	@if [ ! -f ".env" ]; then \
		echo "📝 Creating .env file from template..."; \
		cp .env.example .env; \
		echo "⚠️  Please edit .env file with your GitHub OAuth credentials"; \
	fi
	@echo "✅ Setup completed!"
	@echo ""
	@echo "Next steps:"
	@echo "1. Edit .env file with your GitHub OAuth credentials"
	@echo "2. Run 'make dev' to start development servers"

# Health check
health:
	@echo "🏥 Checking application health..."
	@curl -s http://localhost:3000/health | jq . || echo "Backend not running"
	@curl -s http://localhost:3001 > /dev/null && echo "✅ Frontend is running" || echo "❌ Frontend not running"

# Database/Cache management
cache-clear:
	@echo "🗑️  Clearing Redis cache..."
	@if command -v redis-cli > /dev/null; then \
		redis-cli FLUSHALL; \
		echo "✅ Redis cache cleared"; \
	else \
		echo "❌ redis-cli not found. Install Redis CLI or use Docker."; \
	fi

# Git helpers
commit-check:
	@echo "🔍 Running pre-commit checks..."
	@make lint
	@make test
	@echo "✅ All checks passed!"

# Development helpers
dev-reset: clean install
	@echo "🔄 Resetting development environment..."
	@make setup

# Show current status
status:
	@echo "📊 Current Status:"
	@echo "Node.js: $(shell node --version)"
	@echo "npm: $(shell npm --version)"
	@echo "Git branch: $(shell git branch --show-current 2>/dev/null || echo 'Not a git repository')"
	@echo "Git status: $(shell git status --porcelain 2>/dev/null | wc -l | tr -d ' ') files changed"
	@echo ""
	@make health