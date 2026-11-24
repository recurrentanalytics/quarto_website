// Manifesto / Anti-Manifesto switch on the home page (moved out of index.qmd).
document.addEventListener('DOMContentLoaded', function() {
  const body = document.getElementById('manifesto-body');
  const title = document.getElementById('manifesto-title');
  const switchBtn = document.getElementById('manifesto-switch');
  const manifestoTemplate = document.getElementById('manifesto-text');
  const antiTemplate = document.getElementById('anti-manifesto-text');
  
  if (!body || !title || !switchBtn || !manifestoTemplate || !antiTemplate) {
    return;
  }
  
  let currentState = 'manifesto';
  
  function getTheme() {
    // Quarto marks the active theme on <body> (quarto-light / quarto-dark).
    if (document.body.classList.contains('quarto-dark')) return 'dark';
    if (document.body.classList.contains('quarto-light')) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  let lastTheme = getTheme();
  
  function setState(state) {
    currentState = state;
    if (state === 'manifesto') {
      body.innerHTML = manifestoTemplate.innerHTML;
      title.textContent = 'Manifesto';
      switchBtn.classList.remove('anti-active');
    } else {
      body.innerHTML = antiTemplate.innerHTML;
      title.textContent = 'Anti-Manifesto';
      switchBtn.classList.add('anti-active');
    }
  }
  
  function initFromTheme() {
    const theme = getTheme();
    setState(theme === 'dark' ? 'anti' : 'manifesto');
  }
  
  initFromTheme();
  
  switchBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    setState(currentState === 'manifesto' ? 'anti' : 'manifesto');
  });
  
  const observer = new MutationObserver(function() {
    const currentTheme = getTheme();
    if (currentTheme !== lastTheme) {
      lastTheme = currentTheme;
      initFromTheme();
    }
  });
  
  observer.observe(document.body, { 
    attributes: true, 
    attributeFilter: ['class'] 
  });
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
    const currentTheme = getTheme();
    if (currentTheme !== lastTheme) {
      lastTheme = currentTheme;
      initFromTheme();
    }
  });
});
