# re:current analytics

## Overview
A Quarto-based static website for climate risk, models, and analytics. The site serves as a lab notebook with notes, projects, models, and reading materials.

## Project Structure
- `_site/` - Pre-built static HTML output (served in production)
- `*.qmd` - Quarto markdown source files
- `notes/`, `models/`, `projects/`, `reading/` - Content sections
- `_quarto.yml` - Quarto configuration
- `environment.yml` - Conda environment for local development (Python dependencies for notebooks)
- `server.py` - Simple Python HTTP server for serving static files

## Running the Site
The workflow "Serve Website" runs `python server.py` which serves the `_site` directory on port 5000.

## Development Notes
- The site uses Quarto for static site generation
- Pre-built content is in `_site/` - no build step required for deployment
- To rebuild content locally, you would need Quarto installed and run `quarto render`

## Deployment
Configured for static deployment serving the `_site` directory.
