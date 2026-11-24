// Collapsible code blocks (moved out of _quarto.yml).
(function() {
  // Function to wrap code blocks in collapsible structure
  // ONLY wrap input code blocks, NOT outputs
  function makeCodeBlocksCollapsible() {
    try {
    // Find only INPUT code blocks - exclude outputs
    // Target pre.sourceCode (standalone code blocks) and .cell-code (input code in cells)
    // Exclude ones already wrapped and exclude any inside .cell-output
    const codeBlocks = document.querySelectorAll('pre.sourceCode:not(.code-block-wrapper pre.sourceCode):not(.cell-output pre), .cell-code:not(.code-block-wrapper .cell-code):not(.cell-output .cell-code)');

    if (codeBlocks.length === 0) return;

    codeBlocks.forEach(function(block) {
      // Skip if already wrapped
      if (block.closest('.code-block-wrapper')) {
        return;
      }

      // Skip if inside output container
      if (block.closest('.cell-output, .cell-output-stdout, .cell-output-stderr, .cell-output-display')) {
        return;
      }

      // Skip hidden source (echo: false). Quarto's OJS runtime reads the cells' code from
      // these hidden blocks; wrapping them breaks every interactive chart.
      if (block.classList.contains('hidden') || block.closest('.hidden')) {
        return;
      }

      // Skip inline code
      if (block.tagName === 'CODE' && block.parentElement && block.parentElement.tagName !== 'PRE') {
        return;
      }

      // Get language from class or parent
      let language = 'code';
      const classList = block.className || '';
      if (classList.includes('sourceCode')) {
        const match = classList.match(/sourceCode-(\w+)/);
        if (match) language = match[1];
      } else if (block.querySelector('code')) {
        const codeEl = block.querySelector('code');
        if (codeEl && codeEl.className) {
          const match = codeEl.className.match(/language-(\w+)|sourceCode-(\w+)/);
          if (match) language = match[1] || match[2];
        }
      }

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      // Create header
      const header = document.createElement('div');
      header.className = 'code-block-header';
      header.innerHTML = `
        <span class="code-block-title">
          <span class="code-block-toggle">▼</span>
          <span>${language}</span>
        </span>
      `;

      // Create content container
      const content = document.createElement('div');
      content.className = 'code-block-content';

      // Store parent and next sibling BEFORE moving block
      const parent = block.parentNode;
      const nextSibling = block.nextSibling;

      // Move the block into content (don't clone, move it)
      // This removes block from parent, so we need parent/nextSibling before this
      content.appendChild(block);

      // Assemble
      wrapper.appendChild(header);
      wrapper.appendChild(content);

      // Insert wrapper where block was
      // Note: block is now inside content, so we insert wrapper at block's old position
      if (parent) {
        // If there's a next sibling, insert before it (block was before nextSibling)
        // Otherwise append to end
        if (nextSibling && nextSibling.parentNode === parent) {
          parent.insertBefore(wrapper, nextSibling);
        } else {
          // If nextSibling is null or invalid, append to parent
          parent.appendChild(wrapper);
        }
      }

      // Add click handler
      header.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        wrapper.classList.toggle('expanded');
      });
    });
    } catch (error) {
      console.error('Error in makeCodeBlocksCollapsible:', error);
      // Don't break the page if code block wrapping fails
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', makeCodeBlocksCollapsible);
  } else {
    // DOM already loaded
    makeCodeBlocksCollapsible();
  }

  // Also run after delays to catch dynamically loaded content
  setTimeout(makeCodeBlocksCollapsible, 100);
  setTimeout(makeCodeBlocksCollapsible, 500);
  setTimeout(makeCodeBlocksCollapsible, 1000);

  // Use MutationObserver to catch dynamically added code blocks
  const observer = new MutationObserver(function(mutations) {
    let shouldRun = false;
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            // Only trigger if it's an input code block, not an output
            if (node.matches && (
              (node.matches('pre.sourceCode') && !node.closest('.cell-output')) ||
              (node.matches('.cell-code') && !node.closest('.cell-output')) ||
              (node.querySelector && node.querySelector('pre.sourceCode:not(.cell-output pre), .cell-code:not(.cell-output .cell-code)'))
            )) {
              shouldRun = true;
            }
          }
        });
      }
    });
    if (shouldRun) {
      setTimeout(makeCodeBlocksCollapsible, 100);
    }
  });

  // Start observing
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
})();
