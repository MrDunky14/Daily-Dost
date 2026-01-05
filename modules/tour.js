/**
 * StudiOS Onboarding Tour Module
 * Interactive guided tour for new users
 * Fixed version with better positioning and mobile support
 */

(function () {
    'use strict';

    // Tour configuration
    const TOUR_STEPS = [
        {
            target: '#user-profile',
            title: 'Your Profile',
            content: 'Track your level and XP progress. Click your avatar to login/logout your account.',
            position: 'bottom',
            view: 'dashboard-view'
        },
        {
            target: '#mood-tracker',
            title: 'Daily Mood Check-in',
            content: 'Log how you\'re feeling each day. This helps track patterns between mood and productivity.',
            position: 'bottom',
            view: 'dashboard-view'
        },
        {
            target: '#sleep-hours',
            title: 'Sleep Tracker',
            content: 'Record your sleep hours to see how rest impacts your academic performance.',
            position: 'bottom',
            view: 'dashboard-view'
        },
        {
            target: '[data-card-id="protocols"]',
            title: 'Daily Protocols',
            content: 'Your habits live here! Complete them daily to earn XP and build streaks.',
            position: 'top',
            view: 'dashboard-view'
        },
        {
            target: '[data-card-id="credits"]',
            title: 'Expense Tracking',
            content: 'Keep track of your monthly spending with quick expense logging.',
            position: 'top',
            view: 'dashboard-view'
        },
        {
            target: '#tab-study',
            title: 'Study Hub',
            content: 'Access focus tools, Pomodoro timer, assignments, and more.',
            position: 'top',
            view: null
        },
        {
            target: '[data-card-id="study-pomodoro"]',
            title: 'Pomodoro Timer',
            content: 'Use focused work sessions with the 25-minute timer. Watch your plant grow as you focus!',
            position: 'top',
            view: 'study-view'
        },
        {
            target: '#tab-analytics',
            title: 'Smart Analytics',
            content: 'View correlations between your sleep, mood, habits, and grades.',
            position: 'top',
            view: null
        },
        {
            target: '#tab-rewards',
            title: 'Achievements & Rewards',
            content: 'Unlock achievements as you stay consistent. You can replay this tour here anytime!',
            position: 'top',
            view: null
        }
    ];

    let currentStep = 0;
    let tourActive = false;
    let overlay = null;
    let tooltip = null;
    let resizeHandler = null;

    /**
     * Start the tour
     */
    function startTour() {
        if (tourActive) return;

        tourActive = true;
        currentStep = 0;

        // Create overlay
        createOverlay();

        // Show first step
        showStep(currentStep);

        // Add keyboard listener
        document.addEventListener('keydown', handleKeydown);

        // Add resize listener to reposition on window resize
        resizeHandler = debounce(() => {
            if (tourActive) {
                const step = TOUR_STEPS[currentStep];
                const targetEl = document.querySelector(step?.target);
                if (targetEl) {
                    updateSpotlightPosition(targetEl);
                    updateTooltipPosition(targetEl, step.position);
                }
            }
        }, 100);
        window.addEventListener('resize', resizeHandler);

        // Save that user has seen the tour
        localStorage.setItem('studios_tour_completed', 'true');
    }

    /**
     * End the tour
     */
    function endTour() {
        if (!tourActive) return;

        tourActive = false;

        // Remove overlay
        if (overlay) {
            overlay.remove();
            overlay = null;
        }

        // Remove tooltip
        if (tooltip) {
            tooltip.remove();
            tooltip = null;
        }

        // Remove highlights
        document.querySelectorAll('.tour-highlight').forEach(el => {
            el.classList.remove('tour-highlight');
        });

        // Remove event listeners
        document.removeEventListener('keydown', handleKeydown);
        if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler);
            resizeHandler = null;
        }

        // Show completion toast
        if (window.showToast) {
            window.showToast('Tour complete! You can replay it anytime from the Awards tab.', 'success');
        }
    }

    /**
     * Simple debounce utility
     */
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

    /**
     * Create the tour overlay (simple dark backdrop)
     */
    function createOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'tour-overlay';
        overlay.className = 'fixed inset-0 z-[9995] bg-black/70 transition-opacity duration-300';
        overlay.style.pointerEvents = 'none';
        document.body.appendChild(overlay);
    }

    /**
     * Show a specific step
     */
    function showStep(index) {
        const step = TOUR_STEPS[index];
        if (!step) {
            endTour();
            return;
        }

        // Switch view if needed
        if (step.view && window.switchView) {
            window.switchView(step.view);
        }

        // Wait for view transition
        setTimeout(() => {
            const targetEl = document.querySelector(step.target);
            if (!targetEl) {
                console.warn(`Tour target not found: ${step.target}`);
                nextStep();
                return;
            }

            // Remove previous highlight
            document.querySelectorAll('.tour-highlight').forEach(el => {
                el.classList.remove('tour-highlight');
            });

            // Add highlight to target
            targetEl.classList.add('tour-highlight');

            // Scroll target into view first
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Wait for scroll to complete, then position elements
            setTimeout(() => {
                updateSpotlightPosition(targetEl);
                showTooltip(targetEl, step);
            }, 300);

        }, step.view ? 350 : 100);
    }

    /**
     * Update spotlight position (highlight effect is via CSS class)
     */
    function updateSpotlightPosition(element) {
        // The highlight is handled by CSS .tour-highlight class
        // This function is kept for potential future spotlight implementations
    }

    /**
     * Show tooltip for current step
     */
    function showTooltip(targetEl, step) {
        // Remove existing tooltip
        if (tooltip) {
            tooltip.remove();
        }

        tooltip = document.createElement('div');
        tooltip.id = 'tour-tooltip';
        tooltip.className = 'fixed z-[9999]';
        tooltip.style.pointerEvents = 'auto';

        tooltip.innerHTML = `
            <div class="tour-tooltip-content relative z-[10000] bg-slate-900 rounded-2xl p-4 sm:p-5 border border-primary/40 shadow-lg max-w-[88vw] sm:max-w-sm w-auto">
                <div class="flex justify-between items-start gap-3 mb-3">
                    <h3 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <span class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-white text-xs sm:text-sm flex items-center justify-center font-mono flex-shrink-0">
                            ${currentStep + 1}
                        </span>
                        <span class="leading-tight">${step.title}</span>
                    </h3>
                    <button id="tour-close" class="relative z-[10001] text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0" aria-label="Close tour">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-gray-300 mb-4 leading-relaxed">${step.content}</p>
                <div class="flex items-center justify-between gap-2">
                    <div class="flex gap-1 flex-wrap">
                        ${TOUR_STEPS.map((_, i) => `
                            <div class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all ${i === currentStep ? 'bg-primary w-3 sm:w-4' : 'bg-white/30'}"></div>
                        `).join('')}
                    </div>
                    <div class="flex gap-2 flex-shrink-0 relative z-[10001]">
                        ${currentStep > 0 ? `
                            <button id="tour-prev" class="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10">
                                Back
                            </button>
                        ` : ''}
                        <button id="tour-next" class="px-4 py-2 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primary/80 transition-all">
                            ${currentStep === TOUR_STEPS.length - 1 ? 'Done' : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(tooltip);

        // Position tooltip after adding to DOM
        requestAnimationFrame(() => {
            updateTooltipPosition(targetEl, step.position);
        });

        // Add event listeners with proper binding
        const closeBtn = tooltip.querySelector('#tour-close');
        const prevBtn = tooltip.querySelector('#tour-prev');
        const nextBtn = tooltip.querySelector('#tour-next');

        if (closeBtn) closeBtn.addEventListener('click', endTour);
        if (prevBtn) prevBtn.addEventListener('click', prevStep);
        if (nextBtn) nextBtn.addEventListener('click', nextStep);
    }

    /**
     * Update tooltip position relative to target
     */
    function updateTooltipPosition(targetEl, preferredPosition) {
        if (!tooltip) return;

        const targetRect = targetEl.getBoundingClientRect();
        const tooltipContent = tooltip.querySelector('.tour-tooltip-content');
        if (!tooltipContent) return;

        const padding = 12;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const isMobile = viewportWidth < 640;
        const bottomNavHeight = 100; // Account for floating bottom nav

        // On mobile, set explicit width constraint BEFORE measuring
        if (isMobile) {
            const mobileWidth = Math.min(viewportWidth - (padding * 2), 340);
            tooltipContent.style.maxWidth = `${mobileWidth}px`;
            tooltipContent.style.width = `${mobileWidth}px`;
        }

        // Force reflow to get accurate measurements after width constraint
        const tooltipRect = tooltipContent.getBoundingClientRect();

        let top, left;

        if (isMobile) {
            // MOBILE: Center horizontally, position below or above target
            const tooltipWidth = Math.min(tooltipRect.width, viewportWidth - (padding * 2));
            left = (viewportWidth - tooltipWidth) / 2;

            // Ensure left is never negative
            if (left < padding) left = padding;

            // Position below target if space allows, otherwise above
            const spaceBelow = viewportHeight - targetRect.bottom - bottomNavHeight;
            const spaceAbove = targetRect.top;

            if (spaceBelow >= tooltipRect.height + padding) {
                top = targetRect.bottom + padding;
            } else if (spaceAbove >= tooltipRect.height + padding) {
                top = targetRect.top - tooltipRect.height - padding;
            } else {
                // Not enough space above or below - position at top of viewport
                top = padding;
            }
        } else {
            // DESKTOP: Position relative to target based on preference
            const positions = {
                top: {
                    top: targetRect.top - tooltipRect.height - padding,
                    left: targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2)
                },
                bottom: {
                    top: targetRect.bottom + padding,
                    left: targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2)
                },
                left: {
                    top: targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2),
                    left: targetRect.left - tooltipRect.width - padding
                },
                right: {
                    top: targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2),
                    left: targetRect.right + padding
                }
            };

            let pos = positions[preferredPosition] || positions.bottom;
            top = pos.top;
            left = pos.left;

            // Check if preferred position works, try alternatives if not
            if (preferredPosition === 'top' && pos.top < padding) {
                pos = positions.bottom;
                top = pos.top;
                left = pos.left;
            } else if (preferredPosition === 'bottom' && pos.top + tooltipRect.height > viewportHeight - bottomNavHeight) {
                pos = positions.top;
                top = pos.top;
                left = pos.left;
            }

            // Clamp horizontal position
            if (left < padding) {
                left = padding;
            } else if (left + tooltipRect.width > viewportWidth - padding) {
                left = viewportWidth - tooltipRect.width - padding;
            }
        }

        // Final vertical clamping for both mobile and desktop
        if (top < padding) {
            top = padding;
        } else if (top + tooltipRect.height > viewportHeight - bottomNavHeight) {
            top = viewportHeight - tooltipRect.height - bottomNavHeight;
        }

        tooltip.style.top = `${Math.round(top)}px`;
        tooltip.style.left = `${Math.round(left)}px`;
    }

    /**
     * Go to next step
     */
    function nextStep() {
        currentStep++;
        if (currentStep >= TOUR_STEPS.length) {
            endTour();
        } else {
            showStep(currentStep);
        }
    }

    /**
     * Go to previous step
     */
    function prevStep() {
        if (currentStep > 0) {
            currentStep--;
            showStep(currentStep);
        }
    }

    /**
     * Handle keyboard events
     */
    function handleKeydown(e) {
        if (!tourActive) return;

        switch (e.key) {
            case 'Escape':
                endTour();
                break;
            case 'ArrowRight':
            case 'Enter':
                nextStep();
                break;
            case 'ArrowLeft':
                prevStep();
                break;
        }
    }

    /**
     * Check if user has completed the tour
     */
    function hasTourCompleted() {
        return localStorage.getItem('studios_tour_completed') === 'true';
    }

    // Expose functions globally
    window.StudiOSTour = {
        start: startTour,
        end: endTour,
        hasCompleted: hasTourCompleted
    };

    // Auto-setup when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Add click listener for tour button in rewards
        const tourBtn = document.getElementById('start-tour-btn');
        if (tourBtn) {
            tourBtn.addEventListener('click', startTour);
        }
    });

})();
