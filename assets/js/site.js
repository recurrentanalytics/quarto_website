// Site features (moved out of _quarto.yml): title handling, breadcrumbs, reading
// progress, focus mode, keyboard shortcuts, command palette, reading time and the
// network graph of pages (data: /assets/graph.json, built by scripts/build_graph.py).
document.addEventListener('DOMContentLoaded', function() {
  // Hide page title and reading time on index page
  const path = window.location.pathname;
  const isHomePage = path === '/' || path === '/index.html' || path.endsWith('/index.html');

  if (isHomePage) {
    document.body.classList.add('index-page');
    // Hide page title block
    const titleBlock = document.querySelector('.quarto-title-block');
    if (titleBlock) {
      titleBlock.style.display = 'none';
    }
    // Remove any reading time that might have been added
    const readingTime = document.querySelector('.reading-time');
    if (readingTime) {
      readingTime.remove();
    }
  }

  // Hide title block on section index pages (projects, notes, reading, tipping-points)
  // These pages have empty titles in YAML and use headings in content instead
  const isSectionIndex = path.match(/\/(tipping-points)\/?$/);  // the only section page whose title is its first heading
  if (isSectionIndex) {
    const titleBlock = document.querySelector('.quarto-title-block');
    if (titleBlock) {
      titleBlock.style.display = 'none';
    }
    // Also remove reading time on section pages
    const readingTime = document.querySelector('.reading-time');
    if (readingTime) {
      readingTime.remove();
    }
  }

  // Breadcrumb navigation
  function createBreadcrumbs() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return;

    const pathParts = path.split('/').filter(p => p && p !== 'index.html');
    const breadcrumbContainer = document.createElement('nav');
    breadcrumbContainer.className = 'breadcrumb-nav';
    breadcrumbContainer.setAttribute('aria-label', 'Breadcrumb');

    let breadcrumbHTML = '<ol class="breadcrumb-list">';
    breadcrumbHTML += '<li class="breadcrumb-item"><a href="/">Home</a></li>';

    let currentPath = '';
    pathParts.forEach((part, index) => {
      const isLast = index === pathParts.length - 1;

      // Special handling for "models" - link to projects page instead
      if (part === 'models' && !isLast) {
        breadcrumbHTML += '<li class="breadcrumb-item"><a href="/projects/">Projects</a></li>';
        return; // Skip adding to currentPath
      }

      // Skip "models" in breadcrumb if it's not the last part
      if (part === 'models') {
        return;
      }

      currentPath += '/' + part;
      const label = part.replace(/\.html$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      if (isLast) {
        // The page's own title, short form (before a colon), else the file name.
        const h1 = document.querySelector('h1.title, .quarto-title h1');
        const own = h1 ? h1.textContent.split(':')[0].trim() : '';
        const text = (own || label).replace(/[<>&]/g, '');
        breadcrumbHTML += `<li class="breadcrumb-item active" aria-current="page">${text}</li>`;
      } else {
        breadcrumbHTML += `<li class="breadcrumb-item"><a href="${currentPath}/">${label}</a></li>`;
      }
    });

    breadcrumbHTML += '</ol>';
    breadcrumbContainer.innerHTML = breadcrumbHTML;

    const contentArea = document.querySelector('#quarto-document-content, .content, main, article');
    if (contentArea) {
      contentArea.insertBefore(breadcrumbContainer, contentArea.firstChild);
    }
  }

  createBreadcrumbs();

  // Reading progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'reading-progress';
  document.body.appendChild(progressBar);

  window.addEventListener('scroll', function() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = progress + '%';
  });

  // Focus mode for distraction-free reading
  let focusMode = false;
  function toggleFocusMode() {
    focusMode = !focusMode;
    document.body.classList.toggle('focus-mode', focusMode);

    // Hide/show elements
    const elementsToHide = document.querySelectorAll('.navbar, .nav-footer, .sidebar, #TOC, #quarto-margin-sidebar, .quarto-back-to-top-link, .mobile-graph-btn, .sidebar-graph');
    elementsToHide.forEach(el => {
      if (el) el.style.display = focusMode ? 'none' : '';
    });

    // Update hint
    const hint = document.querySelector('.keyboard-hint');
    if (hint) {
      hint.innerHTML = focusMode 
        ? 'Press f to exit focus mode · Escape to close'
        : '⌘K palette · / search · j/k navigate · f focus · ? hints';
    }
  }

  // Keyboard shortcuts
  const noteLinks = Array.from(document.querySelectorAll('.quarto-listing-default a, .sidebar-item a'));
  let currentIndex = -1;

  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // f to toggle focus mode
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleFocusMode();
      return;
    }

    // / to focus search
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const searchInput = document.querySelector('#quarto-search input, .aa-Input');
      if (searchInput) searchInput.focus();
    }

    // j/k to navigate notes (on listing pages)
    if (noteLinks.length > 0) {
      if (e.key === 'j') {
        currentIndex = Math.min(currentIndex + 1, noteLinks.length - 1);
        noteLinks[currentIndex]?.focus();
      }
      if (e.key === 'k') {
        currentIndex = Math.max(currentIndex - 1, 0);
        noteLinks[currentIndex]?.focus();
      }
    }

    // ? to show keyboard hints
    if (e.key === '?') {
      const hint = document.querySelector('.keyboard-hint');
      if (hint) hint.classList.toggle('visible');
    }
  });

  // Add keyboard hint element
  const hint = document.createElement('div');
  hint.className = 'keyboard-hint';
  hint.innerHTML = '⌘K palette · / search · j/k navigate · f focus · ? hints';
  document.body.appendChild(hint);

  // Command Palette (Cmd+K / Ctrl+K)
  const pages = [
    { title: 'Home', path: '/' },
    { title: 'About & Contact', path: '/about.html' },
    { title: 'under:current', path: '/notes/' },
    { title: 'Projects', path: '/projects/' },
    { title: 'Library', path: '/library/' },
    { title: 'Heatwaves and Day-Ahead Prices', path: '/models/heatwave-prices-de-lu.html' }
  ];

  const overlay = document.createElement('div');
  overlay.className = 'cmd-palette-overlay';
  overlay.innerHTML = `
    <div class="cmd-palette">
      <input type="text" class="cmd-palette-input" placeholder="Jump to page...">
      <div class="cmd-palette-results"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('.cmd-palette-input');
  const results = overlay.querySelector('.cmd-palette-results');
  let selectedIndex = 0;

  // Simple fuzzy search function
  function fuzzyMatch(pattern, text) {
    pattern = pattern.toLowerCase();
    text = text.toLowerCase();

    // Exact match gets highest score
    if (text.includes(pattern)) return 100;

    // Check if all pattern characters appear in order
    let patternIdx = 0;
    let score = 0;
    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        patternIdx++;
        score += 10;
      }
    }

    if (patternIdx === pattern.length) {
      return score;
    }

    // Check individual word matches
    const words = text.split(/\s+/);
    let wordMatches = 0;
    pattern.split(/\s+/).forEach(pWord => {
      if (words.some(w => w.startsWith(pWord) || w.includes(pWord))) {
        wordMatches++;
      }
    });

    return wordMatches * 5;
  }

  function renderResults(filter = '') {
    if (!filter.trim()) {
      const filtered = pages.slice(0, 10);
    results.innerHTML = filtered.map((p, i) => `
      <a href="${p.path}" class="cmd-palette-item ${i === selectedIndex ? 'selected' : ''}">
        <div class="cmd-palette-item-title">${p.title}</div>
        <div class="cmd-palette-item-path">${p.path}</div>
      </a>
    `).join('');
    return filtered;
    }

    // Score and sort by relevance
    const scored = pages.map(p => ({
      page: p,
      score: Math.max(
        fuzzyMatch(filter, p.title),
        fuzzyMatch(filter, p.path)
      )
    })).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    results.innerHTML = scored.map((item, i) => `
      <a href="${item.page.path}" class="cmd-palette-item ${i === selectedIndex ? 'selected' : ''}">
        <div class="cmd-palette-item-title">${item.page.title}</div>
        <div class="cmd-palette-item-path">${item.page.path}</div>
      </a>
    `).join('');
    return scored.map(item => item.page);
  }

  function openPalette() {
    overlay.classList.add('active');
    input.value = '';
    selectedIndex = 0;
    renderResults();
    setTimeout(() => input.focus(), 50);
  }

  function closePalette() {
    overlay.classList.remove('active');
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePalette();
  });

  input.addEventListener('input', () => {
    selectedIndex = 0;
    renderResults(input.value);
  });

  input.addEventListener('keydown', (e) => {
    const items = results.querySelectorAll('.cmd-palette-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      renderResults(input.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderResults(input.value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) items[selectedIndex].click();
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (overlay.classList.contains('active')) {
        closePalette();
      } else {
        openPalette();
      }
    }
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closePalette();
    }
  });

  // Reading time: on notes, models and design notes only (not on section or project pages).
  const isArticle = /\/(notes|models|tipping-points\/design-notes)\/[^/]+\.html$/.test(path);
  const contentArea = document.querySelector('#quarto-document-content, main');
  const titleMeta = document.querySelector('.quarto-title-meta, .quarto-title');
  if (isArticle && contentArea && titleMeta) {
    const words = (contentArea.innerText || '').trim().split(/\s+/).length;
    const timeSpan = document.createElement('span');
    timeSpan.className = 'reading-time';
    timeSpan.textContent = Math.max(1, Math.ceil(words / 200)) + ' min read';
    titleMeta.appendChild(timeSpan);
  }

  // Network Graph visualization
  // Pages and their links, written at render time by scripts/build_graph.py.
  const graphData = window.RAC_GRAPH || { nodes: [], links: [] };

  // Category colors for graph nodes
  const catColors = {
    nav: '#93a1b1',
    notes: '#6eb6ff',
    projects: '#4fbf8f',
    'tipping-points': '#b49cf0',
    livelines: '#f5b02e'
  };

  // Create sidebar mini-graph widget - always add to body to ensure it's on all pages
  const sidebarGraph = document.createElement('div');
  sidebarGraph.className = 'sidebar-graph';
  sidebarGraph.title = 'Click to expand';
  sidebarGraph.innerHTML = `
    <div class="sidebar-graph-header">
      <span class="sidebar-graph-title">Connections</span>
      <span class="sidebar-graph-expand">expand</span>
    </div>
    <div class="sidebar-graph-container" id="mini-graph-container"></div>
  `;

  // Where the Connections pane goes: a page's own slot (the home page shows it large),
  // else the margin column, else a small fixed card in the corner.
  const slot = document.querySelector('.rac-graph-slot');
  const sidebar = slot || document.querySelector('#quarto-margin-sidebar, .sidebar, #TOC');
  if (sidebar) {
    sidebar.appendChild(sidebarGraph);
  } else {
    // No margin column: the round network button opens the same graph (styles.scss).
    document.body.classList.add('rac-no-pane');
    document.body.appendChild(sidebarGraph);
  }

  // Force visibility
  sidebarGraph.style.display = 'block';
  sidebarGraph.style.visibility = 'visible';
  sidebarGraph.style.opacity = '1';

  // Ensure sidebarGraph is clickable - attach handler after it's in DOM
  setTimeout(function() {
    const graphEl = document.querySelector('.sidebar-graph');
    if (graphEl && !graphEl.hasAttribute('data-click-handler-attached')) {
      graphEl.setAttribute('data-click-handler-attached', 'true');
      graphEl.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openGraphNavigation === 'function') {
          window.openGraphNavigation();
        }
      });
    }
  }, 100);

  // Create modal FIRST - before any D3 checks
  const graphModal = document.createElement('div');
  graphModal.className = 'graph-modal-overlay';
  graphModal.innerHTML = `
    <div class="graph-modal">
      <div class="graph-modal-header">
        <span class="graph-modal-title">Map of this site</span>
        <button class="graph-modal-close">&times;</button>
      </div>
      <div class="graph-modal-controls">
        <input type="text" class="graph-search-input" placeholder="Search nodes..." id="graph-search">
        <div class="graph-category-filters">
          <button class="graph-filter-btn active" data-cat="all">All</button>
          <button class="graph-filter-btn" data-cat="nav">Nav</button>
          <button class="graph-filter-btn" data-cat="notes">under:current</button>
          <button class="graph-filter-btn" data-cat="projects">Projects</button>
          <button class="graph-filter-btn" data-cat="livelines">LiveLines</button>
        </div>
        <div class="graph-zoom-controls">
          <button class="graph-zoom-btn" id="zoom-in" title="Zoom in">+</button>
          <button class="graph-zoom-btn" id="zoom-out" title="Zoom out">−</button>
          <button class="graph-zoom-btn" id="zoom-reset" title="Reset zoom">⌂</button>
        </div>
      </div>
      <div class="graph-container" id="graph-container"></div>
    </div>
  `;
  document.body.appendChild(graphModal);

  function getCurrentPageId() {
    // Exact match on the path, with /x/index.html read as /x/.
    const path = window.location.pathname.replace(/index\.html$/, '');
    const node = graphData.nodes.find(n => n.path === path);
    return node ? node.id : null;
  }

  // Make getCurrentPageId and graphData available globally
  window.getCurrentPageId = getCurrentPageId;
  window.graphData = graphData;

  function openGraph() {

    // Ensure graph modal exists
    if (!graphModal) {
      console.error('Graph modal not found!');
      return;
    }

    if (!document.body.contains(graphModal)) {
      console.warn('Graph modal not in DOM, appending...');
      document.body.appendChild(graphModal);
    }

    // Ensure modal is visible
    graphModal.style.display = 'flex';
    graphModal.style.visibility = 'visible';
    graphModal.classList.add('active');

    // Initialize graph if not already done
    if (typeof initGraph === 'function') {
    initGraph();
    } else {
      console.error('initGraph function not found');
    }

    // Focus trap - prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  function closeGraph() {
    if (graphModal) {
    graphModal.classList.remove('active');
      // Restore body scroll
      document.body.style.overflow = '';
    }
  }

  // Make openGraph globally available so it can be called from anywhere
  window.openGraphNavigation = openGraph;

  // Ensure event listeners are attached after elements are created
  // Use event delegation to handle clicks on sidebar graph
  if (sidebarGraph && sidebarGraph.parentNode) {
    sidebarGraph.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof openGraph === 'function') {
      openGraph();
      } else if (typeof window.openGraphNavigation === 'function') {
        window.openGraphNavigation();
    }
  });
  } else {
    // If sidebarGraph isn't in DOM yet, wait and retry
    setTimeout(function() {
      const graph = document.querySelector('.sidebar-graph');
      if (graph) {
        graph.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window.openGraphNavigation === 'function') {
            window.openGraphNavigation();
          }
        });
      }
    }, 500);
  }

  const closeBtn = graphModal.querySelector('.graph-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closeGraph();
    });
  }

  graphModal.addEventListener('click', function(e) {
    if (e.target === graphModal) {
      closeGraph();
    }
  });

  // Global keyboard shortcut - attach to document, not just inside DOMContentLoaded
  function handleGraphKeyboard(e) {
    // Escape to close graph modal
    if (e.key === 'Escape' && graphModal && graphModal.classList.contains('active')) {
      closeGraph();
      return;
    }
    // 'g' key to open graph - works everywhere except in input fields
    if ((e.key === 'g' || e.key === 'G') && 
        e.target.tagName !== 'INPUT' && 
        e.target.tagName !== 'TEXTAREA' && 
        !e.ctrlKey && 
        !e.metaKey && 
        !e.altKey &&
        !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      openGraph();
    }
  }

  document.addEventListener('keydown', handleGraphKeyboard);

  // Also attach to window for extra reliability
  window.addEventListener('keydown', handleGraphKeyboard);


  // Render mini-graph in sidebar immediately using D3-force
  function renderMiniGraph() {
    const container = document.getElementById('mini-graph-container');
    if (!container || typeof d3 === 'undefined') return;

    const width = container.clientWidth || 180;
    const height = container.clientHeight || 150;
    const currentId = getCurrentPageId();

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`);

    const nodes = graphData.nodes.map(d => ({...d}));
    const links = graphData.links.map(d => ({source: d.source, target: d.target}));

    const connectedNodes = new Set();
    graphData.links.forEach(l => {
      if (l.source === currentId || l.target === currentId) {
        connectedNodes.add(l.source);
        connectedNodes.add(l.target);
      }
    });

    // Find current node and center it
    const currentNode = nodes.find(n => n.id === currentId);
    const centerX = width / 2;
    const centerY = height / 2;

    if (currentNode) {
      // Set current node to center
      currentNode.fx = centerX;
      currentNode.fy = centerY;
    }

    // D3 force simulation for mini graph
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(30))
      .force('charge', d3.forceManyBody().strength(-60))
      .force('center', d3.forceCenter(centerX, centerY))
      .force('collision', d3.forceCollide().radius(10))
      .stop();

    // Run simulation synchronously for static layout
    for (let i = 0; i < 100; i++) simulation.tick();

    // Clamp positions (except current node which stays fixed)
    nodes.forEach(n => {
      if (n.id !== currentId) {
      n.x = Math.max(15, Math.min(width - 15, n.x));
      n.y = Math.max(15, Math.min(height - 15, n.y));
      }
    });

    // Release fixed position after simulation
    if (currentNode) {
      currentNode.fx = null;
      currentNode.fy = null;
    }

    // Draw links
    svg.selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)
      .attr('class', d => 'graph-link' + (connectedNodes.has(d.source.id) && connectedNodes.has(d.target.id) ? ' connected' : ''));

    // Draw nodes with hover tooltip
    const nodeGroups = svg.selectAll('g.mini-node')
      .data(nodes)
      .join('g')
      .attr('class', 'mini-node')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    nodeGroups.append('circle')
      .attr('r', d => d.id === currentId ? 6 : (connectedNodes.has(d.id) ? 4 : 3))
      .attr('fill', d => d.id === currentId ? 'var(--bs-primary)' : (catColors[d.cat] || 'var(--bs-secondary)'))
      .attr('class', d => 'graph-node' + (d.id === currentId ? ' current' : ''));

    // Tooltip on hover
    const tooltip = d3.select(container).append('div')
      .attr('class', 'mini-graph-tooltip')
      .style('opacity', 0);

    nodeGroups
      .on('mouseenter', (event, d) => {
        tooltip.text(d.label)
          .style('left', (d.x + 10) + 'px')
          .style('top', (d.y - 5) + 'px')
          .style('opacity', 1);
      })
      .on('mouseleave', () => tooltip.style('opacity', 0));
  }

  // Render mini graph - ensure it runs
  function tryRenderMiniGraph() {
    const container = document.getElementById('mini-graph-container');
    if (!container) {
      console.warn('Mini graph container not found');
      return false;
    }
    if (typeof d3 === 'undefined') {
      console.warn('D3.js not loaded yet');
      return false;
    }
    if (!graphData) {
      console.warn('Graph data not available');
      return false;
    }
    try {
  renderMiniGraph();
      return true;
    } catch (error) {
      console.error('Error rendering mini graph:', error);
      return false;
    }
  }

  // Try immediately
  if (!tryRenderMiniGraph()) {
    // Wait for D3 to load
    let attempts = 0;
    const checkD3 = setInterval(() => {
      attempts++;
      if (tryRenderMiniGraph() || attempts > 50) {
        clearInterval(checkD3);
      }
    }, 100);
  }

  // Mobile floating graph button - always available as fallback
  const mobileGraphBtn = document.createElement('button');
  mobileGraphBtn.className = 'mobile-graph-btn';
  mobileGraphBtn.setAttribute('aria-label', 'Open the map of this site (g)');
  mobileGraphBtn.title = 'Map of this site (g)';
  mobileGraphBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="4" cy="15" r="2"/><circle cx="10" cy="5" r="2"/><circle cx="16" cy="13" r="2"/><path d="M5.3 13.5 8.8 6.7M11.6 6.3l3.2 5.1M6 15.2l8-1.6"/></svg>';
  mobileGraphBtn.title = 'View connections (or press g)';
  mobileGraphBtn.setAttribute('aria-label', 'Open connection graph');
  mobileGraphBtn.type = 'button'; // Prevent form submission
  mobileGraphBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    openGraph();
  });
  document.body.appendChild(mobileGraphBtn);

  // Ensure mobile button is always in DOM and accessible
  mobileGraphBtn.style.display = 'none'; // Hidden by default, shown via CSS on mobile

  let graphInitialized = false;
  let currentGraphState = { nodes: [], links: [], svg: null, simulation: null };
  let activeCategory = 'all';
  let searchFilter = '';

  let zoomBehavior = null;
  let currentTransform = d3.zoomIdentity;

  function initGraph() {
    if (graphInitialized || typeof d3 === 'undefined') {
      console.warn('initGraph skipped:', { graphInitialized, d3Loaded: typeof d3 !== 'undefined' });
      return;
    }
    graphInitialized = true;
    renderGraph();

    // Setup search and filters
    const searchInput = document.getElementById('graph-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchFilter = e.target.value.toLowerCase();
        renderGraph();
      });
    }

    const filterBtns = document.querySelectorAll('.graph-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.cat;
        renderGraph();
      });
    });

    // Setup zoom controls
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
    const container = document.getElementById('graph-container');
        const svg = d3.select(container).select('svg');
        if (svg && zoomBehavior) {
          svg.transition().call(zoomBehavior.scaleBy, 1.5);
        }
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        const container = document.getElementById('graph-container');
        const svg = d3.select(container).select('svg');
        if (svg && zoomBehavior) {
          svg.transition().call(zoomBehavior.scaleBy, 1 / 1.5);
        }
      });
    }

    if (zoomResetBtn) {
      zoomResetBtn.addEventListener('click', () => {
        const container = document.getElementById('graph-container');
        const svg = d3.select(container).select('svg');
        if (svg && zoomBehavior) {
          svg.transition().call(zoomBehavior.transform, d3.zoomIdentity);
        }
      });
    }
  }

  function renderGraph() {
    const container = document.getElementById('graph-container');
    if (!container) return;

    // Clear existing graph
    d3.select(container).selectAll('*').remove();

    const width = container.clientWidth;
    const height = container.clientHeight;
    const currentId = getCurrentPageId();

    const svg = d3.select(container).append('svg')
      .attr('width', width)
      .attr('height', height);

    // Create a group for all graph elements (for zoom/pan)
    const g = svg.append('g');

    // Create zoom behavior
    zoomBehavior = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', function(event) {
        currentTransform = event.transform;
        g.attr('transform', event.transform);
      });

    // Apply zoom to svg
    svg.call(zoomBehavior);

    // Filter nodes by category and search
    let filteredNodes = graphData.nodes.map(d => ({
      ...d,
      id: String(d.id)  // Ensure all node IDs are strings
    }));
    if (activeCategory !== 'all') {
      filteredNodes = filteredNodes.filter(n => n.cat === activeCategory);
    }
    if (searchFilter) {
      filteredNodes = filteredNodes.filter(n => 
        n.label.toLowerCase().includes(searchFilter) || 
        n.path.toLowerCase().includes(searchFilter)
      );
    }

    const nodeIds = new Set(filteredNodes.map(n => String(n.id)));

    // Filter links to only include filtered nodes
    // Create new link objects with string IDs for D3 forceLink
    const filteredLinks = graphData.links
      .filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      })
      .map(l => {
        // Create new objects with string IDs (don't reference original)
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return {source: String(sourceId), target: String(targetId)};
      });

    // Find connected nodes and paths
    const connectedNodes = new Set();
    const paths = new Map();

    graphData.links.forEach(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;

      if (sourceId === currentId || targetId === currentId) {
        connectedNodes.add(sourceId);
        connectedNodes.add(targetId);
      }

      // Build path map for highlighting
      if (!paths.has(sourceId)) paths.set(sourceId, new Set());
      paths.get(sourceId).add(targetId);
      if (!paths.has(targetId)) paths.set(targetId, new Set());
      paths.get(targetId).add(sourceId);
    });

    // Find all nodes in paths from current
    function findPathNodes(startId, visited = new Set()) {
      if (visited.has(startId)) return visited;
      visited.add(startId);
      const neighbors = paths.get(startId) || new Set();
      neighbors.forEach(neighbor => {
        if (nodeIds.has(neighbor)) {
          findPathNodes(neighbor, visited);
      }
    });
      return visited;
    }

    const pathNodes = currentId ? findPathNodes(currentId) : new Set();

    // Find current node and center it
    const currentNode = filteredNodes.find(n => String(n.id) === String(currentId));
    const centerX = width / 2;
    const centerY = height / 2;

    if (currentNode) {
      // Set current node to center and fix it there
      currentNode.fx = centerX;
      currentNode.fy = centerY;
    }

    // D3 force simulation for full graph - centered on current node
    // Create a map for quick node lookup by ID
    const nodeMap = new Map(filteredNodes.map(n => [String(n.id), n]));

    // Ensure all links reference valid node IDs (filteredLinks already has string IDs)
    const validLinks = filteredLinks.filter(l => {
      const sourceId = String(l.source);
      const targetId = String(l.target);
      return nodeMap.has(sourceId) && nodeMap.has(targetId);
    }).map(l => ({
      // Create fresh objects to avoid mutation issues
      source: String(l.source),
      target: String(l.target)
    }));

    const simulation = d3.forceSimulation(filteredNodes)
      .force('link', d3.forceLink(validLinks).id(d => String(d.id)).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(centerX, centerY))
      .force('collision', d3.forceCollide().radius(25))
      .stop();

    // Run simulation synchronously
    for (let i = 0; i < 150; i++) simulation.tick();

    // Clamp positions (except current node which stays fixed at center)
    filteredNodes.forEach(n => {
      if (String(n.id) !== String(currentId)) {
      n.x = Math.max(50, Math.min(width - 50, n.x));
      n.y = Math.max(50, Math.min(height - 50, n.y));
      }
    });

    // Keep current node at center (don't release fixed position)
    // This ensures it stays centered even if simulation continues
    if (currentNode) {
      currentNode.fx = centerX;
      currentNode.fy = centerY;
    }

    // Draw links with path highlighting (inside the g group for zoom/pan)
    // After simulation, D3 mutates validLinks: source/target are now node objects
    g.selectAll('line.graph-link')
      .data(validLinks)
      .join('line')
      .attr('class', 'graph-link')
      .attr('x1', d => {
        // After simulation, source/target are node objects with x/y properties
        if (d.source && typeof d.source === 'object' && typeof d.source.x === 'number') {
          return d.source.x;
        }
        // Fallback: find node by ID if source is still a string
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const sourceNode = filteredNodes.find(n => String(n.id) === String(sourceId));
        return sourceNode && typeof sourceNode.x === 'number' ? sourceNode.x : 0;
      })
      .attr('y1', d => {
        if (d.source && typeof d.source === 'object' && typeof d.source.y === 'number') {
          return d.source.y;
        }
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const sourceNode = filteredNodes.find(n => String(n.id) === String(sourceId));
        return sourceNode && typeof sourceNode.y === 'number' ? sourceNode.y : 0;
      })
      .attr('x2', d => {
        if (d.target && typeof d.target === 'object' && typeof d.target.x === 'number') {
          return d.target.x;
        }
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        const targetNode = filteredNodes.find(n => String(n.id) === String(targetId));
        return targetNode && typeof targetNode.x === 'number' ? targetNode.x : 0;
      })
      .attr('y2', d => {
        if (d.target && typeof d.target === 'object' && typeof d.target.y === 'number') {
          return d.target.y;
        }
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        const targetNode = filteredNodes.find(n => String(n.id) === String(targetId));
        return targetNode && typeof targetNode.y === 'number' ? targetNode.y : 0;
      })
      .attr('class', d => {
        // Get IDs from node objects (after simulation) or fallback to string IDs
        const sourceId = d.source && typeof d.source === 'object' ? String(d.source.id) : String(d.source);
        const targetId = d.target && typeof d.target === 'object' ? String(d.target.id) : String(d.target);
        const bothConnected = connectedNodes.has(sourceId) && connectedNodes.has(targetId);
        const bothInPath = pathNodes.has(sourceId) && pathNodes.has(targetId);
        return 'graph-link' + (bothConnected ? ' connected' : '') + (bothInPath ? ' path' : '');
      });

    // Draw nodes with labels (inside the g group for zoom/pan)
    const nodeGroups = g.selectAll('g.graph-node')
      .data(filteredNodes)
      .join('g')
      .attr('class', d => {
        const isCurrent = d.id === currentId;
        const isConnected = connectedNodes.has(d.id);
        const isInPath = pathNodes.has(d.id);
        return 'graph-node' + 
          (isCurrent ? ' current' : '') + 
          (isConnected ? ' connected' : '') +
          (isInPath ? ' path' : '');
      })
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => { window.location.href = d.path; });

    nodeGroups.append('circle')
      .attr('r', d => {
        if (d.id === currentId) return 10;
        if (connectedNodes.has(d.id)) return 8;
        if (pathNodes.has(d.id)) return 7;
        return 6;
      })
      .attr('fill', d => {
        if (d.id === currentId) return '#20B2AA';  /* True Teal */
        if (connectedNodes.has(d.id)) return catColors[d.cat] || 'var(--bs-secondary)';
        if (pathNodes.has(d.id)) return catColors[d.cat] || 'var(--bs-secondary)';
        return catColors[d.cat] || 'var(--bs-secondary)';
      })
      .attr('opacity', d => {
        if (d.id === currentId) return 1;
        if (connectedNodes.has(d.id)) return 1;
        if (pathNodes.has(d.id)) return 0.8;
        return 0.5;
      });

    nodeGroups.append('text')
      .attr('y', 20)
      .text(d => d.label);

    currentGraphState = { nodes: filteredNodes, links: filteredLinks, svg, simulation };
  }
});

// Light / dark shared with LiveLines: see assets/js/theme-cookie.js (cookie ra_theme).
