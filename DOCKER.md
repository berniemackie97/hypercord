# 🐳 Docker Deployment Guide

Enterprise-grade Docker setup for Hypercord Discord Bot.

## Quick Start

### Development

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env and add your Discord bot token
# BOT_TOKEN=your_token_here
# APPLICATION_ID=your_app_id_here

# 3. Start all services (PostgreSQL + Redis + Bot + Tools)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# 4. Run database migrations
docker-compose exec bot pnpm prisma migrate dev

# 5. Access admin tools:
# - pgAdmin: http://localhost:5050 (admin@hypercord.local / admin)
# - Redis Commander: http://localhost:8081
```

### Production

```bash
# 1. Set production environment variables in .env
# NODE_ENV=production
# LOG_LEVEL=info
# Update DATABASE_URL and REDIS_URL with production credentials

# 2. Build and start
docker-compose up -d

# 3. Check logs
docker-compose logs -f bot

# 4. Check health
docker-compose ps
```

## Architecture

### Services

| Service | Port | Description |
|---------|------|-------------|
| **bot** | - | Discord bot application |
| **postgres** | 5432 | PostgreSQL 16 database |
| **redis** | 6379 | Redis cache & queue |
| **pgadmin** | 5050 | Database management (dev only) |
| **redis-commander** | 8081 | Redis management (dev only) |

### Multi-Stage Dockerfile

**Stage 1: Dependencies**
- Installs all dependencies using pnpm
- Cached for faster rebuilds

**Stage 2: Builder**
- Generates Prisma Client
- Builds TypeScript to JavaScript
- Runs tsup bundler

**Stage 3: Production**
- Minimal Alpine Linux image
- Non-root user (nodejs:1001)
- Only production dependencies
- Healthcheck included
- Dumb-init for signal handling

### Volume Mounts

- `postgres_data`: PostgreSQL data persistence
- `redis_data`: Redis AOF persistence
- `pgadmin_data`: pgAdmin settings

## Commands

### Database

```bash
# Generate Prisma Client
docker-compose exec bot pnpm prisma generate

# Create migration
docker-compose exec bot pnpm prisma migrate dev --name migration_name

# Apply migrations (production)
docker-compose exec bot pnpm prisma migrate deploy

# Reset database (WARNING: Deletes all data)
docker-compose exec bot pnpm prisma migrate reset

# Open Prisma Studio
docker-compose exec bot pnpm prisma studio
```

### Bot Management

```bash
# View logs
docker-compose logs -f bot

# Restart bot
docker-compose restart bot

# Rebuild bot
docker-compose up -d --build bot

# Execute command in bot container
docker-compose exec bot sh

# Check bot health
docker-compose exec bot node -e "console.log('healthy')"
```

### Cleanup

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: Deletes all data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | ✅ | - | Discord bot token |
| `APPLICATION_ID` | ✅ | - | Discord application ID |
| `DATABASE_URL` | ✅ | - | PostgreSQL connection string |
| `REDIS_URL` | ✅ | - | Redis connection string |
| `NODE_ENV` | ❌ | `development` | Environment mode |
| `LOG_LEVEL` | ❌ | `info` | Logging level |
| `ADMIN_USER_IDS` | ❌ | - | Comma-separated admin user IDs |
| `ADMIN_ROLE_IDS` | ❌ | - | Comma-separated admin role IDs |

## Production Checklist

- [ ] Change default PostgreSQL password
- [ ] Change default Redis password
- [ ] Set `NODE_ENV=production`
- [ ] Set `LOG_LEVEL=info` or `warn`
- [ ] Use strong credentials
- [ ] Configure backup strategy
- [ ] Set up monitoring/alerts
- [ ] Review resource limits
- [ ] Test health checks
- [ ] Configure log rotation
- [ ] Set up reverse proxy (if using HTTP health endpoint)
- [ ] Review security groups/firewall rules

## Troubleshooting

### Bot won't start

```bash
# Check logs
docker-compose logs bot

# Check database connection
docker-compose exec bot pnpm prisma db pull

# Verify environment variables
docker-compose exec bot env | grep -E 'BOT_TOKEN|DATABASE_URL|REDIS_URL'
```

### Database connection failed

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection manually
docker-compose exec postgres psql -U hypercord -d hypercord -c "SELECT 1"
```

### Redis connection failed

```bash
# Check Redis is running
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Test connection
docker-compose exec redis redis-cli -a dev_redis_password ping
```

## Performance Tuning

### PostgreSQL

Connection pooling is configured in `DATABASE_URL`:
- `connection_limit=5` (dev) / `10` (prod)
- `pool_timeout=20` (dev) / `30` (prod)

### Redis

- AOF persistence enabled for data durability
- Password protected
- Can add `maxmemory` policies if needed

### Bot

- Multi-stage build reduces image size
- Non-root user for security
- Dumb-init for proper signal handling
- Health checks for orchestration

## Next Steps

1. **Monitoring**: Add Prometheus + Grafana
2. **Logging**: Ship logs to ELK/Loki
3. **Backups**: Automate database backups
4. **Scaling**: Use Docker Swarm or Kubernetes
5. **CI/CD**: Automate builds and deployments
