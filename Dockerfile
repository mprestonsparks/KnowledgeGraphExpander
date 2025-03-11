# Base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH="/app:${PYTHONPATH}"

# Install Node.js from NodeSource repository and other dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    gnupg \
    ca-certificates \
    postgresql-client \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy frontend package files
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install

# Return to app directory
WORKDIR /app

# Copy application code
COPY . .

# Ensure knowledge explorer is present and has correct permissions
RUN ls -la knowledge_explorer.html || echo "WARNING: knowledge_explorer.html file not found!"
RUN chmod 644 knowledge_explorer.html 2>/dev/null || echo "Could not set permissions on knowledge_explorer.html"

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Return to app directory
WORKDIR /app

# Expose port
EXPOSE 8000

# Set the entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]

# Default command
CMD ["api"]