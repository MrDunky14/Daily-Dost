// Quick Tools Sidebar Module
const quickToolsModule = {
    isExpanded: false,

    init() {
        this.createQuickToolbar();
        this.setupKeyboardShortcuts();
    },

    createQuickToolbar() {
        // Remove existing if present
        const existing = document.getElementById('quick-tools-sidebar');
        if (existing) existing.remove();

        const toolbar = document.createElement('div');
        toolbar.id = 'quick-tools-sidebar';
        toolbar.className = 'fixed right-4 bottom-24 z-[100] flex flex-col gap-2';
        toolbar.innerHTML = `
      <div id="quick-tools-buttons" class="flex flex-col gap-2 p-2 bg-card/90 backdrop-blur-xl rounded-2xl border border-primary/30 shadow-lg transition-all duration-300">
        <button id="quick-pomodoro" class="quick-tool-btn p-3 bg-primary/20 hover:bg-primary/40 rounded-xl transition-all hover:scale-110 group relative" title="Quick Pomodoro (P)">
          <span class="text-xl">🍅</span>
          <span class="quick-tool-label">Pomodoro</span>
        </button>
        <button id="quick-add-habit" class="quick-tool-btn p-3 bg-tertiary/20 hover:bg-tertiary/40 rounded-xl transition-all hover:scale-110 group relative" title="Add Habit (H)">
          <span class="text-xl">➕</span>
          <span class="quick-tool-label">Add Habit</span>
        </button>
        <button id="quick-calculator" class="quick-tool-btn p-3 bg-secondary/20 hover:bg-secondary/40 rounded-xl transition-all hover:scale-110 group relative" title="Calculator (C)">
          <span class="text-xl">🧮</span>
          <span class="quick-tool-label">Calculator</span>
        </button>
        <button id="quick-search" class="quick-tool-btn p-3 bg-accent/20 hover:bg-accent/40 rounded-xl transition-all hover:scale-110 group relative" title="Quick Search (/)">
          <span class="text-xl">🔍</span>
          <span class="quick-tool-label">Search</span>
        </button>
      </div>
      <button id="quick-tools-toggle" class="p-3 bg-primary rounded-full shadow-neon hover:scale-110 transition-all self-center" title="Quick Tools">
        <span class="material-symbols-outlined text-white" id="quick-tools-icon">bolt</span>
      </button>
    `;

        // Add styles for labels
        const style = document.createElement('style');
        style.textContent = `
      .quick-tool-label {
        position: absolute;
        right: 100%;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s, transform 0.2s;
        margin-right: 8px;
      }
      .quick-tool-btn:hover .quick-tool-label {
        opacity: 1;
      }
      #quick-tools-buttons {
        transform-origin: bottom center;
        /* 1. Default state: Visible and clickable */
        visibility: visible;
        /* 2. When opening: visibility switches ON instantly (0s delay) */
        transition: all 0.3s, visibility 0s;
      }

      #quick-tools-buttons.collapsed {
        transform: scale(0.9);
        opacity: 0;
        /* 3. Collapsed state: strictly hidden (cannot be clicked) */
        visibility: hidden;
        /* 4. When closing: Wait 0.3s (your animation time) BEFORE switching to hidden */
        transition: all 0.3s, visibility 0s linear 0.3s; 
      }
    `;

        document.head.appendChild(style);
        document.body.appendChild(toolbar);
        this.setupListeners();

        // Start collapsed
        const buttons = document.getElementById('quick-tools-buttons');
        if (buttons) buttons.classList.add('collapsed');
    },

    setupListeners() {
        document.getElementById('quick-tools-toggle')?.addEventListener('click', () => this.toggleToolbar());
        document.getElementById('quick-pomodoro')?.addEventListener('click', () => this.startPomodoro());
        document.getElementById('quick-add-habit')?.addEventListener('click', () => this.showAddHabitModal());
        document.getElementById('quick-calculator')?.addEventListener('click', () => this.toggleCalculator());
        document.getElementById('quick-search')?.addEventListener('click', () => this.showSearchPalette());
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            // Ctrl/Cmd shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'p':
                        e.preventDefault();
                        this.startPomodoro();
                        break;
                    case 'h':
                        e.preventDefault();
                        this.showAddHabitModal();
                        break;
                }
            }

            // Slash for search
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.showSearchPalette();
            }
        });
    },

    toggleToolbar() {
        const buttons = document.getElementById('quick-tools-buttons');
        const icon = document.getElementById('quick-tools-icon');

        if (buttons) {
            this.isExpanded = !this.isExpanded;
            buttons.classList.toggle('collapsed', !this.isExpanded);
            if (icon) {
                icon.textContent = this.isExpanded ? 'close' : 'bolt';
            }
        }
    },

    startPomodoro() {
        // Switch to study view
        if (typeof switchViewWithAnimation === 'function') {
            switchViewWithAnimation('study-view');
        } else if (typeof window.switchView === 'function') {
            window.switchView('study-view');
        } else {
            // Fallback: manually show study view
            document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
            const studyView = document.getElementById('study-view');
            if (studyView) studyView.classList.remove('hidden');
        }

        // Scroll to pomodoro timer
        setTimeout(() => {
            const timer = document.getElementById('pomodoro-timer');
            if (timer) {
                timer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);

        // Collapse toolbar
        if (this.isExpanded) this.toggleToolbar();

        if (typeof showToast === 'function') {
            showToast('🍅 Pomodoro ready! Click Start', 'info');
        }
    },

    showAddHabitModal() {
        // Try to use existing app functionality
        const addHabitBtn = document.getElementById('add-habit-btn');
        if (addHabitBtn) {
            addHabitBtn.click();
        } else {
            // Fallback: create simple modal
            this.createQuickHabitModal();
        }

        // Collapse toolbar
        if (this.isExpanded) this.toggleToolbar();
    },

    createQuickHabitModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = `
      <div class="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-card rounded-3xl p-6 max-w-md w-full border border-glass-border shadow-2xl">
          <h2 class="text-xl font-bold text-text-default mb-4">➕ Quick Add Habit</h2>
          <div class="space-y-4">
            <input type="text" id="quick-habit-name" placeholder="Habit name (e.g., Read 30 mins)" 
                   class="w-full p-3 rounded-xl border border-glass-border bg-white/10 text-text-default placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none">
            <select id="quick-habit-category" 
                    class="w-full p-3 rounded-xl border border-glass-border bg-white/10 text-text-default focus:border-primary outline-none">
              <option value="study">📚 Study</option>
              <option value="reading">📖 Reading</option>
              <option value="health">💪 Health</option>
              <option value="mindfulness">🧘 Mindfulness</option>
              <option value="other">✨ Other</option>
            </select>
            <div class="flex gap-3">
              <button id="quick-habit-cancel" class="flex-1 py-3 px-4 rounded-xl border border-glass-border text-text-muted hover:bg-white/10 transition-all">Cancel</button>
              <button id="quick-habit-save" class="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-neon">Add Habit</button>
            </div>
          </div>
        </div>
      </div>
    `;
        modalContainer.classList.remove('hidden');

        // Focus input
        document.getElementById('quick-habit-name')?.focus();

        // Event listeners
        document.getElementById('quick-habit-cancel')?.addEventListener('click', () => {
            modalContainer.classList.add('hidden');
            modalContainer.innerHTML = '';
        });

        document.getElementById('quick-habit-save')?.addEventListener('click', () => {
            const name = document.getElementById('quick-habit-name')?.value.trim();
            const category = document.getElementById('quick-habit-category')?.value;

            if (name) {
                // Try to use app's addHabit function
                if (typeof window.addHabit === 'function') {
                    window.addHabit({ name, category });
                } else if (typeof window.habitsModule?.addHabit === 'function') {
                    window.habitsModule.addHabit({ name, category });
                }

                if (typeof showToast === 'function') {
                    showToast(`Added habit: ${name}`, 'success');
                }

                modalContainer.classList.add('hidden');
                modalContainer.innerHTML = '';
            }
        });

        // Close on overlay click
        modalContainer.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                modalContainer.classList.add('hidden');
                modalContainer.innerHTML = '';
            }
        });
    },

    toggleCalculator() {
        // Navigate to study view and scroll to calculator
        if (typeof switchViewWithAnimation === 'function') {
            switchViewWithAnimation('study-view');
        } else if (typeof window.switchView === 'function') {
            window.switchView('study-view');
        }

        setTimeout(() => {
            const calc = document.getElementById('calculator-section');
            if (calc) {
                calc.scrollIntoView({ behavior: 'smooth', block: 'center' });
                calc.classList.add('ring-2', 'ring-primary');
                setTimeout(() => calc.classList.remove('ring-2', 'ring-primary'), 2000);
            }
        }, 300);

        // Collapse toolbar
        if (this.isExpanded) this.toggleToolbar();
    },

    showSearchPalette() {
        const commands = [
            { key: 'D', label: '🏠 Dashboard', viewId: 'dashboard-view' },
            { key: 'S', label: '📚 Study Zone', viewId: 'study-view' },
            { key: 'A', label: '📊 Analytics', viewId: 'analytics-view' },
            { key: 'R', label: '🏆 Rewards', viewId: 'rewards-view' }
        ];

        // Create command palette
        const palette = document.createElement('div');
        palette.id = 'command-palette';
        palette.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 pt-[15vh]';
        palette.innerHTML = `
      <div class="bg-card rounded-2xl p-4 w-full max-w-md border border-glass-border shadow-2xl">
        <input type="text" id="command-search" placeholder="Search or jump to..." 
               class="w-full p-3 rounded-xl border border-glass-border bg-white/10 text-text-default placeholder-text-muted focus:border-primary outline-none mb-3">
        <div id="command-list" class="space-y-1">
          ${commands.map((cmd, i) => `
            <button class="command-item w-full text-left p-3 rounded-xl hover:bg-primary/20 text-text-default flex items-center justify-between transition-all ${i === 0 ? 'bg-primary/10' : ''}" data-view="${cmd.viewId}">
              <span>${cmd.label}</span>
              <kbd class="px-2 py-1 bg-white/10 rounded text-xs text-text-muted">${cmd.key}</kbd>
            </button>
          `).join('')}
        </div>
      </div>
    `;

        document.body.appendChild(palette);
        document.getElementById('command-search')?.focus();

        // Handle item clicks
        palette.querySelectorAll('.command-item').forEach(item => {
            item.addEventListener('click', () => {
                const viewId = item.dataset.view;
                if (typeof switchViewWithAnimation === 'function') {
                    switchViewWithAnimation(viewId);
                } else if (typeof window.switchView === 'function') {
                    window.switchView(viewId);
                }
                palette.remove();
            });
        });

        // Filter on search
        document.getElementById('command-search')?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            palette.querySelectorAll('.command-item').forEach(item => {
                const label = item.textContent.toLowerCase();
                item.style.display = label.includes(query) ? '' : 'none';
            });
        });

        // Close on escape or backdrop click
        palette.addEventListener('click', (e) => {
            if (e.target === palette) palette.remove();
        });

        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') {
                palette.remove();
                document.removeEventListener('keydown', handler);
            }
        });

        // Collapse toolbar
        if (this.isExpanded) this.toggleToolbar();
    }
};

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => quickToolsModule.init());
} else {
    quickToolsModule.init();
}

// Export for global access
window.quickToolsModule = quickToolsModule;
