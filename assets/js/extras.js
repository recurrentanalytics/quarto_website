// Lightbox for figures, back-to-top button, related notes (moved out of _quarto.yml).
document.addEventListener('DOMContentLoaded', function() {
  // Create lightbox element
  const lightbox = document.createElement('div');
  lightbox.className = 'image-lightbox';
  lightbox.innerHTML = '<span class="image-lightbox-close">&times;</span><img class="image-lightbox-content" src="" alt="">';
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector('img');
  const lightboxClose = lightbox.querySelector('.image-lightbox-close');

  // Function to open lightbox
  function openLightbox(imgSrc, imgAlt) {
    lightboxImg.src = imgSrc;
    lightboxImg.alt = imgAlt || '';
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // Function to close lightbox
  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Close on X click
  lightboxClose.addEventListener('click', closeLightbox);

  // Close on overlay click
  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });

  // Make all figures and images clickable
  const selectors = [
    '.quarto-figure img',
    'figure img',
    '.cell-output-display img',
    '.cell-output-display svg',
    '.quarto-plot img',
    '.quarto-figure svg',
    'figure svg'
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(img => {
      // Skip small images (likely icons)
      if (img.width && img.width < 100) return;
      if (img.height && img.height < 100) return;

      // Skip navbar/footer images
      if (img.closest('.navbar') || img.closest('.nav-footer')) return;

      img.style.cursor = 'pointer';
      img.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const src = this.src || this.getAttribute('data-src') || this.href;
        if (src) {
          openLightbox(src, this.alt || '');
        }
      });
    });
  });

  // Also handle figure containers
  document.querySelectorAll('.quarto-figure, figure').forEach(figure => {
    const img = figure.querySelector('img, svg');
    if (img && !img.closest('.navbar') && !img.closest('.nav-footer')) {
      figure.style.cursor = 'pointer';
      figure.addEventListener('click', function(e) {
        if (e.target.tagName !== 'IMG' && e.target.tagName !== 'SVG') {
          const img = this.querySelector('img, svg');
          if (img) {
            e.preventDefault();
            e.stopPropagation();
            const src = img.src || img.getAttribute('data-src') || img.href;
            if (src) {
              openLightbox(src, img.alt || '');
            }
          }
        }
      });
    }
  });

  // Back to top button
  (function() {
    const backToTopBtn = document.createElement('button');
    backToTopBtn.className = 'back-to-top-btn';
    backToTopBtn.innerHTML = '↑';
    backToTopBtn.setAttribute('aria-label', 'Back to top');
    backToTopBtn.setAttribute('title', 'Back to top');
    backToTopBtn.type = 'button';

    if (document.body) {
      document.body.appendChild(backToTopBtn);
    } else {
      // Wait for body if not ready
      setTimeout(function() {
        document.body.appendChild(backToTopBtn);
      }, 100);
    }

    // Shown only after two screens, and only once the visitor scrolls up: it never sits over
    // the text being read on the way down (UX fixes 2026-11-25). The direction is taken over
    // at least 8 px, so a slow scroll counts too.
    let lastY = window.scrollY || 0;
    let queued = 0;
    function updateBackToTopVisibility() {
      queued = 0;
      if (!backToTopBtn.parentNode) return;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if (y <= 2 * window.innerHeight) { backToTopBtn.classList.remove('visible'); lastY = y; return; }
      if (y > lastY + 8) { backToTopBtn.classList.remove('visible'); lastY = y; }
      else if (y < lastY - 8) { backToTopBtn.classList.add('visible'); lastY = y; }
    }
    function scheduleBackToTop() { if (!queued) queued = requestAnimationFrame(updateBackToTopVisibility); }

    window.addEventListener('scroll', scheduleBackToTop, { passive: true });
    updateBackToTopVisibility(); // Check on load

    backToTopBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      // Try multiple scroll methods for compatibility
      if (window.scrollTo) {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else if (document.documentElement.scrollTo) {
        document.documentElement.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else {
        // Fallback
        window.scrollTo(0, 0);
      }
    });
  })();


  // Related Notes Section
  function addRelatedNotes() {
    // Only on note pages (not index, not projects, etc.)
    const path = window.location.pathname;
    const isNotePage = path.startsWith('/notes/') && 
                      !path.endsWith('/notes/') && 
                      !path.endsWith('/notes/index.html') &&
                      path.includes('.html');

    if (!isNotePage) return;

    // Get current page categories from meta tags or page data
    const currentCategories = [];
    const currentTags = [];

    // Try to get from meta tags
    const categoryMeta = document.querySelector('meta[name="categories"], meta[property="article:tag"]');
    if (categoryMeta) {
      const cats = categoryMeta.content.split(',').map(c => c.trim());
      currentCategories.push(...cats);
    }

    // Try to get from page data attributes
    const pageData = document.querySelector('[data-categories]');
    if (pageData) {
      const cats = pageData.getAttribute('data-categories').split(',').map(c => c.trim());
      currentCategories.push(...cats);
    }

    // Get all notes from search.json or listings
    fetch('/search.json')
      .then(response => response.json())
      .then(data => {
        // Extract unique note pages
        const notePages = new Map();
        data.forEach(item => {
          if (item.href && item.href.startsWith('/notes/') && 
              !item.href.endsWith('/notes/index.html') &&
              item.href.includes('.html') &&
              !item.section) { // Only main pages, not sections
            if (!notePages.has(item.href) || !notePages.get(item.href).title) {
              notePages.set(item.href, {
                href: item.href,
                title: item.title || 'Untitled',
                text: item.text || ''
              });
            }
          }
        });

        // Find related notes (simple: same title words or series)
        const currentTitle = document.querySelector('h1, .quarto-title h1')?.textContent || '';
        const currentText = document.body.innerText || '';
        const currentTitleWords = currentTitle.toLowerCase().split(/\s+/);

        const related = Array.from(notePages.values())
          .filter(note => {
            // Don't include current page
            if (note.href === path || note.href === path.replace('.html', '')) return false;

            // Check for shared words in title
            const noteTitleWords = note.title.toLowerCase().split(/\s+/);
            const sharedWords = currentTitleWords.filter(w => 
              w.length > 3 && noteTitleWords.includes(w)
            );

            // Check for series (e.g., "Part 1", "Part 2")
            const isSeries = /part\s+\d+/i.test(currentTitle) && /part\s+\d+/i.test(note.title);

            return sharedWords.length > 0 || isSeries || 
                   (currentText.includes('risk') && note.text.toLowerCase().includes('risk')) ||
                   (currentText.includes('climate') && note.text.toLowerCase().includes('climate'));
          })
          .slice(0, 5); // Limit to 5 related notes

        if (related.length > 0) {
          // Create related notes section
          const relatedSection = document.createElement('div');
          relatedSection.className = 'related-notes-section';
          relatedSection.innerHTML = `
            <h2 class="related-notes-heading">Related Notes</h2>
            <ul class="related-notes-list">
              ${related.map(note => `
                <li>
                  <a href="${note.href}">${note.title}</a>
                </li>
              `).join('')}
            </ul>
          `;

          // Insert before footer or at end of content
          const content = document.querySelector('#quarto-document-content, .content, main, article');
          if (content) {
            content.appendChild(relatedSection);
          }
        }
      })
      .catch(err => console.log('Could not load related notes:', err));
  }

  // Run after page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addRelatedNotes);
  } else {
    addRelatedNotes();
  }
});
