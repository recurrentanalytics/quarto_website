#!/bin/bash
# Local development script for Quarto website
# Usage: ./dev.sh [preview|build|check]

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if conda environment is activated
if [[ -z "$CONDA_DEFAULT_ENV" ]] || [[ "$CONDA_DEFAULT_ENV" != "recurrent-analytics" ]]; then
    echo -e "${YELLOW}Warning: Conda environment 'recurrent-analytics' not activated${NC}"
    echo "Activating conda environment..."
    eval "$(conda shell.bash hook)"
    conda activate recurrent-analytics || {
        echo -e "${RED}Error: Could not activate conda environment${NC}"
        echo "Please run: conda activate recurrent-analytics"
        exit 1
    }
fi

# Check if Quarto is installed
if ! command -v quarto &> /dev/null; then
    echo -e "${RED}Error: Quarto is not installed${NC}"
    echo "Please install Quarto from https://quarto.org/docs/get-started/"
    exit 1
fi

ACTION=${1:-preview}

case $ACTION in
    build)
        echo -e "${GREEN}Building Quarto site...${NC}"
        quarto render
        echo -e "${GREEN}✓ Build complete! Output in _site/${NC}"
        echo ""
        echo "To preview locally, run:"
        echo "  ./dev.sh preview"
        echo "  or"
        echo "  python server.py"
        ;;
    preview)
        echo -e "${GREEN}Starting Quarto preview server...${NC}"
        echo "Site will be available at http://localhost:4200"
        echo "Press Ctrl+C to stop"
        quarto preview
        ;;
    check)
        echo -e "${GREEN}Checking Quarto installation...${NC}"
        quarto check
        ;;
    *)
        echo "Usage: ./dev.sh [preview|build|check]"
        echo ""
        echo "Commands:"
        echo "  preview  - Start local preview server (default)"
        echo "  build    - Build the site to _site/"
        echo "  check    - Check Quarto installation"
        exit 1
        ;;
esac

