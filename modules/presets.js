// Preset Layout Configurations
const presetsModule = {
    layouts: {
        student: {
            name: '📚 Student Mode',
            description: 'Focused on studies and tracking',
            order: ['protocols', 'sync-status', 'recharge', 'credits', 'quotes'],
            icon: '📚',
            accent: 'primary'
        },
        focus: {
            name: '🎯 Focus Mode',
            description: 'Minimal distractions, maximum focus',
            order: ['system-status', 'protocols', 'quotes'],
            icon: '🎯',
            accent: 'secondary'
        },
        wellness: {
            name: '🧘 Wellness Mode',
            description: 'Mental health and wellbeing',
            order: ['system-status', 'recharge', 'protocols', 'quotes'],
            icon: '🧘',
            accent: 'accent'
        },
        productivity: {
            name: '⚡ Productivity Mode',
            description: 'Complete productivity suite',
            order: ['protocols', 'sync-status', 'system-status', 'credits', 'recharge', 'quotes'],
            icon: '⚡',
            accent: 'tertiary'
        }
    },

    currentPreset: null,

    init() {
        this.loadCurrentPreset();
    },

    loadCurrentPreset() {
        const saved = localStorage.getItem('studios_currentPreset');
        if (saved && this.layouts[saved]) {
            this.currentPreset = saved;
        }
    },

    applyPreset(presetName) {
        const preset = this.layouts[presetName];
        if (!preset) {
            console.warn('Preset not found:', presetName);
            return false;
        }

        this.currentPreset = presetName;
        localStorage.setItem('studios_currentPreset', presetName);
        localStorage.setItem('studios_cardLayout', JSON.stringify(preset.order));

        this.reorderCards(preset.order);

        if (typeof showToast === 'function') {
            showToast(`Applied ${preset.name}`, 'success');
        }

        return true;
    },

    reorderCards(order) {
        const container = document.querySelector('#dashboard-view .desktop-grid');
        if (!container) return;

        // Get all cards
        const cards = container.querySelectorAll('[data-card-id]');
        const cardMap = {};
        cards.forEach(card => {
            cardMap[card.dataset.cardId] = card;
        });

        // Reorder based on preset
        order.forEach(cardId => {
            const card = cardMap[cardId];
            if (card) {
                container.appendChild(card);
            }
        });

        // Append remaining cards not in preset
        cards.forEach(card => {
            if (!order.includes(card.dataset.cardId)) {
                container.appendChild(card);
            }
        });

        // Update drag-drop indices if available
        if (window.dragDropModule?.updateIndices) {
            window.dragDropModule.updateIndices();
        }
    },

    getCurrentPreset() {
        return this.currentPreset ? this.layouts[this.currentPreset] : null;
    },

    getPresetList() {
        return Object.entries(this.layouts).map(([key, layout]) => ({
            id: key,
            ...layout,
            isActive: this.currentPreset === key
        }));
    },

    // Create preset selector UI
    createPresetSelector(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
      <div class="preset-selector">
        <h3 class="text-sm font-bold text-text-default mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">dashboard_customize</span>
          Quick Layouts
        </h3>
        <div class="grid grid-cols-2 gap-2">
          ${Object.entries(this.layouts).map(([key, layout]) => `
            <button class="preset-btn p-3 rounded-xl border transition-all text-left hover:scale-[1.02] ${this.currentPreset === key ?
                'bg-' + layout.accent + '/20 border-' + layout.accent + '/50 shadow-neon' :
                'bg-white/5 border-glass-border hover:border-primary/50'}" 
              data-preset="${key}">
              <div class="text-lg mb-1">${layout.icon}</div>
              <div class="text-xs font-bold text-text-default">${layout.name.replace(/^.+\s/, '')}</div>
              <div class="text-[10px] text-text-muted">${layout.description}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `;

        // Add event listeners
        container.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                this.applyPreset(preset);
                this.createPresetSelector(containerId); // Re-render to update active state
            });
        });
    },

    // Show preset selector modal
    showPresetModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = `
      <div class="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-card rounded-3xl p-6 max-w-lg w-full border border-glass-border shadow-2xl">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-text-default">🎨 Choose Layout</h2>
            <button id="close-preset-modal" class="p-2 rounded-full hover:bg-white/10 transition-all">
              <span class="material-symbols-outlined text-text-muted">close</span>
            </button>
          </div>
          <div class="grid grid-cols-2 gap-4">
            ${Object.entries(this.layouts).map(([key, layout]) => `
              <button class="preset-card p-4 rounded-2xl border transition-all text-left hover:scale-[1.02] group ${this.currentPreset === key ?
                'bg-primary/20 border-primary/50 shadow-neon ring-2 ring-primary' :
                'bg-white/5 border-glass-border hover:border-primary/50 hover:bg-white/10'}" 
                data-preset="${key}">
                <div class="text-3xl mb-2 group-hover:scale-110 transition-transform">${layout.icon}</div>
                <div class="text-sm font-bold text-text-default mb-1">${layout.name.replace(/^.+\s/, '')}</div>
                <div class="text-xs text-text-muted">${layout.description}</div>
                ${this.currentPreset === key ? '<span class="text-xs text-primary font-bold mt-2 block">✓ Active</span>' : ''}
              </button>
            `).join('')}
          </div>
          <div class="mt-6 text-center">
            <p class="text-xs text-text-muted">Or customize manually using the Customize Layout button</p>
          </div>
        </div>
      </div>
    `;
        modalContainer.classList.remove('hidden');

        // Event listeners
        document.getElementById('close-preset-modal')?.addEventListener('click', () => {
            modalContainer.classList.add('hidden');
            modalContainer.innerHTML = '';
        });

        modalContainer.querySelectorAll('.preset-card').forEach(card => {
            card.addEventListener('click', () => {
                const preset = card.dataset.preset;
                this.applyPreset(preset);
                modalContainer.classList.add('hidden');
                modalContainer.innerHTML = '';
            });
        });

        // Close on overlay click
        modalContainer.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                modalContainer.classList.add('hidden');
                modalContainer.innerHTML = '';
            }
        });
    }
};

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => presetsModule.init());
} else {
    presetsModule.init();
}

// Export for global access
window.presetsModule = presetsModule;
