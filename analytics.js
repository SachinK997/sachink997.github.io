// 1. Auth Guard: Immediate check before any processing
if (sessionStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'signup.html';
}

// 2. Global Logout Handler
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.clear();
            window.location.href = 'login.html';
        });
    }

    // 3. Personalized Sidebar Update
    const userName = sessionStorage.getItem('userName');
    if (userName) {
        const nameElement = document.querySelector('.user-info h3');
        if (nameElement) nameElement.innerText = userName;

        const planElement = document.querySelector('.user-info p');
        if (planElement) planElement.innerText = "Pro Member";
    }

    // 4. Chart JS Visual Defaults
    Chart.defaults.color = '#9CA3AF';
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

    const typeColorMap = {
        cardio: '#ef4444',
        strength: '#3b82f6',
        yoga: '#a855f7',
        rest: '#10b981',
        nutrition: '#f59e0b'
    };

    function escapeHTML(str) {
        if (!str) return "";
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    async function loadAnalyticsData() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data, error } = await supabaseClient
            .from('activities')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            console.error("Analytics fetch error:", error);
            return;
        }

        processData(data);
    }

    function processData(activities) {
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        let totalActs = 0;
        let totalMinutes = 0;
        let nutritionPts = 0;

        let curMonthActs = 0;
        let curMonthMins = 0;
        let curMonthNutri = 0;

        let prevMonthActs = 0;
        let prevMonthMins = 0;
        let prevMonthNutri = 0;

        const dynamicCategoryCounts = {};
        const dynamicColors = {};
        const dailyActivityCount = {}; // For last 30 days chart

        // Initialize last 30 days with 0s
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            dailyActivityCount[key] = 0;
        }

        activities.forEach(act => {
            const actDate = new Date(act.date_key);
            totalActs++;

            // Duration calculation
            let mins = 0;
            if (act.duration) {
                const hrMatch = act.duration.match(/(\d+)\s*Hr/);
                const minMatch = act.duration.match(/(\d+)\s*Min/);
                if (hrMatch) mins += parseInt(hrMatch[1]) * 60;
                if (minMatch) mins += parseInt(minMatch[1]);
                if (!hrMatch && !minMatch) mins = parseInt(act.duration.replace(/\D/g, '')) || 0;
            }
            totalMinutes += mins;

            if (act.type === 'nutrition') nutritionPts += 10;

            // Monthly breakdown
            if (actDate >= startOfCurrentMonth) {
                curMonthActs++;
                curMonthMins += mins;
                if (act.type === 'nutrition') curMonthNutri += 10;
            } else if (actDate >= startOfPrevMonth && actDate <= endOfPrevMonth) {
                prevMonthActs++;
                prevMonthMins += mins;
                if (act.type === 'nutrition') prevMonthNutri += 10;
            }

            // Consistency chart (last 30 days)
            const dateKey = act.date_key;
            if (dailyActivityCount[dateKey] !== undefined && act.type !== 'rest') {
                dailyActivityCount[dateKey]++;
            }

            // Category breakdown
            let labelKey = act.type !== 'custom' ? act.type.charAt(0).toUpperCase() + act.type.slice(1) : act.name;
            let colorKey = act.type !== 'custom' ? typeColorMap[act.type] : (act.custom_color || '#6366f1');
            dynamicCategoryCounts[labelKey] = (dynamicCategoryCounts[labelKey] || 0) + 1;
            dynamicColors[labelKey] = colorKey;
        });

        // Update Stats UI
        updateStatUI('statTotalActs', 'compareActs', totalActs, curMonthActs, prevMonthActs);
        updateStatUI('statTotalTime', 'compareTime', `${Math.floor(totalMinutes / 60)}h`, curMonthMins, prevMonthMins, true);
        updateStatUI('statNutrition', 'compareNutrition', nutritionPts, curMonthNutri, prevMonthNutri);

        // Render Charts
        renderConsistencyChart(dailyActivityCount);
        renderCategoryChart(dynamicCategoryCounts, dynamicColors);

        // Monthly Goal
        renderMonthlyGoal(curMonthActs);

        // Badges
        renderBadges(activities);

        // Recent Logs
        renderLogs(activities);
    }

    function updateStatUI(id, compareId, total, cur, prev, isTime = false) {
        document.getElementById(id).innerText = total;
        const compareEl = document.getElementById(compareId);
        
        if (prev === 0) {
            compareEl.innerText = "";
            return;
        }

        const pct = Math.round(((cur - prev) / prev) * 100);
        const isUp = pct >= 0;
        compareEl.style.color = isUp ? '#10b981' : '#ef4444';
        compareEl.innerText = `${isUp ? '↑' : '↓'} ${Math.abs(pct)}%`;
    }

    function renderConsistencyChart(dataMap) {
        const ctx = document.getElementById('consistencyChart').getContext('2d');
        const labels = Object.keys(dataMap).map(d => d.split('-').slice(1).join('/'));
        const values = Object.values(dataMap);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Workouts',
                    data: values,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    function renderMonthlyGoal(current) {
        const target = 20;
        let pct = Math.round((current / target) * 100);
        if (pct > 100) pct = 100;

        document.getElementById('goalProgressCircle').style.strokeDasharray = `${pct}, 100`;
        document.getElementById('goalPercentText').innerText = `${pct}%`;
        document.getElementById('goalTargetText').innerText = `${current} / ${target} Workouts`;
    }

    function renderBadges(activities) {
        const container = document.getElementById('badgeContainer');
        container.innerHTML = "";

        const cardioCount = activities.filter(a => a.type === 'cardio').length;
        const intensityCount = activities.filter(a => a.intensity >= 8).length;
        
        // Find if user worked out Sat and Sun in same week
        let weekendWarrior = false;
        const dates = activities.map(a => a.date_key);
        // Simplified check: just check if there's ever a Sat and Sun workout logged
        const hasSat = activities.some(a => new Date(a.date_key).getDay() === 6);
        const hasSun = activities.some(a => new Date(a.date_key).getDay() === 0);
        if (hasSat && hasSun) weekendWarrior = true;

        const badges = [
            { id: 'iron', label: 'Iron Heart', desc: '10 Cardio Sessions', earned: cardioCount >= 10, icon: '❤️' },
            { id: 'beast', label: 'Beast Mode', desc: 'Intensity Level 8+', earned: intensityCount >= 5, icon: '🔥' },
            { id: 'weekend', label: 'Weekend Warrior', desc: 'Sat & Sun Workouts', earned: weekendWarrior, icon: '⚔️' },
            { id: 'pro', label: 'Consistent Pro', desc: '20+ Lifetime Acts', earned: activities.length >= 20, icon: '🏆' }
        ];

        badges.forEach(b => {
            const badgeEl = document.createElement('div');
            badgeEl.style.cssText = `
                background: var(--bg-surface);
                padding: 1.25rem;
                border-radius: 16px;
                border: 1px solid ${b.earned ? 'var(--accent-primary)' : 'var(--border-color)'};
                opacity: ${b.earned ? '1' : '0.4'};
                filter: ${b.earned ? 'none' : 'grayscale(1)'};
                text-align: center;
                width: 130px;
                transition: transform 0.3s;
                cursor: default;
            `;
            if (b.earned) {
                badgeEl.onmouseover = () => badgeEl.style.transform = 'translateY(-5px)';
                badgeEl.onmouseout = () => badgeEl.style.transform = 'translateY(0)';
            }

            badgeEl.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">${b.icon}</div>
                <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-dark); margin-bottom: 0.25rem;">${b.label}</div>
                <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600;">${b.desc}</div>
            `;
            container.appendChild(badgeEl);
        });
    }

    function renderCategoryChart(counts, colors) {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        const chartLabels = Object.keys(counts);

        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy();

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartLabels.map(l => counts[l]),
                    backgroundColor: chartLabels.map(l => colors[l]),
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#E0E0E0', padding: 20, font: { size: 13 } }
                    }
                },
                cutout: '75%'
            }
        });
    }

    function renderLogs(activities) {
        const logsContainer = document.getElementById('recentLogsContainer');
        if (activities.length === 0) {
            logsContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No activities logged yet.</p>`;
            return;
        }
        
        const sorted = [...activities].sort((a, b) => new Date(b.date_key) - new Date(a.date_key));
        logsContainer.innerHTML = sorted.slice(0, 8).map(act => `
            <div style="display: flex; gap: 1rem; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
                <div style="font-size: 1.5rem; background: rgba(255,255,255,0.05); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">${act.emoji}</div>
                <div style="flex: 1;">
                    <h4 style="font-size: 0.9rem; margin-bottom: 0.1rem; color: var(--text-dark);">${escapeHTML(act.name)}</h4>
                    <p style="font-size: 0.75rem; color: var(--text-muted);">${act.date_key} • ${escapeHTML(act.duration) || 'N/A'}${act.intensity ? ' • Intensity ' + act.intensity : ''}</p>
                </div>
            </div>
        `).join('');
    }

    loadAnalyticsData();
});
