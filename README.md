# re:current_analytics

A Quarto-based static website for climate risk, models, and analytics. This site serves as a public lab notebook with notes, projects, models, and reading materials.

## 🌐 Live Site

**https://recurrentanalytics.com**

## 📚 Project Overview

This repository contains the source code for a Quarto website that combines:
- **Notes** - Lab journal entries and knowledge base articles
- **Projects** - Models, tools, demos, and packaged work  
- **Reading** - Reading notes and literature reviews
- **Interactive Features** - Graph navigation, command palette, keyboard shortcuts

## 🏗️ Repository Structure

```
quarto_website/
├── dev/              # Development branch (active work)
├── gh-pages/         # Deployment branch (built site)
└── main/             # Documentation branch (this branch)
```

### Branch Strategy

- **`main`** (this branch): Documentation and project information
- **`dev`**: Active development - contains all source files (`.qmd`, config, Python modules)
- **`gh-pages`**: Built static site - deployed to GitHub Pages

## 🚀 Quick Start

### For Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/recurrentanalytics/quarto_website.git
   cd quarto_website
   ```

2. **Switch to dev branch**:
   ```bash
   git checkout dev
   ```

3. **Set up environment**:
   ```bash
   conda env create -f environment.yml
   conda activate recurrent-analytics
   ```

4. **Build and preview**:
   ```bash
   quarto render
   quarto preview
   ```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## 📖 Documentation

- **[README.md](README.md)** - This file (project overview)
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment guide for GitHub Pages
- **Source code**: See `dev` branch for all source files

## 🛠️ Technology Stack

- **Quarto**: Static site generator
- **Python**: Data processing and analysis (via conda environment)
- **GitHub Pages**: Hosting
- **Custom Domain**: recurrentanalytics.com

## 📝 Development Workflow

1. Work on `dev` branch
2. Test locally with `quarto render` and `quarto preview`
3. Deploy to `gh-pages` branch (see DEPLOYMENT.md)
4. Site goes live at https://recurrentanalytics.com

## 🔗 Links

- **Live Site**: https://recurrentanalytics.com
- **GitHub**: https://github.com/recurrentanalytics/quarto_website
- **Email**: timm.walker@recurrentanalytics.com

## 📄 License

[Add your license here]

---

**Note**: This is the documentation branch. For source code, see the `dev` branch.
