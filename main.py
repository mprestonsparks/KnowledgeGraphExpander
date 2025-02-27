import uvicorn
import os
from server.app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app,
                host="0.0.0.0",
                port=port,
                log_level="info",
                access_log=True)