#!/bin/bash
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "\n${BOLD}Have you reviewed the test results and strategy analysis? (y/n)${NC}"
read -r RESPONSE

if [[ "$RESPONSE" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Push approved. Proceeding...${NC}"
    exit 0
else
    echo -e "${RED}Push aborted. Please review the test report and fix any issues before pushing.${NC}"
    exit 1
fi
