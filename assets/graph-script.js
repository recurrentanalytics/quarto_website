// Wait for D3.js to be available before starting
(function waitForD3() {
  if (typeof d3 !== 'undefined' && typeof d3.forceSimulation !== 'undefined') {
    // D3 is ready, proceed
    initGraphScript();
  } else if (typeof window.define !== 'undefined') {
    // require.js is present, D3 might load via AMD
    // Check if D3 is already on window
    if (window.d3 && typeof window.d3.forceSimulation !== 'undefined') {
      initGraphScript();
    } else {
      // Wait a bit and check again
      setTimeout(waitForD3, 100);
    }
  } else {
    // No require.js, D3 should load normally
    setTimeout(waitForD3, 100);
  }
})();

function initGraphScript() {
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded fired - graph script starting, D3 available:', typeof d3 !== 'undefined');
  
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

  // Keyboard shortcuts
  const noteLinks = Array.from(document.querySelectorAll('.quarto-listing-default a, .sidebar-item a'));
  let currentIndex = -1;

  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
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
  hint.innerHTML = '/ search · j/k navigate · ? hints';
  document.body.appendChild(hint);


  // Reading time - add to article pages
  const articleBody = document.querySelector('.quarto-title-block, #quarto-document-content');
  const contentArea = document.querySelector('#quarto-document-content, .content, main');
  if (articleBody && contentArea) {
    const text = contentArea.innerText || '';
    const wordCount = text.trim().split(/\s+/).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    const timeSpan = document.createElement('span');
    timeSpan.className = 'reading-time';
    timeSpan.textContent = readingTime + ' min read';
    const titleMeta = document.querySelector('.quarto-title-meta, .quarto-title');
    if (titleMeta) {
      titleMeta.appendChild(document.createTextNode(' · '));
      titleMeta.appendChild(timeSpan);
    }
  }


  // Network Graph - Obsidian-style visualization
  // Nodes auto-generated from search index, links manually curated
  let graphData = {
    nodes: [],
    links: [
      // Manual link definitions - can be enhanced with auto-detection later
      { source: 'home', target: 'notes' },
      { source: 'home', target: 'work' },
      { source: 'home', target: 'reading' },
      { source: 'home', target: 'about' },
      { source: 'notes', target: 'hello' },
      { source: 'notes', target: 'monte-carlo' },
      { source: 'notes', target: 'sal' },
      { source: 'notes', target: 'risk-1' },
      { source: 'risk-1', target: 'monte-carlo' },
      { source: 'risk-1', target: 'risk-2' },
      { source: 'risk-2', target: 'risk-1' },
      { source: 'risk-2', target: 'risk-3' },
      { source: 'risk-2', target: 'sal' },
      { source: 'risk-2', target: 'heatwave' },
      { source: 'risk-3', target: 'risk-1' },
      { source: 'risk-3', target: 'risk-2' },
      { source: 'risk-3', target: 'monte-carlo' },
      { source: 'risk-3', target: 'sal' },
      { source: 'work', target: 'heatwave' },
      { source: 'heatwave', target: 'sal' },
      { source: 'heatwave', target: 'risk-2' },
      { source: 'sal', target: 'heatwave' },
      { source: 'monte-carlo', target: 'risk-3' }
    ]
  };
  
  // Auto-generate graph nodes from search index
  // Always use absolute path from site root - works from any page
  const searchJsonPath = '/search.json';
  
  console.log('Fetching search.json from:', searchJsonPath, 'Current path:', window.location.pathname);
  fetch(searchJsonPath)
    .then(res => {
      if (!res.ok) {
        console.warn('Failed to fetch search.json from', searchJsonPath, 'status:', res.status);
        // Try relative path as fallback for subdirectories
        const fallback = window.location.pathname.includes('/work/') || window.location.pathname.includes('/notes/')
          ? '../search.json'
          : './search.json';
        console.log('Trying fallback path:', fallback);
        return fetch(fallback).then(res2 => {
          if (!res2.ok) {
            console.error('Fallback also failed, status:', res2.status);
            throw new Error('Failed to fetch search.json from both paths');
          }
          console.log('Successfully fetched from fallback path');
          return res2;
        });
      }
      console.log('Successfully fetched search.json');
      return res;
    })
    .then(res => res.json())
    .then(searchData => {
      const nodeMap = new Map();
      
      // Core navigation pages
      const coreNodes = [
        { id: 'home', label: 'Home', path: '/', cat: 'nav' },
        { id: 'about', label: 'About', path: '/about.html', cat: 'nav' },
        { id: 'notes', label: 'Notes', path: '/notes/', cat: 'nav' },
        { id: 'work', label: 'Work', path: '/work/', cat: 'nav' },
        { id: 'reading', label: 'Reading', path: '/reading/', cat: 'nav' },
        { id: 'contact', label: 'Contact', path: '/contact_cv.html', cat: 'nav' }
      ];
      
      coreNodes.forEach(node => {
        nodeMap.set(node.path, node);
      });
      
      // Extract pages from search index
      searchData.forEach(item => {
        const path = '/' + item.href.split('#')[0];
        if (!nodeMap.has(path) && !path.includes('index.html')) {
          // Determine category from path
          let cat = 'nav';
          if (path.startsWith('/notes/')) cat = 'notes';
          else if (path.startsWith('/work/')) cat = 'work';
          else if (path.startsWith('/reading/')) cat = 'reading';
          
          // Create ID from path (sanitize for graph)
          const id = path.replace(/[\/\.]/g, '-').replace(/^-|-$/g, '').replace(/html$/g, '');
          
          nodeMap.set(path, {
            id: id,
            label: item.title || path.split('/').pop(),
            path: path,
            cat: cat
          });
        }
      });
      
      graphData.nodes = Array.from(nodeMap.values());
      
      // Simple, reliable auto-generation based on structure
      console.log('Auto-generating graph links based on structure...');
      const autoLinks = [];
      
      // 1. Connect all notes to notes index
      const notesNodes = graphData.nodes.filter(n => n.cat === 'notes');
      const notesIndexNode = graphData.nodes.find(n => n.path === '/notes/' || n.path === '/notes/index.html');
      if (notesIndexNode) {
        notesNodes.forEach(note => {
          if (note.id !== notesIndexNode.id) {
            autoLinks.push({ source: note.id, target: notesIndexNode.id });
          }
        });
      }
      
      // 2. Connect notes in same subdirectory (e.g., climate/)
      notesNodes.forEach(note1 => {
        notesNodes.forEach(note2 => {
          if (note1.id !== note2.id) {
            const note1Dir = note1.path.split('/').slice(0, -1).join('/');
            const note2Dir = note2.path.split('/').slice(0, -1).join('/');
            if (note1Dir === note2Dir && note1Dir !== '/notes' && note1Dir.length > 6) {
              if (!autoLinks.find(l => l.source === note1.id && l.target === note2.id)) {
                autoLinks.push({ source: note1.id, target: note2.id });
              }
            }
          }
        });
      });
      
      // 3. Connect notes in same series (e.g., risk-series-1, risk-series-2, risk-series-3)
      notesNodes.forEach(note1 => {
        notesNodes.forEach(note2 => {
          if (note1.id !== note2.id) {
            // Extract base name (remove numbers/suffixes)
            const name1 = note1.path.replace(/-\d+$/, '').replace(/part-\d+/i, '').replace(/series-\d+/i, '');
            const name2 = note2.path.replace(/-\d+$/, '').replace(/part-\d+/i, '').replace(/series-\d+/i, '');
            if (name1 === name2 && name1.length > 10) { // Only if meaningful match
              if (!autoLinks.find(l => l.source === note1.id && l.target === note2.id)) {
                autoLinks.push({ source: note1.id, target: note2.id });
              }
            }
          }
        });
      });
      
      // 4. Connect work to work index
      const workNodes = graphData.nodes.filter(n => n.cat === 'work');
      const workIndexNode = graphData.nodes.find(n => n.path === '/work/' || n.path === '/work/index.html');
      if (workIndexNode) {
        workNodes.forEach(workItem => {
          if (workItem.id !== workIndexNode.id) {
            autoLinks.push({ source: workItem.id, target: workIndexNode.id });
          }
        });
      }
      
      // Merge with manual links
      const manualLinks = graphData.links;
      const mergedLinks = [...manualLinks];
      autoLinks.forEach(autoLink => {
        if (!mergedLinks.find(l => l.source === autoLink.source && l.target === autoLink.target)) {
          mergedLinks.push(autoLink);
        }
      });
      
      graphData.links = mergedLinks;
      console.log(`Generated ${autoLinks.length} structural links, total links: ${mergedLinks.length}`);
      
      // Re-render with new links
      createSidebarGraph();
      renderMiniGraph();
      graphInitialized = false;
      
      // Generate backlinks and related content after graph data is ready
      injectBacklinksAndRelated();
      
      // Ensure sidebar graph container exists
      createSidebarGraph();
      
      // Initial render (will be empty, but container will be ready)
      renderMiniGraph();
      
      // Reset graph initialization flag so modal graph can be re-initialized with new data
      graphInitialized = false;
    })
    .catch(err => {
      console.error('Failed to load search index for graph', err);
      // Fallback to minimal core nodes
      graphData.nodes = [
        { id: 'home', label: 'Home', path: '/', cat: 'nav' },
        { id: 'about', label: 'About', path: '/about.html', cat: 'nav' },
        { id: 'notes', label: 'Notes', path: '/notes/', cat: 'nav' },
        { id: 'work', label: 'Work', path: '/work/', cat: 'nav' },
        { id: 'reading', label: 'Reading', path: '/reading/', cat: 'nav' },
        { id: 'contact', label: 'Contact', path: '/contact_cv.html', cat: 'nav' }
      ];
      createSidebarGraph();
      renderMiniGraph();
    });
  
  // Category colors for graph nodes
  const catColors = {
    nav: 'var(--bs-secondary)',
    notes: 'var(--bs-info)',
    work: 'var(--bs-success)',
    reading: 'var(--bs-warning)'
  };

  // Create sidebar mini-graph widget
  // ALWAYS create it - on ALL pages, regardless of sidebar existence
  function createSidebarGraph() {
    const existingContainer = document.getElementById('mini-graph-container');
    
    // If graph already exists and is in a valid location, just ensure it's visible
    if (existingContainer) {
      const existingGraph = existingContainer.closest('.sidebar-graph');
      if (existingGraph && existingGraph.parentElement) {
        // Graph exists - check if it needs to be moved to sidebar
        let sidebar = document.querySelector('#quarto-margin-sidebar');
        if (!sidebar) sidebar = document.querySelector('.quarto-sidebar');
        if (!sidebar) sidebar = document.querySelector('.sidebar');
        if (!sidebar) sidebar = document.querySelector('#TOC');
        if (!sidebar) sidebar = document.querySelector('#quarto-toc');
        if (!sidebar) sidebar = document.querySelector('.quarto-listing');
        if (!sidebar) sidebar = document.querySelector('[role="complementary"]');
        if (!sidebar) sidebar = document.querySelector('nav[role="doc-toc"]');
        if (!sidebar) sidebar = document.querySelector('aside');
        
        // If sidebar exists and graph is not in it, move it there
        if (sidebar && !sidebar.contains(existingGraph)) {
          sidebar.insertBefore(existingGraph, sidebar.firstChild);
          console.log('Moved existing graph to sidebar:', sidebar.className || sidebar.id);
        }
        // Ensure it's visible
        existingGraph.style.display = 'block';
        existingGraph.style.visibility = 'visible';
        existingGraph.style.opacity = '1';
        return;
      }
    }
    
    // Create new graph widget - ALWAYS create it
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
    
    // Try to find sidebar (in order of preference) - more comprehensive search
    let sidebar = document.querySelector('#quarto-margin-sidebar');
    if (!sidebar) sidebar = document.querySelector('.quarto-sidebar');
    if (!sidebar) sidebar = document.querySelector('.sidebar');
    if (!sidebar) sidebar = document.querySelector('#TOC');
    if (!sidebar) sidebar = document.querySelector('#quarto-toc');
    if (!sidebar) sidebar = document.querySelector('nav[role="doc-toc"]');
    if (!sidebar) sidebar = document.querySelector('.quarto-listing');
    if (!sidebar) sidebar = document.querySelector('[role="complementary"]');
    if (!sidebar) sidebar = document.querySelector('aside');
    
    // Also try to find any element with TOC-related classes
    if (!sidebar) {
      const tocElements = document.querySelectorAll('[class*="toc"], [class*="TOC"], [id*="toc"], [id*="TOC"]');
      for (let el of tocElements) {
        if (el.offsetParent !== null) { // Element is visible
          sidebar = el;
          break;
        }
      }
    }
    
    if (sidebar) {
      // Insert at the top of sidebar
      try {
        sidebar.insertBefore(sidebarGraph, sidebar.firstChild);
        console.log('Created sidebar graph widget in sidebar:', sidebar.className || sidebar.id || 'found');
      } catch (e) {
        // If insertBefore fails, try appendChild
        sidebar.appendChild(sidebarGraph);
        console.log('Created sidebar graph widget in sidebar (appended):', sidebar.className || sidebar.id);
      }
    } else {
      // No sidebar found - try to insert at top of main content area
      const mainContent = document.querySelector('#quarto-document-content, main, .content, article, .quarto-content, .page-columns, .column-body');
      if (mainContent) {
        try {
          mainContent.insertBefore(sidebarGraph, mainContent.firstChild);
          console.log('Created sidebar graph widget at top of main content');
        } catch (e) {
          mainContent.appendChild(sidebarGraph);
          console.log('Created sidebar graph widget in main content (appended)');
        }
      } else {
        // Last resort: fixed position widget (always visible)
        document.body.appendChild(sidebarGraph);
        sidebarGraph.style.position = 'fixed';
        sidebarGraph.style.bottom = '4rem';
        sidebarGraph.style.right = '1rem';
        sidebarGraph.style.width = '200px';
        sidebarGraph.style.zIndex = '100';
        console.log('Created sidebar graph widget as fixed element (no sidebar or main content found)');
      }
    }
  }
  
  // Aggressively try to create graph - multiple times to catch all page types
  createSidebarGraph();
  setTimeout(createSidebarGraph, 50);
  setTimeout(createSidebarGraph, 100);
  setTimeout(createSidebarGraph, 250);
  setTimeout(createSidebarGraph, 500);
  setTimeout(createSidebarGraph, 1000);
  setTimeout(createSidebarGraph, 2000);
  setTimeout(createSidebarGraph, 3000);
  setTimeout(createSidebarGraph, 5000);
  
  // Aggressive MutationObserver to catch ALL DOM changes
  const observer = new MutationObserver(function(mutations) {
    const hasContainer = document.getElementById('mini-graph-container');
    if (!hasContainer) {
      createSidebarGraph();
    } else {
      // Graph exists - ensure it's in the right place
      const graph = document.querySelector('.sidebar-graph');
      if (graph) {
        // Try all possible sidebar selectors
        let sidebar = document.querySelector('#quarto-margin-sidebar, .quarto-sidebar, .sidebar, #TOC, #quarto-toc, nav[role="doc-toc"], [role="complementary"], aside');
        if (sidebar && !sidebar.contains(graph)) {
          createSidebarGraph();
        }
      }
    }
  });
  
  // Observe everything - body, documentElement, and common content containers
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Also watch for main content area
  const mainObserver = new MutationObserver(function() {
    const hasContainer = document.getElementById('mini-graph-container');
    if (!hasContainer) {
      createSidebarGraph();
    }
  });
  
  // Watch for main content appearing
  const checkMainContent = setInterval(function() {
    const mainContent = document.querySelector('#quarto-document-content, main, .content, article');
    if (mainContent) {
      const hasContainer = document.getElementById('mini-graph-container');
      if (!hasContainer) {
        createSidebarGraph();
      }
      clearInterval(checkMainContent);
    }
  }, 100);
  
  // Stop checking after 10 seconds
  setTimeout(function() {
    clearInterval(checkMainContent);
  }, 10000);

  // Create modal with controls
  const graphModal = document.createElement('div');
  graphModal.className = 'graph-modal-overlay';
  graphModal.innerHTML = `
    <div class="graph-modal">
      <div class="graph-modal-header">
        <span class="graph-modal-title">Note Connections</span>
        <div class="graph-modal-controls">
          <input type="text" class="graph-search-input" id="graph-search-input" placeholder="Search nodes..." autocomplete="off">
          <div class="graph-category-filters">
            <button class="graph-filter-btn active" data-cat="all" title="Show all">All</button>
            <button class="graph-filter-btn active" data-cat="notes" title="Toggle notes">Notes</button>
            <button class="graph-filter-btn active" data-cat="work" title="Toggle work">Work</button>
            <button class="graph-filter-btn active" data-cat="reading" title="Toggle reading">Reading</button>
            <button class="graph-filter-btn active" data-cat="nav" title="Toggle navigation">Nav</button>
          </div>
          <button class="graph-control-btn" id="focus-mode-btn" title="Show only connected nodes">Focus</button>
          <button class="graph-control-btn" id="reset-zoom-btn" title="Reset zoom">Reset</button>
          <button class="graph-modal-close">&times;</button>
        </div>
      </div>
      <div class="graph-container" id="graph-container"></div>
    </div>
  `;
  document.body.appendChild(graphModal);
  
  // Category filter state
  const activeCategories = new Set(['all', 'notes', 'work', 'reading', 'nav']);
  let searchQuery = '';
  let focusedNodeIndex = -1;
  let keyboardFocusableNodes = [];
  
  // Track recent pages (from localStorage)
  function getRecentPages() {
    try {
      const recent = localStorage.getItem('graph-recent-pages');
      return recent ? JSON.parse(recent) : [];
    } catch {
      return [];
    }
  }
  
  function addRecentPage(path) {
    try {
      let recent = getRecentPages();
      recent = recent.filter(p => p.path !== path);
      recent.unshift({ path: path, timestamp: Date.now() });
      recent = recent.slice(0, 10); // Keep last 10
      localStorage.setItem('graph-recent-pages', JSON.stringify(recent));
    } catch {}
  }
  
  // Mark current page as visited
  addRecentPage(window.location.pathname);
  const recentPages = getRecentPages().map(p => p.path);

  function getCurrentPageId() {
    const path = window.location.pathname;
    console.log('Current path:', path);
    console.log('Available nodes:', graphData.nodes.map(n => ({id: n.id, path: n.path})));
    
    // Try exact match first
    let node = graphData.nodes.find(n => path === n.path || path === n.path + 'index.html');
    
    // Try ends-with match (for paths like /notes/ matching /notes/index.html)
    if (!node) {
      node = graphData.nodes.find(n => {
        if (path.endsWith('/') && n.path === path) return true;
        if (n.path.endsWith('/') && path.startsWith(n.path)) return true;
        if (path.endsWith(n.path) || n.path.endsWith(path)) return true;
        return false;
      });
    }
    
    // Handle homepage
    if (!node && (path === '/' || path === '/index.html' || path.endsWith('/index.html'))) {
      node = graphData.nodes.find(n => n.path === '/' || n.id === 'home');
    }
    
    console.log('Found current node:', node ? node.id : 'NOT FOUND');
    return node ? node.id : null;
  }

  function openGraph() {
    graphModal.classList.add('active');
    initGraph();
  }

  function closeGraph() {
    graphModal.classList.remove('active');
  }

  // Add click handler to sidebar graph (using event delegation since element might be created later)
  document.addEventListener('click', function(e) {
    if (e.target.closest('.sidebar-graph')) {
      openGraph();
    }
    // Handle modal close
    if (e.target === graphModal || e.target.classList.contains('graph-modal-close')) {
      closeGraph();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && graphModal.classList.contains('active')) closeGraph();
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      openGraph();
    }
  });

  // Render mini-graph in sidebar immediately using D3-force
  function renderMiniGraph() {
    const container = document.getElementById('mini-graph-container');
    if (!container) {
      console.warn('Graph container not found, creating...');
      createSidebarGraph();
      // Try again after creating
      setTimeout(renderMiniGraph, 100);
      return;
    }
    if (typeof d3 === 'undefined' || typeof d3.forceSimulation === 'undefined') {
      console.warn('D3.js not loaded yet, will retry...', 'd3:', typeof d3, 'forceSimulation:', typeof d3?.forceSimulation);
      // Retry more aggressively
      let retries = 0;
      const maxRetries = 20; // 10 seconds total
      const retryInterval = setInterval(function() {
        retries++;
        if (typeof d3 !== 'undefined' && typeof d3.forceSimulation !== 'undefined') {
          clearInterval(retryInterval);
          console.log('D3.js now available, rendering graph');
          renderMiniGraph();
        } else if (retries >= maxRetries) {
          clearInterval(retryInterval);
          console.error('D3.js failed to load after', maxRetries * 500, 'ms');
        }
      }, 500);
      return;
    }
    if (!graphData.nodes || graphData.nodes.length === 0) {
      console.log('Graph data not loaded yet, nodes:', (graphData.nodes && graphData.nodes.length) || 0, '- will render when data loads');
      // Don't return - still create container so it's visible
      container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--bs-secondary); font-size: 0.8rem;">Loading connections...</div>';
      return;
    }
    
    console.log('Rendering graph with', graphData.nodes.length, 'nodes');
    
    // Clear container before rendering
    container.innerHTML = '';
    
    const width = container.clientWidth || 180;
    const height = container.clientHeight || 150;
    const currentId = getCurrentPageId();

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`);

    const nodes = graphData.nodes.map(d => ({...d}));
    const links = graphData.links.map(d => ({source: d.source, target: d.target})).filter(l => {
      // Only include links where both source and target nodes exist
      return nodes.find(n => n.id === l.source) && nodes.find(n => n.id === l.target);
    });

    const connectedNodes = new Set();
    graphData.links.forEach(l => {
      if (l.source === currentId || l.target === currentId) {
        connectedNodes.add(l.source);
        connectedNodes.add(l.target);
      }
    });

    // Find current page node and center on it
    const currentNode = nodes.find(n => n.id === currentId);
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Pin current node to center BEFORE simulation
    if (currentNode) {
      currentNode.x = centerX;
      currentNode.y = centerY;
      currentNode.fx = centerX; // Fixed position
      currentNode.fy = centerY;
    }
    
    // D3 force simulation for mini graph - center on current page
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(30))
      .force('charge', d3.forceManyBody().strength(-60))
      .force('center', d3.forceCenter(centerX, centerY))
      .force('collision', d3.forceCollide().radius(10));
      
    // Pin current node to center with strong force
    if (currentNode) {
      simulation.force('x', d3.forceX(centerX).strength(d => d.id === currentId ? 1.0 : 0.05));
      simulation.force('y', d3.forceY(centerY).strength(d => d.id === currentId ? 1.0 : 0.05));
    }
    
    simulation.stop();

    // Run simulation synchronously for static layout (more iterations for better centering)
    for (let i = 0; i < 150; i++) simulation.tick();
    
    // Ensure current node stays at center
    if (currentNode) {
      currentNode.x = centerX;
      currentNode.y = centerY;
      currentNode.fx = centerX;
      currentNode.fy = centerY;
    }

    // Clamp positions (but not current node)
    nodes.forEach(n => {
      if (n.id !== currentId) {
        n.x = Math.max(15, Math.min(width - 15, n.x));
        n.y = Math.max(15, Math.min(height - 15, n.y));
      }
    });

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
  
  // Initial render (will be empty, but container will be ready)
  createSidebarGraph();
  renderMiniGraph();

  // Mobile floating graph button (always visible)
  console.log('Creating mobile graph button...');
  const mobileGraphBtn = document.createElement('button');
  mobileGraphBtn.className = 'mobile-graph-btn';
  mobileGraphBtn.innerHTML = '&#x1F578;'; // spider web emoji as graph icon
  mobileGraphBtn.title = 'View connections (or press g)';
  mobileGraphBtn.setAttribute('aria-label', 'Open connection graph');
  mobileGraphBtn.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Graph button clicked!');
    openGraph();
  });
  document.body.appendChild(mobileGraphBtn);
  console.log('Mobile graph button added to body', mobileGraphBtn);

  let graphInitialized = false;
  let graphZoom = null;
  let focusMode = false;
  
  function initGraph() {
    if (typeof d3 === 'undefined' || !graphData.nodes || graphData.nodes.length === 0) return;

    const container = document.getElementById('graph-container');
    if (!container) return;
    
    // Clear container before rendering
    container.innerHTML = '';
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    const currentId = getCurrentPageId();

    // Calculate node degrees (connections) for sizing
    const nodeDegrees = new Map();
    graphData.nodes.forEach(n => nodeDegrees.set(n.id, 0));
    graphData.links.forEach(l => {
      nodeDegrees.set(l.source, (nodeDegrees.get(l.source) || 0) + 1);
      nodeDegrees.set(l.target, (nodeDegrees.get(l.target) || 0) + 1);
    });

    // Calculate connected nodes first
    const connectedNodes = new Set();
    if (currentId) {
      graphData.links.forEach(l => {
        if (l.source === currentId || l.target === currentId) {
          connectedNodes.add(l.source);
          connectedNodes.add(l.target);
        }
      });
    }

    // Filter nodes based on focus mode and category filters
    let nodes = graphData.nodes.map(d => ({
      ...d,
      degree: nodeDegrees.get(d.id) || 0
    }));
    
    // Apply category filter
    if (!activeCategories.has('all')) {
      nodes = nodes.filter(n => activeCategories.has(n.cat));
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      nodes = nodes.filter(n => 
        n.label.toLowerCase().includes(query) || 
        n.path.toLowerCase().includes(query) ||
        n.id.toLowerCase().includes(query)
      );
    }
    
    // Apply focus mode filter
    if (focusMode && currentId) {
      nodes = nodes.filter(n => connectedNodes.has(n.id));
    }
    
    // Store for keyboard navigation
    keyboardFocusableNodes = nodes;
    
    // Filter links to only include filtered nodes
    const links = graphData.links.map(d => ({source: d.source, target: d.target})).filter(l => {
      const sourceExists = nodes.find(n => n.id === l.source);
      const targetExists = nodes.find(n => n.id === l.target);
      return sourceExists && targetExists;
    });

    // Create SVG with zoom container
    const svg = d3.select(container).append('svg')
      .attr('width', width)
      .attr('height', height);
      
    const g = svg.append('g');

    // Find current page node and center on it
    const currentGraphNode = nodes.find(n => n.id === currentId);
    const graphCenterX = width / 2;
    const graphCenterY = height / 2;
    
    // Pin current node to center BEFORE simulation
    if (currentGraphNode) {
      currentGraphNode.x = graphCenterX;
      currentGraphNode.y = graphCenterY;
      currentGraphNode.fx = graphCenterX; // Fixed position
      currentGraphNode.fy = graphCenterY;
    }
    
    // D3 force simulation for full graph - center on current page
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(graphCenterX, graphCenterY))
      .force('collision', d3.forceCollide().radius(25));
      
    // Pin current node to center with strong force
    if (currentGraphNode) {
      simulation.force('x', d3.forceX(graphCenterX).strength(d => d.id === currentId ? 1.0 : 0.05));
      simulation.force('y', d3.forceY(graphCenterY).strength(d => d.id === currentId ? 1.0 : 0.05));
    }
    
    simulation.stop();

    // Run simulation synchronously (more iterations for better centering)
    for (let i = 0; i < 200; i++) simulation.tick();
    
    // Ensure current node stays at center
    if (currentGraphNode) {
      currentGraphNode.x = graphCenterX;
      currentGraphNode.y = graphCenterY;
      currentGraphNode.fx = graphCenterX;
      currentGraphNode.fy = graphCenterY;
    }

    // Clamp positions (but not current node)
    nodes.forEach(n => {
      if (n.id !== currentId) {
        n.x = Math.max(50, Math.min(width - 50, n.x));
        n.y = Math.max(50, Math.min(height - 50, n.y));
      }
    });

    // Calculate node sizes based on degree (connections)
    const maxDegree = Math.max(...nodes.map(n => n.degree), 1);
    const minRadius = 6;
    const maxRadius = 16;
    const currentRadius = 18;
    
    function getRadius(d) {
      if (d.id === currentId) return currentRadius;
      // Size based on degree: minRadius + (degree/maxDegree) * (maxRadius - minRadius)
      const size = minRadius + (d.degree / maxDegree) * (maxRadius - minRadius);
      return Math.max(minRadius, Math.min(maxRadius, size));
    }

    // Draw links (with transitions)
    g.selectAll('line')
      .data(links, d => `${d.source.id}-${d.target.id}`)
      .join(
        enter => {
          const line = enter.append('line')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.source.x)
            .attr('y2', d => d.source.y)
            .style('opacity', 0);
          line.transition().duration(300)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y)
            .style('opacity', 1);
          return line;
        },
        update => {
          update.transition().duration(300)
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
          return update;
        },
        exit => {
          exit.transition().duration(300)
            .style('opacity', 0)
            .remove();
          return exit;
        }
      )
      .attr('class', d => 'graph-link' + (connectedNodes.has(d.source.id) && connectedNodes.has(d.target.id) ? ' connected' : ''));

    // Draw nodes with labels (with transitions)
    const nodeGroups = g.selectAll('g.graph-node')
      .data(nodes, d => d.id)
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', d => 'graph-node' + (d.id === currentId ? ' current' : ''))
            .attr('data-node-id', d => d.id)
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .style('opacity', 0);
          g.transition().duration(300).style('opacity', 1);
          return g;
        },
        update => {
          update.transition().duration(300)
            .attr('transform', d => `translate(${d.x},${d.y})`);
          return update;
        },
        exit => {
          exit.transition().duration(300)
            .style('opacity', 0)
            .remove();
          return exit;
        }
      )
      .attr('class', d => 'graph-node' + (d.id === currentId ? ' current' : '') + 
        (focusedNodeIndex >= 0 && keyboardFocusableNodes[focusedNodeIndex]?.id === d.id ? ' keyboard-focused' : ''))
      .style('cursor', 'pointer')
      .on('click', (event, d) => { window.location.href = d.path; });

    nodeGroups.append('circle')
      .attr('r', getRadius)
      .attr('fill', d => {
        if (d.id === currentId) return 'var(--bs-primary)';
        // Check if recently visited
        const isRecent = recentPages.includes(d.path);
        return isRecent ? 'var(--bs-warning)' : (catColors[d.cat] || 'var(--bs-secondary)');
      })
      .attr('class', d => {
        let classes = [];
        if (d.id === currentId) classes.push('current');
        if (recentPages.includes(d.path)) classes.push('recent');
        return classes.join(' ');
      });

    nodeGroups.append('text')
      .attr('y', d => getRadius(d) + 14)
      .text(d => d.label);
      
    // Hover preview tooltip
    const previewTooltip = d3.select(container).append('div')
      .attr('class', 'graph-preview-tooltip')
      .style('opacity', 0)
      .style('pointer-events', 'none');
      
    nodeGroups
      .on('mouseenter', function(event, d) {
        // Fetch page data for preview
        fetch(d.path)
          .then(res => res.text())
          .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extract preview data
            const title = doc.querySelector('h1, .quarto-title h1, title')?.textContent || d.label;
            const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || 
                              doc.querySelector('p')?.textContent?.substring(0, 150) || '';
            const readingTime = doc.querySelector('.reading-time')?.textContent || '';
            
            // Position tooltip
            const [x, y] = d3.pointer(event, container);
            previewTooltip
              .html(`
                <div class="preview-title">${title}</div>
                ${description ? `<div class="preview-description">${description}${description.length >= 150 ? '...' : ''}</div>` : ''}
                ${readingTime ? `<div class="preview-meta">${readingTime}</div>` : ''}
                <div class="preview-path">${d.path}</div>
              `)
              .style('left', (x + 15) + 'px')
              .style('top', (y - 10) + 'px')
              .style('opacity', 1);
          })
          .catch(() => {
            // Fallback if fetch fails
            const [x, y] = d3.pointer(event, container);
            previewTooltip
              .html(`
                <div class="preview-title">${d.label}</div>
                <div class="preview-path">${d.path}</div>
              `)
              .style('left', (x + 15) + 'px')
              .style('top', (y - 10) + 'px')
              .style('opacity', 1);
          });
      })
      .on('mouseleave', () => {
        previewTooltip.style('opacity', 0);
      })
      .on('mousemove', function(event) {
        const [x, y] = d3.pointer(event, container);
        previewTooltip
          .style('left', (x + 15) + 'px')
          .style('top', (y - 10) + 'px');
      });
      
    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
      
    svg.call(zoom);
    graphZoom = zoom;
    
    // Reset zoom to fit
    const bounds = g.node().getBBox();
    const fullWidth = bounds.width;
    const fullHeight = bounds.height;
    const midX = bounds.x + fullWidth / 2;
    const midY = bounds.y + fullHeight / 2;
    
    if (fullWidth && fullHeight) {
      const scale = Math.min(width / fullWidth, height / fullHeight) * 0.9;
      const translate = [width / 2 - scale * midX, height / 2 - scale * midY];
      svg.call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }
    
    
    graphInitialized = true;
  }
  
  // Search input handler
  const searchInput = document.getElementById('graph-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      searchQuery = e.target.value.trim();
      focusedNodeIndex = -1; // Reset focus when searching
      graphInitialized = false;
      initGraph();
    });
    
    // Clear search on Escape
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        e.target.value = '';
        searchQuery = '';
        focusedNodeIndex = -1;
        graphInitialized = false;
        initGraph();
      }
    });
  }
  
  // Category filter handlers
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('graph-filter-btn')) {
      e.preventDefault();
      e.stopPropagation();
      const cat = e.target.getAttribute('data-cat');
      
      if (cat === 'all') {
        // Toggle all
        const allActive = activeCategories.has('all');
        if (allActive) {
          activeCategories.clear();
          activeCategories.add('all');
          document.querySelectorAll('.graph-filter-btn[data-cat]').forEach(btn => {
            if (btn.getAttribute('data-cat') !== 'all') btn.classList.remove('active');
          });
        } else {
          activeCategories.clear();
          activeCategories.add('all', 'notes', 'models', 'projects', 'nav');
          document.querySelectorAll('.graph-filter-btn').forEach(btn => btn.classList.add('active'));
        }
      } else {
        // Toggle individual category
        if (activeCategories.has(cat)) {
          activeCategories.delete(cat);
          activeCategories.delete('all'); // Remove 'all' if any category is deselected
          e.target.classList.remove('active');
        } else {
          activeCategories.add(cat);
          e.target.classList.add('active');
          // If all categories are active, add 'all' back
          const allCats = ['notes', 'work', 'reading', 'nav'];
          if (allCats.every(c => activeCategories.has(c))) {
            activeCategories.add('all');
            document.querySelector('.graph-filter-btn[data-cat="all"]')?.classList.add('active');
          }
        }
      }
      
      graphInitialized = false;
      initGraph();
    }
    
    if (e.target.id === 'focus-mode-btn') {
      e.preventDefault();
      e.stopPropagation();
      focusMode = !focusMode;
      e.target.textContent = focusMode ? 'Show All' : 'Focus';
      e.target.classList.toggle('active', focusMode);
      graphInitialized = false;
      initGraph();
    }
    if (e.target.id === 'reset-zoom-btn') {
      e.preventDefault();
      e.stopPropagation();
      const container = document.getElementById('graph-container');
      if (container && graphZoom) {
        const svg = d3.select(container).select('svg');
        svg.transition().duration(750).call(
          graphZoom.transform,
          d3.zoomIdentity
        );
      }
    }
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    if (!graphModal.classList.contains('active')) return;
    if (e.target.tagName === 'INPUT' && e.target.id !== 'graph-search-input') return;
    
    // Don't interfere with search input typing
    if (e.target.id === 'graph-search-input' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== 'Escape') {
      return;
    }
    
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      
      if (keyboardFocusableNodes.length === 0) return;
      
      // Move focus
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        focusedNodeIndex = Math.min(focusedNodeIndex + 1, keyboardFocusableNodes.length - 1);
      } else {
        focusedNodeIndex = Math.max(focusedNodeIndex - 1, 0);
      }
      
      // Highlight focused node and center on it
      const focusedNode = keyboardFocusableNodes[focusedNodeIndex];
      if (focusedNode) {
        graphInitialized = false;
        initGraph();
        
        // Center on focused node after render
        setTimeout(() => {
          const container = document.getElementById('graph-container');
          if (container && graphZoom) {
            const svg = d3.select(container).select('svg');
            const g = svg.select('g');
            const nodeElement = g.select(`g.graph-node[data-node-id="${focusedNode.id}"]`);
            if (!nodeElement.empty()) {
              const transform = d3.zoomTransform(svg.node());
              const node = focusedNode;
              const x = -node.x * transform.k + container.clientWidth / 2;
              const y = -node.y * transform.k + container.clientHeight / 2;
              svg.transition().duration(300).call(
                graphZoom.transform,
                d3.zoomIdentity.translate(x, y).scale(transform.k)
              );
            }
          }
        }, 100);
      }
    } else if (e.key === 'Enter' && focusedNodeIndex >= 0) {
      e.preventDefault();
      const focusedNode = keyboardFocusableNodes[focusedNodeIndex];
      if (focusedNode) {
        window.location.href = focusedNode.path;
      }
    }
  });

  // Phase 1: Auto-generate Backlinks and Related Content
  function injectBacklinksAndRelated() {
    // Wait for graph data to be available
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      setTimeout(injectBacklinksAndRelated, 500);
      return;
    }

    const currentPath = window.location.pathname;
    const currentId = getCurrentPageId();
    
    // Skip homepage - no related content needed
    if (!currentPath || currentPath === '/' || currentPath === '/index.html') return;
    
    if (!currentId) return; // Skip if we can't identify current page

    // Find backlinks (pages that link TO this page)
    const backlinks = [];
    graphData.links.forEach(link => {
      if (typeof link.target === 'string' && link.target === currentId) {
        const sourceNode = graphData.nodes.find(n => n.id === link.source);
        if (sourceNode && sourceNode.path !== currentPath) {
          backlinks.push(sourceNode);
        }
      } else if (typeof link.target === 'object' && link.target.id === currentId) {
        const sourceNode = typeof link.source === 'string' 
          ? graphData.nodes.find(n => n.id === link.source)
          : link.source;
        if (sourceNode && sourceNode.path !== currentPath) {
          backlinks.push(sourceNode);
        }
      }
    });

    // Find related content (pages this page links TO)
    const related = [];
    graphData.links.forEach(link => {
      if (typeof link.source === 'string' && link.source === currentId) {
        const targetNode = graphData.nodes.find(n => n.id === link.target);
        if (targetNode && targetNode.path !== currentPath) {
          related.push(targetNode);
        }
      } else if (typeof link.source === 'object' && link.source.id === currentId) {
        const targetNode = typeof link.target === 'string'
          ? graphData.nodes.find(n => n.id === link.target)
          : link.target;
        if (targetNode && targetNode.path !== currentPath) {
          related.push(targetNode);
        }
      }
    });

    // Remove duplicates
    const uniqueBacklinks = Array.from(new Map(backlinks.map(b => [b.path, b])).values());
    const uniqueRelated = Array.from(new Map(related.map(r => [r.path, r])).values());

    // Find insertion point (before footer or at end of content)
    const contentArea = document.querySelector('#quarto-document-content, .content, main');
    if (!contentArea) return;

    // Remove existing backlinks and related sections (both manual and auto-generated)
    const existingBacklinks = contentArea.querySelectorAll('.backlinks, .backlinks-auto');
    const existingRelated = contentArea.querySelectorAll('.related-content, .related-content-auto');
    existingBacklinks.forEach(el => el.remove());
    existingRelated.forEach(el => el.remove());

    // Inject backlinks section
    if (uniqueBacklinks.length > 0) {
      const backlinksDiv = document.createElement('div');
      backlinksDiv.className = 'backlinks backlinks-auto';
      backlinksDiv.innerHTML = `
        <h4>Linked from</h4>
        <ul>
          ${uniqueBacklinks.map(node => `
            <li><a href="${node.path}">${node.label}</a></li>
          `).join('')}
        </ul>
      `;
      
      // Insert before footer or at end
      const footer = contentArea.querySelector('footer, .nav-footer');
      if (footer) {
        contentArea.insertBefore(backlinksDiv, footer);
      } else {
        contentArea.appendChild(backlinksDiv);
      }
    }

    // Inject related content section
    if (uniqueRelated.length > 0) {
      const relatedDiv = document.createElement('div');
      relatedDiv.className = 'related-content related-content-auto';
      relatedDiv.innerHTML = `
        <h4>Related content</h4>
        <ul>
          ${uniqueRelated.map(node => `
            <li><a href="${node.path}">${node.label}</a></li>
          `).join('')}
        </ul>
      `;
      
      // Insert after backlinks or before footer
      const backlinksSection = contentArea.querySelector('.backlinks-auto');
      if (backlinksSection) {
        backlinksSection.insertAdjacentElement('afterend', relatedDiv);
      } else {
        const footer = contentArea.querySelector('footer, .nav-footer');
        if (footer) {
          contentArea.insertBefore(relatedDiv, footer);
        } else {
          contentArea.appendChild(relatedDiv);
        }
      }
    }
  }

  // Backlinks will be initialized after graph data loads (called from graph initialization)

  // Phase 2: Reading Trail / Breadcrumb Navigation
  function injectReadingTrail() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return; // Skip on homepage

    const pathParts = path.split('/').filter(p => p && p !== 'index.html');
    const breadcrumbs = [{ title: 'Home', path: '/' }];

    // Build breadcrumbs from path
    let currentPath = '';
    pathParts.forEach((part, index) => {
      currentPath += '/' + part;
      const isLast = index === pathParts.length - 1;
      
      // Capitalize and format the part name
      let title = part
        .replace(/-/g, ' ')
        .replace(/\.(html|qmd)$/g, '')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      // Try to get the actual page title from the document
      if (isLast) {
        const pageTitle = document.querySelector('h1.title, .quarto-title h1, h1')?.textContent?.trim();
        if (pageTitle) title = pageTitle;
      }

      breadcrumbs.push({
        title: title,
        path: currentPath + (isLast ? '' : '/'),
        isLast: isLast
      });
    });

    const contentArea = document.querySelector('#quarto-document-content, .content, main');
    if (!contentArea) return;

    // Remove existing trail
    const existingTrail = contentArea.querySelector('.reading-trail');
    if (existingTrail) existingTrail.remove();

    const trailDiv = document.createElement('nav');
    trailDiv.className = 'reading-trail';
    trailDiv.setAttribute('aria-label', 'Breadcrumb navigation');
    trailDiv.innerHTML = `
      <ol class="breadcrumb">
        ${breadcrumbs.map((crumb, index) => `
          <li class="breadcrumb-item ${crumb.isLast ? 'active' : ''}">
            ${crumb.isLast ? crumb.title : `<a href="${crumb.path}">${crumb.title}</a>`}
          </li>
        `).join('')}
      </ol>
    `;

    // Insert at the top of content
    const firstChild = contentArea.firstElementChild;
    if (firstChild) {
      contentArea.insertBefore(trailDiv, firstChild);
    } else {
      contentArea.appendChild(trailDiv);
    }
  }

  // Initialize Phase 2 features
  });
} // End initGraphScript
