
import asyncio
from server.graph_manager import graph_manager

async def run_service():
    await graph_manager.initialize()
    print('Graph manager initialized')
    while True:
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(run_service())
