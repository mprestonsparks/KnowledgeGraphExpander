# Setup Guide

## Prerequisites
- Node.js 20 or later
- PostgreSQL database
- OpenAI API key for semantic analysis

## Environment Variables
```env
DATABASE_URL=postgresql://user:password@host:port/dbname
OPENAI_API_KEY=your_api_key
```

## Installation

1. **Clone the Repository**
```bash
git clone <repository-url>
cd knowledge-graph-system
```

2. **Install Dependencies**
```bash
npm install
```

3. **Database Setup**
The system uses Drizzle ORM for database management:
```bash
npm run db:push
```

4. **Development Server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Configuration

### Database Configuration
Database schema is defined in `shared/schema.ts`:
```typescript
// Node and Edge tables
export const nodes = pgTable("nodes", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type").notNull(),
  metadata: jsonb("metadata")
});

export const edges = pgTable("edges", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  targetId: integer("target_id").notNull(),
  label: text("label").notNull(),
  weight: integer("weight").notNull()
});
```

### Graph Manager Configuration
Configured in `server/graph_manager.ts`:
- Node expansion settings
- Clustering parameters
- Performance tuning

## Deployment
The application is designed to be deployed on Replit:
1. Create a new Repl
2. Import the repository
3. Set up environment variables
4. Deploy using Replit's deployment feature

## Troubleshooting

### Common Issues
1. **Database Connection**
   - Verify DATABASE_URL format
   - Check database permissions
   - Ensure PostgreSQL is running

2. **Graph Visualization**
   - Clear browser cache
   - Check console for errors
   - Verify WebSocket connection

3. **API Issues**
   - Validate API key
   - Check rate limits
   - Review server logs

## Monitoring
- Built-in logging system
- Performance metrics
- Error tracking
