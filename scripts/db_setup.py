
import asyncio
from server.database import init_db, cleanup_pool

async def setup_db():
    await init_db()
    print('Database initialized.')

if __name__ == "__main__":
    asyncio.run(setup_db())
