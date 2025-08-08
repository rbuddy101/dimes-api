# Dimes API

TypeScript Express API server for the Dimes application.

## Features

- Coin toss game API endpoints
- TypeScript for type safety
- Express.js framework
- MySQL database with Drizzle ORM
- Rate limiting and security middleware
- CORS support for frontend integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
- Copy `.env` file and update as needed
- Default port is 3005

3. Run in development mode:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## API Endpoints

### Coin Toss Game

- `GET /api/cointoss/settings` - Get game settings
- `PUT /api/cointoss/settings` - Update game settings (admin only)
- `GET /api/cointoss/competition` - Get current competition
- `POST /api/cointoss/competition` - Create new competition (admin only)
- `GET /api/cointoss/session` - Get user session (authenticated)
- `POST /api/cointoss/flip` - Record a coin flip (authenticated)
- `GET /api/cointoss/leaderboard` - Get leaderboard

### Health Check

- `GET /health` - Server health check

## Authentication

For MVP, authentication is simplified:
- Pass `x-user-id` header or `userId` query param
- In production, integrate with NextAuth session tokens

## Testing

Test the API endpoints:

```bash
# Health check
curl http://localhost:3005/health

# Get settings
curl http://localhost:3005/api/cointoss/settings

# Get competition
curl http://localhost:3005/api/cointoss/competition

# Get leaderboard
curl http://localhost:3005/api/cointoss/leaderboard

# Get session (requires auth)
curl http://localhost:3005/api/cointoss/session \
  -H "x-user-id: 1"

# Record a flip (requires auth)
curl -X POST http://localhost:3005/api/cointoss/flip \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json"
```

## Development

- `npm run dev` - Run with hot reload
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Type check without building

## Environment Variables

- `PORT` - Server port (default: 3005)
- `NODE_ENV` - Environment (development/production)
- `DATABASE_URL` - MySQL connection string
- `CORS_ORIGIN` - Allowed CORS origins
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in ms
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window