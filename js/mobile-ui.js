// Mobile UI Enhancements
// Converts tables and cards to mobile-friendly format

// Initialize mobile UI when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileUI);
} else {
  initMobileUI();
}

function initMobileUI() {
  if (window.innerWidth <= 768) {
    console.log('📱 Mobile UI activated');
    
    // Add mobile class to body
    document.body.classList.add('mobile-view');
    
    // Initialize collapsible cards
    initCollapsibleCards();
    
    // Convert tables to mobile cards
    convertTablesToMobileCards();
    
    // Add touch gestures
    addTouchGestures();
  }
  
  // Re-check on window resize
  window.addEventListener('resize', debounce(handleResize, 250));
}

function handleResize() {
  if (window.innerWidth <= 768) {
    document.body.classList.add('mobile-view');
    initCollapsibleCards();
    convertTablesToMobileCards();
  } else {
    document.body.classList.remove('mobile-view');
  }
}

// ============================================
// COLLAPSIBLE CARDS
// ============================================

function initCollapsibleCards() {
  // Find all cards with class 'make-collapsible'
  const cards = document.querySelectorAll('.make-collapsible');
  
  cards.forEach(card => {
    if (card.classList.contains('collapsible-initialized')) return;
    
    const content = card.innerHTML;
    const title = card.dataset.title || 'عرض التفاصيل';
    
    card.innerHTML = `
      <div class="collapsible-header" onclick="toggleCollapse(this)">
        <span>${title}</span>
        <span class="collapse-icon">▼</span>
      </div>
      <div class="collapsible-content">
        <div class="collapsible-body">
          ${content}
        </div>
      </div>
    `;
    
    card.classList.add('collapsible-card', 'collapsible-initialized');
  });
}

// Define toggleCollapse as a regular function first
function toggleCollapse(header) {
  const content = header.nextElementSibling;
  const icon = header.querySelector('.collapse-icon');
  
  content.classList.toggle('active');
  icon.classList.toggle('active');
}

// Make it available globally for inline onclick handlers
window.toggleCollapse = toggleCollapse;

// ============================================
// TABLE TO MOBILE CARDS CONVERSION
// ============================================

function convertTablesToMobileCards() {
  const tables = document.querySelectorAll('table:not(.keep-table)');
  
  tables.forEach(table => {
    if (table.classList.contains('converted-to-mobile')) return;
    
    // Get headers
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    
    if (headers.length === 0) return; // Skip if no headers
    
    // Get rows
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    
    if (rows.length === 0) return;
    
    // Create mobile container
    const mobileContainer = document.createElement('div');
    mobileContainer.className = 'mobile-only mobile-table-container';
    
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('td'));
      
      const card = document.createElement('div');
      card.className = 'mobile-table-card';
      
      // Add collapse header for long rows
      if (cells.length > 5) {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'report-header';
        headerDiv.innerHTML = `
          <strong>${headers[0]}: ${cells[0].textContent.trim()}</strong>
          <span class="collapse-icon">▼</span>
        `;
        headerDiv.onclick = function() {
          const body = this.nextElementSibling;
          body.classList.toggle('show');
          this.querySelector('.collapse-icon').classList.toggle('active');
        };
        
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'report-body';
        
        cells.forEach((cell, index) => {
          if (index === 0) return; // Skip first cell (shown in header)
          
          const rowDiv = document.createElement('div');
          rowDiv.className = 'mobile-table-row';
          rowDiv.innerHTML = `
            <div class="mobile-table-label">${headers[index] || ''}</div>
            <div class="mobile-table-value">${cell.innerHTML}</div>
          `;
          bodyDiv.appendChild(rowDiv);
        });
        
        card.appendChild(headerDiv);
        card.appendChild(bodyDiv);
      } else {
        // Simple card for short rows
        cells.forEach((cell, index) => {
          const rowDiv = document.createElement('div');
          rowDiv.className = 'mobile-table-row';
          rowDiv.innerHTML = `
            <div class="mobile-table-label">${headers[index] || ''}</div>
            <div class="mobile-table-value">${cell.innerHTML}</div>
          `;
          card.appendChild(rowDiv);
        });
      }
      
      mobileContainer.appendChild(card);
    });
    
    // Insert mobile container after table
    table.parentNode.insertBefore(mobileContainer, table.nextSibling);
    
    // Hide table on mobile
    table.classList.add('desktop-only', 'converted-to-mobile');
  });
}

// ============================================
// TOUCH GESTURES
// ============================================

function addTouchGestures() {
  let startX, startY, startTime;
  
  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  });
  
  document.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const endTime = Date.now();
    
    const diffX = endX - startX;
    const diffY = endY - startY;
    const diffTime = endTime - startTime;
    
    // Swipe right to go back (if supported)
    if (Math.abs(diffX) > 100 && Math.abs(diffY) < 50 && diffTime < 300) {
      if (diffX > 0) {
        // Swipe right - could trigger back action
        console.log('Swipe right detected');
      } else {
        // Swipe left
        console.log('Swipe left detected');
      }
    }
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export for use in other modules
export { initMobileUI, convertTablesToMobileCards, toggleCollapse };

// Make convertTablesToMobileCards globally available
window.convertTablesToMobileCards = convertTablesToMobileCards;
