# Concurrent Graph Analysis Workflow Configuration

## Task 1: Database Setup (Sequential)
Command: Execute Shell Command
```bash
python3 -c "
import asyncio
from server.database import init_db, cleanup_pool

async def setup_db():
    await init_db()
    print('Database initialized.')

asyncio.run(setup_db())
"
```

## Task 2: API Service (Parallel)
Command: Execute Shell Command
```bash
uvicorn server.app:app --host 0.0.0.0 --port 8080 --reload
```

## Task 3: Graph Manager Service (Parallel)
Command: Execute Shell Command
```bash
python3 -c "
import asyncio
from server.graph_manager import graph_manager

async def run_service():
    await graph_manager.initialize()
    print('Graph manager initialized')
    while True:
        await asyncio.sleep(1)

asyncio.run(run_service())
"
```

## Task 4: Connection Pool Manager (Parallel)
Command: Execute Shell Command
```bash
python3 -c "
import asyncio
from server.database import get_pool, cleanup_pool

async def manage_pool():
    pool = await get_pool()
    print('Connection pool manager initialized')
    try:
        while True:
            await asyncio.sleep(5)
            print(f'Active connections: {len(pool._holders)}')
    finally:
        await cleanup_pool()

asyncio.run(manage_pool())
"
```

## Configuration:
1. Task 1 runs first sequentially
2. Tasks 2-4 run in parallel after Task 1 completes
3. All tasks use proper event loop handling
4. Long-running tasks are configured with appropriate timeouts

## Success Verification:
1. Database initialization message appears
2. Uvicorn server starts on port 8080
3. Graph manager shows "initialized" message
4. Pool manager reports active connections

## Workflow Configuration Steps
1. Create New Workflow
   - Name: "Concurrent Graph Analysis"
   - Description: "Manages concurrent graph operations with proper async resource handling"

2. Add Tasks:
   a. Database Initialization (Sequential)
   - Task Type: Execute Shell Command
   - Command: [Database Init Script] (See Task 1 above)
   - Must complete before other tasks start

   b. Graph Manager Service (Parallel)
   - Task Type: Execute Shell Command
   - Command: [Graph Manager Script] (See Task 3 above)
   - Runs after database initialization

   c. API Service (Parallel)
   - Task Type: Execute Shell Command
   - Command: [API Service Command] (See Task 2 above)
   - Runs after database initialization

   d. Connection Pool Manager (Parallel)
   - Task Type: Execute Shell Command
   - Command: [Pool Manager Script] (See Task 4 above)
   - Runs after database initialization

3. Resource Management:
   - Each service gets its own event loop
   - Connection pools are managed separately
   - Memory limits per service: 512MB
   - CPU limits per service: 1 core

4. Error Handling:
   - Database errors trigger workflow restart
   - Service failures don't stop other services
   - Resource cleanup on task completion

## Usage Instructions

1. Open Workflows Panel:
   ```
   Press Command + K
   Search for "Workflows"
   Click "+" to create new workflow
   ```

2. Configure Sequential Task:
   - Add Database Init task
   - Set as prerequisite for parallel tasks
   - Verify successful completion before proceeding

3. Configure Parallel Tasks:
   - Add service tasks
   - Enable parallel execution
   - Set database init as prerequisite

4. Monitoring:
   - Watch service logs for errors
   - Monitor connection pool status
   - Check resource usage

## Success Criteria

1. Database State:
   - Schema initialized
   - Connections active
   - Pool managed properly

2. Service Health:
   - All services running
   - No event loop conflicts
   - Resource usage within limits

3. Error Recovery:
   - Failed services restart
   - Resources cleaned up
   - State maintained

## Troubleshooting

1. Database Connection Issues:
   - Check pool manager logs
   - Verify connection strings
   - Monitor active connections

2. Event Loop Conflicts:
   - Review service logs
   - Check loop isolation
   - Verify async context

3. Resource Leaks:
   - Monitor memory usage
   - Check connection counts
   - Verify cleanup execution

## Benefits

- Isolated event loops prevent conflicts
- Controlled resource management
- Automatic error recovery
- Proper async context handling

## Additional Notes

1. Test Execution:
   - Run tests only after services are stable
   - Monitor event loop usage during tests
   - Check for connection pool leaks

2. Common Issues:
   - Connection pool exhaustion
   - Event loop cross-contamination
   - Memory leaks in long-running services

3. Performance Optimization:
   - Adjust pool sizes based on load
   - Monitor service response times
   - Track resource utilization