// Drag and Drop Module for Card Customization
const dragDropModule = {
  isDragging: false,
  dragSource: null,

  init() {
    this.makeCardsDraggable();
    this.setupCustomizeMode();
  },

  makeCardsDraggable() {
    const cards = document.querySelectorAll('[data-card-id]');

    cards.forEach((card, index) => {
      card.dataset.index = index;
      card.classList.add('draggable-card');

      // Add drag handle if not present
      if (!card.querySelector('.drag-handle')) {
        const handle = document.createElement('div');
        handle.className = 'drag-handle';
        handle.innerHTML = '⋮⋮';
        card.style.position = 'relative';
        card.appendChild(handle);
      }

      // Mouse drag events
      card.addEventListener('dragstart', (e) => this.handleDragStart(e, card));
      card.addEventListener('dragend', (e) => this.handleDragEnd(e, card));
      card.addEventListener('dragover', (e) => this.handleDragOver(e, card));
      card.addEventListener('drop', (e) => this.handleDrop(e, card));
      card.addEventListener('dragenter', (e) => this.handleDragEnter(e, card));
      card.addEventListener('dragleave', (e) => this.handleDragLeave(e, card));

      // Touch events for mobile
      card.addEventListener('touchstart', (e) => this.handleTouchStart(e, card), { passive: false });
      card.addEventListener('touchmove', (e) => this.handleTouchMove(e, card), { passive: false });
      card.addEventListener('touchend', (e) => this.handleTouchEnd(e, card));
    });
  },

  // Touch event handlers for mobile
  handleTouchStart(e, card) {
    if (!card.classList.contains('customizing')) return;

    const touch = e.touches[0];
    this.touchStartY = touch.clientY;
    this.touchStartX = touch.clientX;
    this.isDragging = true;
    this.dragSource = card;
    card.classList.add('dragging');
  },

  handleTouchMove(e, card) {
    if (!this.isDragging || !card.classList.contains('customizing')) return;
    e.preventDefault();

    const touch = e.touches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetCard = elementBelow?.closest('[data-card-id]');

    // Remove drag-over from all cards
    document.querySelectorAll('[data-card-id]').forEach(c => c.classList.remove('drag-over'));

    // Add drag-over to target
    if (targetCard && targetCard !== this.dragSource && targetCard.classList.contains('customizing')) {
      targetCard.classList.add('drag-over');
    }
  },

  handleTouchEnd(e, card) {
    if (!this.isDragging) return;

    const dragOverCard = document.querySelector('[data-card-id].drag-over');

    if (dragOverCard && this.dragSource && this.dragSource !== dragOverCard) {
      const container = dragOverCard.parentElement;
      const allCards = Array.from(container.querySelectorAll('[data-card-id]'));
      const sourceIndex = allCards.indexOf(this.dragSource);
      const targetIndex = allCards.indexOf(dragOverCard);

      if (sourceIndex < targetIndex) {
        dragOverCard.after(this.dragSource);
      } else {
        dragOverCard.before(this.dragSource);
      }

      this.updateIndices();
      this.saveCardLayout();

      if (typeof showToast === 'function') {
        showToast('Card position saved!', 'success');
      }
    }

    // Cleanup
    this.isDragging = false;
    this.dragSource?.classList.remove('dragging');
    document.querySelectorAll('[data-card-id]').forEach(c => c.classList.remove('drag-over'));
    this.dragSource = null;
  },


  handleDragStart(e, card) {
    if (!card.classList.contains('customizing')) return;
    this.isDragging = true;
    this.dragSource = card;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.cardId);
    card.classList.add('dragging');

    // Delay opacity change for better visual feedback
    requestAnimationFrame(() => {
      card.style.opacity = '0.5';
    });
  },

  handleDragEnd(e, card) {
    this.isDragging = false;
    card.classList.remove('dragging');
    card.style.opacity = '1';
    document.querySelectorAll('[data-card-id]').forEach(c => c.classList.remove('drag-over'));
  },

  handleDragOver(e, card) {
    if (!card.classList.contains('customizing')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  },

  handleDragEnter(e, card) {
    if (!card.classList.contains('customizing')) return;
    if (card !== this.dragSource) {
      card.classList.add('drag-over');
    }
  },

  handleDragLeave(e, card) {
    // Only remove if actually leaving the card (not entering child)
    if (!card.contains(e.relatedTarget)) {
      card.classList.remove('drag-over');
    }
  },

  handleDrop(e, card) {
    if (!card.classList.contains('customizing')) return;
    e.preventDefault();
    e.stopPropagation();

    if (this.dragSource && this.dragSource !== card) {
      const container = card.parentElement;
      const allCards = Array.from(container.querySelectorAll('[data-card-id]'));
      const sourceIndex = allCards.indexOf(this.dragSource);
      const targetIndex = allCards.indexOf(card);

      if (sourceIndex < targetIndex) {
        card.after(this.dragSource);
      } else {
        card.before(this.dragSource);
      }

      this.updateIndices();
      this.saveCardLayout();

      // Show feedback
      if (typeof showToast === 'function') {
        showToast('Card position saved!', 'success');
      }
    }

    card.classList.remove('drag-over');
  },

  updateIndices() {
    const cards = document.querySelectorAll('[data-card-id]');
    cards.forEach((card, index) => {
      card.dataset.index = index;
    });
  },

  setupCustomizeMode() {
    const btn = document.getElementById('customize-layout-btn');
    if (btn) {
      btn.addEventListener('click', () => this.toggleCustomizeMode());
    }
  },

  toggleCustomizeMode() {
    const cards = document.querySelectorAll('[data-card-id]');
    const isCustomizing = cards[0]?.classList.contains('customizing');

    cards.forEach(card => {
      if (isCustomizing) {
        card.classList.remove('customizing');
        card.draggable = false;
      } else {
        card.classList.add('customizing');
        card.draggable = true;
      }
    });

    this.showCustomizeBanner(!isCustomizing);

    // Update button state
    const btn = document.getElementById('customize-layout-btn');
    if (btn) {
      const icon = btn.querySelector('.material-symbols-outlined, .material-icons');
      const text = btn.querySelector('span:not(.material-symbols-outlined):not(.material-icons)');
      if (isCustomizing) {
        if (icon) icon.textContent = 'dashboard_customize';
        if (text) text.textContent = 'Customize';
      } else {
        if (icon) icon.textContent = 'check';
        if (text) text.textContent = 'Done';
      }
    }
  },

  showCustomizeBanner(show) {
    let banner = document.getElementById('customize-banner');

    if (show && !banner) {
      banner = document.createElement('div');
      banner.id = 'customize-banner';
      // Responsive banner: sticks to bottom on mobile, top on desktop
      banner.className = 'fixed left-1/2 -translate-x-1/2 z-40 bg-primary/95 text-white py-2 px-4 md:py-3 md:px-6 flex items-center gap-2 md:gap-4 rounded-full shadow-lg backdrop-blur-sm border border-primary/50';
      banner.style.cssText = 'bottom: 100px; max-width: calc(100% - 32px);';
      banner.innerHTML = `
        <span class="material-symbols-outlined animate-pulse text-sm md:text-base">info</span>
        <span class="text-xs md:text-sm font-medium whitespace-nowrap">Drag to rearrange</span>
        <button id="customize-done" class="px-3 py-1 md:px-4 md:py-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-all text-xs md:text-sm font-bold">Done</button>
      `;
      document.body.appendChild(banner);

      // Add animation
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%, -20px)';
      requestAnimationFrame(() => {
        banner.style.transition = 'all 0.3s ease-out';
        banner.style.opacity = '1';
        banner.style.transform = 'translate(-50%, 0)';
      });

      document.getElementById('customize-done')?.addEventListener('click', () => this.toggleCustomizeMode());
    } else if (!show && banner) {
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%, -20px)';
      setTimeout(() => banner.remove(), 300);
    }
  },

  saveCardLayout() {
    const cards = document.querySelectorAll('[data-card-id]');
    const order = Array.from(cards).map(card => card.dataset.cardId);
    localStorage.setItem('studios_cardLayout', JSON.stringify(order));

    // Sync with Firebase if available
    if (typeof window.syncToFirebase === 'function') {
      window.syncToFirebase('cardLayout', order);
    }
  },

  loadCardLayout() {
    const saved = localStorage.getItem('studios_cardLayout');
    if (saved) {
      try {
        const order = JSON.parse(saved);
        const container = document.querySelector('.desktop-grid');
        if (container) {
          order.forEach(cardId => {
            const card = document.querySelector(`[data-card-id="${cardId}"]`);
            if (card) container.appendChild(card);
          });
          this.updateIndices();
        }
      } catch (e) {
        console.warn('Failed to load card layout:', e);
      }
    }
  }
};

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => dragDropModule.init());
} else {
  dragDropModule.init();
}

// Export for global access
window.dragDropModule = dragDropModule;
