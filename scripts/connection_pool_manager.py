
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

if __name__ == "__main__":
    asyncio.run(manage_pool())
