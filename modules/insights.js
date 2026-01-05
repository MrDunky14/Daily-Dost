// Sleep-Mood Correlation Insights Module
const insightsModule = {

    // Get sleep logs from localStorage or app state
    getSleepLogs() {
        if (window.getStudiosData) {
            return window.getStudiosData().sleepLogs || {};
        }
        try {
            const saved = localStorage.getItem('studios_sleepLogs');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    },

    // Get mood data from localStorage or app state
    getMoodData() {
        if (window.getStudiosData) {
            return window.getStudiosData().moodData || {};
        }
        try {
            const saved = localStorage.getItem('studios_moodLogs');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    },

    analyzeSleepMoodCorrelation() {
        const sleepLogs = this.getSleepLogs();
        const moodData = this.getMoodData();

        // Need at least 7 days of overlapping data
        const commonDates = Object.keys(sleepLogs).filter(date => moodData[date] !== undefined);

        if (commonDates.length < 7) {
            return {
                message: `Need ${7 - commonDates.length} more days of data for insights`,
                correlation: 0,
                dataPoints: commonDates.length,
                ready: false
            };
        }

        const sleepValues = commonDates.map(date => sleepLogs[date]);
        const moodValues = commonDates.map(date => this.moodToNumber(moodData[date]));

        const correlation = this.calculatePearsonCorrelation(sleepValues, moodValues);
        const optimalSleep = this.findOptimalSleepHours(sleepLogs, moodData);
        const avgSleep = sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length;

        return {
            correlation: correlation,
            correlationPercent: Math.abs(correlation * 100).toFixed(0),
            direction: correlation > 0 ? 'positive' : 'negative',
            message: this.generateMessage(correlation, optimalSleep, avgSleep),
            recommendation: this.generateRecommendation(optimalSleep, correlation, avgSleep),
            optimalSleep: optimalSleep,
            averageSleep: avgSleep.toFixed(1),
            dataPoints: commonDates.length,
            ready: true
        };
    },

    moodToNumber(mood) {
        const moodMap = {
            'sad': 1,
            'stressed': 2,
            'neutral': 3,
            'happy': 4,
            'excited': 5
        };
        return moodMap[mood] || 3;
    },

    calculatePearsonCorrelation(x, y) {
        if (x.length !== y.length || x.length < 2) return 0;

        const n = x.length;
        const meanX = x.reduce((a, b) => a + b, 0) / n;
        const meanY = y.reduce((a, b) => a + b, 0) / n;

        let numerator = 0, denomX = 0, denomY = 0;

        for (let i = 0; i < n; i++) {
            const diffX = x[i] - meanX;
            const diffY = y[i] - meanY;
            numerator += diffX * diffY;
            denomX += diffX * diffX;
            denomY += diffY * diffY;
        }

        const denominator = Math.sqrt(denomX * denomY);
        if (denominator === 0) return 0;

        return numerator / denominator;
    },

    findOptimalSleepHours(sleepLogs, moodData) {
        const grouped = {};

        Object.entries(sleepLogs).forEach(([date, hours]) => {
            const mood = moodData[date];
            if (mood === undefined) return;

            const moodNum = this.moodToNumber(mood);
            const key = Math.round(hours);

            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(moodNum);
        });

        let optimal = 7;
        let maxMood = 0;

        Object.entries(grouped).forEach(([hours, moods]) => {
            if (moods.length < 2) return; // Need at least 2 data points
            const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;
            if (avgMood > maxMood) {
                maxMood = avgMood;
                optimal = parseInt(hours);
            }
        });

        return optimal;
    },

    generateMessage(correlation, optimalSleep, avgSleep) {
        const strength = Math.abs(correlation);
        const direction = correlation > 0 ? 'better' : 'worse';

        if (strength < 0.2) {
            return `Your mood seems mostly independent of sleep duration. Keep tracking for more insights!`;
        } else if (strength < 0.5) {
            return `There's a moderate link between your sleep and mood. You tend to feel ${direction} with ${optimalSleep}+ hours.`;
        } else {
            return `Strong correlation detected! Your mood is ${Math.round(strength * 100)}% ${direction} when you sleep around ${optimalSleep} hours.`;
        }
    },

    generateRecommendation(optimalSleep, correlation, avgSleep) {
        const recommendations = [];

        if (Math.abs(correlation) < 0.2) {
            recommendations.push('📊 Keep logging sleep and mood to uncover patterns');
        }

        if (optimalSleep < 6) {
            recommendations.push('⚠️ Your optimal sleep seems low. Try gradually adding 15 min per night');
        } else if (optimalSleep > 9) {
            recommendations.push('💡 You may benefit from 7-8 hours instead of oversleeping');
        } else {
            recommendations.push(`✨ Your sweet spot is ${optimalSleep} hours. Try to stay consistent!`);
        }

        if (avgSleep < optimalSleep - 1) {
            recommendations.push(`😴 You're averaging ${avgSleep.toFixed(1)}h but feel best at ${optimalSleep}h. Consider earlier bedtimes.`);
        }

        return recommendations.join('\n');
    },

    // Get weekly sleep trend
    getWeeklyTrend() {
        const sleepLogs = this.getSleepLogs();
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const weekData = [];
        for (let d = new Date(weekAgo); d <= now; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            weekData.push({
                date: dateStr,
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                hours: sleepLogs[dateStr] || null
            });
        }

        return weekData;
    },

    // Render insights widget
    renderInsightsWidget(containerId = 'insights-widget-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const insights = this.analyzeSleepMoodCorrelation();
        const weeklyTrend = this.getWeeklyTrend();

        // Create mini sleep trend visualization
        const trendBars = weeklyTrend.map(d => {
            const height = d.hours ? Math.min((d.hours / 10) * 100, 100) : 0;
            const color = d.hours
                ? (d.hours >= 7 ? 'bg-tertiary' : d.hours >= 5 ? 'bg-accent' : 'bg-danger')
                : 'bg-white/20';
            return `
                <div class="flex flex-col items-center gap-1">
                    <div class="w-4 h-16 bg-white/10 rounded-full relative overflow-hidden">
                        <div class="${color} absolute bottom-0 w-full rounded-full transition-all" style="height: ${height}%"></div>
                    </div>
                    <span class="text-[10px] text-text-muted">${d.day}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="space-y-4">
                <!-- Weekly Sleep Trend -->
                <div class="flex justify-between items-end gap-1 px-2">
                    ${trendBars}
                </div>
                
                ${insights.ready ? `
                    <!-- Correlation Stats -->
                    <div class="grid grid-cols-2 gap-3 mt-3">
                        <div class="bg-white/5 rounded-xl p-3 border border-glass-border">
                            <div class="text-xs text-text-muted mb-1">Correlation</div>
                            <div class="text-xl font-bold ${insights.correlation > 0 ? 'text-tertiary' : 'text-danger'}">
                                ${insights.correlationPercent}%
                                <span class="text-xs font-normal text-text-muted">${insights.direction}</span>
                            </div>
                        </div>
                        <div class="bg-white/5 rounded-xl p-3 border border-glass-border">
                            <div class="text-xs text-text-muted mb-1">Optimal Sleep</div>
                            <div class="text-xl font-bold text-primary">
                                ${insights.optimalSleep}h
                                <span class="text-xs font-normal text-text-muted">avg: ${insights.averageSleep}h</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Insight Message -->
                    <div class="bg-primary/10 rounded-xl p-3 border border-primary/30">
                        <p class="text-sm text-text-default">${insights.message}</p>
                    </div>
                    
                    <!-- Recommendation -->
                    <div class="text-xs text-secondary whitespace-pre-line leading-relaxed">
                        ${insights.recommendation}
                    </div>
                ` : `
                    <!-- Not Ready State -->
                    <div class="text-center py-4 bg-white/5 rounded-xl border border-glass-border">
                        <div class="flex items-center justify-center gap-2 mb-2">
                            <span class="material-symbols-outlined text-2xl text-secondary animate-pulse">hourglass_empty</span>
                            <span class="text-3xl font-bold text-text-default">${insights.dataPoints}/7</span>
                        </div>
                        <p class="text-sm text-text-muted">${insights.message}</p>
                        <p class="text-xs text-secondary mt-2">Log your sleep and mood daily to unlock insights!</p>
                    </div>
                `}
            </div>
        `;
    },

    // Initialize and auto-render
    init() {
        this.renderInsightsWidget();

        // Setup refresh button
        const refreshBtn = document.getElementById('refresh-insights-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.querySelector('.material-symbols-outlined').classList.add('animate-spin');
                setTimeout(() => {
                    this.renderInsightsWidget();
                    refreshBtn.querySelector('.material-symbols-outlined').classList.remove('animate-spin');
                }, 500);
            });
        }
    }
};

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => insightsModule.init());
} else {
    insightsModule.init();
}

// Export for global access
window.insightsModule = insightsModule;
