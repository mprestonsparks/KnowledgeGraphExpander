#!/bin/bash
# Script to stop the Knowledge Graph Expander application

# Exit immediately if a command exits with a non-zero status
set -e

# Display colorful welcome message
echo -e "\033[1;34m======================================\033[0m"
echo -e "\033[1;31mStopping Knowledge Graph Expander\033[0m"
echo -e "\033[1;34m======================================\033[0m"

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "\033[1;31mError: Docker is required but not found.\033[0m"
    exit 1
fi

# Determine which docker compose command to use
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo -e "\033[1;31mError: Neither docker-compose nor docker compose is available.\033[0m"
    exit 1
fi

# Parse command line arguments
REMOVE_VOLUMES=false
FORCE=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --clean) REMOVE_VOLUMES=true ;;
        --force) FORCE=true ;;
        --help) 
            echo "Usage: ./stop.sh [options]"
            echo ""
            echo "Options:"
            echo "  --clean    Remove all data (including database volume)"
            echo "  --force    Force removal of containers even if they're running"
            echo "  --help     Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Try to stop the application using any available docker-compose file
stop_app() {
    local file=$1
    local clean=$2
    local force=$3
    
    if [ -f "$file" ]; then
        echo -e "\033[1;34mUsing config file: $file\033[0m"
        
        if [ "$clean" = true ]; then
            if [ "$force" = true ]; then
                echo -e "\033[1;31mForce removing all data (including database volume)\033[0m"
                $DOCKER_COMPOSE -f "$file" down -v --remove-orphans
            else
                echo -e "\033[1;31mRemoving all data (including database volume)\033[0m"
                $DOCKER_COMPOSE -f "$file" down -v
            fi
        else
            if [ "$force" = true ]; then
                echo -e "\033[1;34mForce stopping containers...\033[0m"
                $DOCKER_COMPOSE -f "$file" down --remove-orphans
            else
                $DOCKER_COMPOSE -f "$file" down
            fi
        fi
        return 0
    fi
    return 1
}

# List of possible docker-compose files to try
FILES=("docker-compose-custom.yml" "docker-compose.yml")
SUCCESS=false

for file in "${FILES[@]}"; do
    if stop_app "$file" "$REMOVE_VOLUMES" "$FORCE"; then
        SUCCESS=true
        break
    fi
done

if [ "$SUCCESS" = false ]; then
    echo -e "\033[1;33mNo docker-compose file found or no containers were running.\033[0m"
    # Try to stop the containers directly
    echo -e "\033[1;34mTrying to stop containers by name...\033[0m"
    docker stop knowledge-graph-api knowledge-graph-db 2>/dev/null || true
    docker rm knowledge-graph-api knowledge-graph-db 2>/dev/null || true
    
    if [ "$REMOVE_VOLUMES" = true ]; then
        echo -e "\033[1;31mRemoving all data volumes...\033[0m"
        docker volume rm -f knowledgegraphexpander_postgres_data 2>/dev/null || true
    fi
fi

# Optional: Clean up dangling images and volumes to save space
if [ "$FORCE" = true ]; then
    echo -e "\033[1;34mCleaning up dangling containers and volumes...\033[0m"
    docker container prune -f > /dev/null 2>&1 || true
    if [ "$REMOVE_VOLUMES" = true ]; then
        docker volume prune -f > /dev/null 2>&1 || true
    fi
    echo -e "\033[1;32mCleanup complete.\033[0m"
fi

# Cleanup any temporary files
if [ -f docker-compose-custom.yml ]; then
    rm -f docker-compose-custom.yml
fi

echo -e "\033[1;32mApplication stopped.\033[0m"
if [ "$REMOVE_VOLUMES" = false ]; then
    echo -e "\033[1;34mData has been preserved. To remove all data, run: ./stop.sh --clean\033[0m"
fi