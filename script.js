// At the very top of script.js
// supabaseClient is initialized in supabase-config.js
// Auth Guard: Redirect to signup if not authenticated
if (sessionStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'signup.html';
}
document.getElementById('btnLogout').addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = 'login.html';
});
const _now = new Date();
let currentViewDate = new Date(_now.getFullYear(), _now.getMonth(), 1);
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let calendarData = {};

async function saveActivityToSupabase(activity) {
    const { data: { user } } = await supabaseClient.auth.getUser();

    const { data, error } = await supabaseClient
        .from('activities')
        .insert([{
            user_id: user.id,
            date_key: activity.dateKey,
            name: activity.name,
            type: activity.type,
            duration: activity.duration,
            emoji: activity.emoji
        }]);

    if (error) console.error('Error saving:', error);
}
const emojiMap = {
    'cardio': '🏃‍♀️',
    'strength': '💪',
    'yoga': '🧘‍♀️',
    'rest': '🌿',
    'nutrition': '🍏'
};

function escapeHTML(str) {
    if (!str) return "";
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function formatDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Generate Calendar Grid
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('currentMonthLabel');

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    monthLabel.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = getDaysInMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    // Adjust logic to make Monday = 0, Sunday = 6
    let startOffset = firstDay - 1;
    if (startOffset === -1) startOffset = 6;

    let daysHTML = '';
    const today = new Date(); // Real today

    for (let i = startOffset - 1; i >= 0; i--) {
        const prevNum = daysInPrevMonth - i;
        daysHTML += `<div class="day-cell inactive"><div class="day-number">${prevNum}</div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = formatDateKey(year, month, day);
        const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

        let cellClasses = ['day-cell'];
        if (isToday) cellClasses.push('today');

        let activityHTML = '';
        if (calendarData[dateKey]) {
            activityHTML = calendarData[dateKey].map(act => {
                let styleAttr = '';
                if (act.type === 'custom') {
                    // Inject dynamic custom inline colors
                    styleAttr = `style="background: ${act.customColor}22; color: ${act.customColor}; border: 1px solid ${act.customColor}44;"`;
                }
                return `
                <div class="activity-tag ${act.type}" ${styleAttr} data-id="${act.id}" onclick="openModal('${dateKey}', '${act.id}', event)">
                    <span>${act.emoji}</span>
                    <div>
                        <div>${escapeHTML(act.name)}</div>
                        <div class="activity-meta">${escapeHTML(act.duration)}</div>
                    </div>
                </div>
                `;
            }).join('');
        }

        daysHTML += `
            <div class="${cellClasses.join(' ')}" onclick="openModal('${dateKey}')">
                <div class="day-number">${day}</div>
                ${activityHTML}
            </div>
        `;
    }

    const totalCells = startOffset + daysInMonth;
    const remainingCells = 35 - totalCells;
    const extraCells = remainingCells >= 0 ? remainingCells : (42 - totalCells);

    for (let i = 1; i <= extraCells; i++) {
        daysHTML += `<div class="day-cell inactive"><div class="day-number">${i}</div></div>`;
    }

    grid.innerHTML = daysHTML;

    if (typeof updateWeeklyProgress === 'function') {
        updateWeeklyProgress();
    }
}

// Pagination Logic
document.getElementById('btnPrevMonth').addEventListener('click', () => {
    currentViewDate.setMonth(currentViewDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('btnNextMonth').addEventListener('click', () => {
    currentViewDate.setMonth(currentViewDate.getMonth() + 1);
    renderCalendar();
});

// Modal Interactivity
const modal = document.getElementById('activityModal');
const actForm = document.getElementById('activityForm');

// Handle Custom Category Toggle & Nutrition Toggles
document.getElementById('actType').addEventListener('change', (e) => {
    const customFields = document.getElementById('customActivityFields');
    const durationGroup = document.getElementById('durationFieldGroup');
    const intensityGroup = document.getElementById('intensityFieldGroup');
    const durInput = document.getElementById('actDuration');
    const nameInput = document.getElementById('actName');

    if (e.target.value === 'custom') {
        customFields.style.display = 'flex';
    } else {
        customFields.style.display = 'none';
    }

    if (e.target.value === 'nutrition') {
        durationGroup.style.display = 'none';
        intensityGroup.style.display = 'none';
        durInput.required = false;
        nameInput.placeholder = 'e.g. Had Nuts or Healthy Juice';
    } else {
        durationGroup.style.display = 'block';
        intensityGroup.style.display = 'block';
        durInput.required = true;
        nameInput.placeholder = 'e.g. Morning Run';
    }
});

// Auto-populate Name field when selecting a Custom Emoji
document.getElementById('customEmoji').addEventListener('change', (e) => {
    const nameInput = document.getElementById('actName');
    const selectedOption = e.target.options[e.target.selectedIndex];
    
    if (selectedOption) {
        // Extract text and remove the emoji (last character usually)
        let label = selectedOption.text;
        // Clean up: Remove emoji characters and " / " separators if any
        label = label.replace(/[^\x00-\x7F]/g, "").replace(/\//g, "").trim();
        
        if (label) {
            nameInput.value = label;
        }
    }
});

// Open the modal
function openModal(dateKey, activityId = null, event = null) {
    if (event) event.stopPropagation(); // Prevent triggering cell click

    // Reset Custom Fields display
    document.getElementById('customActivityFields').style.display = 'none';

    document.getElementById('selectedDateInput').value = dateKey;
    document.getElementById('activityId').value = activityId || '';

    if (activityId) {
        document.getElementById('modalTitle').innerText = "Edit Activity";
        document.getElementById('btnDelete').style.display = "block";

        const act = calendarData[dateKey]?.find(a => a.id == activityId);
        if (!act) {
            console.error("Activity not found in calendarData", { dateKey, activityId });
            return;
        }

        document.getElementById('actType').value = act.type;
        document.getElementById('actName').value = act.name;
        document.getElementById('actIntensity').value = act.intensity || 5;
        document.getElementById('intensityVal').innerText = act.intensity || 5;

        // Strip string artifacts to extract strict numerical value for input type=number
        const numericDur = (act.duration || '').replace(/\D/g, '');
        const unitDur = (act.duration || '').replace(/[^a-zA-Z]/g, '').trim() || 'Min';
        document.getElementById('actDuration').value = numericDur;
        // Default to Min if the option somehow isn't perfectly matched
        document.getElementById('actDurationUnit').value = unitDur === 'Hr' ? 'Hr' : 'Min';

        if (act.type === 'custom') {
            document.getElementById('customActivityFields').style.display = 'flex';
            document.getElementById('customEmoji').value = act.emoji;
            document.getElementById('customColor').value = act.customColor;
        }

        if (act.type === 'nutrition') {
            document.getElementById('durationFieldGroup').style.display = 'none';
            document.getElementById('intensityFieldGroup').style.display = 'none';
            document.getElementById('actDuration').required = false;
            document.getElementById('actName').placeholder = 'e.g. Had Nuts or Healthy Juice';
        } else {
            document.getElementById('durationFieldGroup').style.display = 'block';
            document.getElementById('intensityFieldGroup').style.display = 'block';
            document.getElementById('actDuration').required = true;
            document.getElementById('actName').placeholder = 'e.g. Morning Run';
        }
    } else {
        document.getElementById('modalTitle').innerText = `Add Activity`;
        document.getElementById('btnDelete').style.display = "none";
        document.getElementById('activityId').value = '';

        // Defaults
        document.getElementById('actType').value = 'cardio';
        document.getElementById('actName').value = '';
        document.getElementById('actIntensity').value = 5;
        document.getElementById('intensityVal').innerText = 5;
        document.getElementById('actDuration').value = '';
        document.getElementById('actDurationUnit').value = 'Min';
        document.getElementById('customEmoji').value = '';
        document.getElementById('customColor').value = '#3b82f6';

        // Reset DOM Visibility
        document.getElementById('customActivityFields').style.display = 'none';
        document.getElementById('durationFieldGroup').style.display = 'block';
        document.getElementById('intensityFieldGroup').style.display = 'block';
        document.getElementById('actDuration').required = true;
        document.getElementById('actName').placeholder = 'e.g. Morning Run';
    }

    modal.classList.add('active');
}

function closeModal() {
    modal.classList.remove('active');
}

document.getElementById('btnCancel').addEventListener('click', closeModal);

// Ensure you mark the listener as async to use 'await'
actForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Check if user is actually logged in with Supabase
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        alert("Session expired. Please log in again.");
        window.location.href = 'login.html';
        return;
    }
    const dateKey = document.getElementById('selectedDateInput').value;
    const actId = document.getElementById('activityId').value;
    const type = document.getElementById('actType').value;
    const name = document.getElementById('actName').value;
    const intensity = parseInt(document.getElementById('actIntensity').value);
    const durationNum = document.getElementById('actDuration').value;
    const durationUnit = document.getElementById('actDurationUnit').value;
    const duration = durationNum ? durationNum + " " + durationUnit : "";

    let emoji = (type === 'custom') ? (document.getElementById('customEmoji').value || '✨') : emojiMap[type];
    let customColor = (type === 'custom') ? document.getElementById('customColor').value : null;

    try {
        // Optimistic UI Update: Update local data immediately to remove perceived lag
        const newActivity = {
            id: actId || Date.now().toString(), // Temp ID for new items
            type, name, duration, emoji,
            intensity,
            customColor: customColor
        };

        if (actId) {
            // Update existing in local state
            if (calendarData[dateKey]) {
                const idx = calendarData[dateKey].findIndex(a => a.id == actId);
                if (idx !== -1) calendarData[dateKey][idx] = newActivity;
            }
        } else {
            // Add new to local state
            if (!calendarData[dateKey]) calendarData[dateKey] = [];
            calendarData[dateKey].push(newActivity);
        }

        // Render immediately
        renderCalendar();
        closeModal();

        // Background Sync with Supabase
        const userName = sessionStorage.getItem('userName') || 'User';
        
        if (actId) {
            const { error } = await supabaseClient
                .from('activities')
                .update({
                    user_id: user.id,
                    user_name: userName, // Added username field
                    date_key: dateKey,
                    type, name, duration, emoji,
                    intensity,
                    custom_color: customColor
                })
                .eq('id', actId);
            if (error) throw error;
        } else {
            const { data, error } = await supabaseClient
                .from('activities')
                .insert([{
                    user_id: user.id,
                    user_name: userName, // Added username field
                    date_key: dateKey,
                    type, name, duration, emoji,
                    intensity,
                    custom_color: customColor
                }])
                .select(); // Get the record back to capture real ID
            
            if (error) throw error;

            // Surgical DOM update: Update the temp ID with the real ID in-place
            if (data && data[0]) {
                const realId = data[0].id;
                const tempId = newActivity.id;
                const tempIdx = calendarData[dateKey].findIndex(a => a.id == tempId);
                
                if (tempIdx !== -1) {
                    // Update data model
                    calendarData[dateKey][tempIdx].id = realId;
                    
                    // Update DOM attribute and onclick handler surgically to avoid full re-render (flicker)
                    const tag = document.querySelector(`.activity-tag[data-id="${tempId}"]`);
                    if (tag) {
                        tag.setAttribute('data-id', realId);
                        tag.setAttribute('onclick', `openModal('${dateKey}', '${realId}', event)`);
                    }
                }
            }
        }

        // Silent background fetch to confirm everything matches the DB (no render here)
        silentRefresh(); 

    } catch (err) {
        console.error("Save Error:", err.message);
        alert("Failed to save to server: " + err.message);
        fetchAndRenderData(); // Revert to server state on hard error
    }
});

// Separate fetch from render for background sync
async function silentRefresh() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await supabaseClient
        .from('activities')
        .select('*')
        .eq('user_id', user.id);

    if (!error && data) {
        calendarData = {};
        data.forEach(act => {
            if (!calendarData[act.date_key]) calendarData[act.date_key] = [];
            calendarData[act.date_key].push({
                id: act.id,
                type: act.type,
                name: act.name,
                duration: act.duration,
                emoji: act.emoji,
                intensity: act.intensity,
                customColor: act.custom_color
            });
        });
        // We do NOT call renderCalendar() here to avoid flicker. 
        // The UI was already updated optimistically and surgically.
    }
}

async function fetchAndRenderData() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Use supabaseClient here
    const { data, error } = await supabaseClient
        .from('activities')
        .select('*')
        .eq('user_id', user.id);

    if (error) {
        console.error("Fetch Error:", error);
        calendarData = {}; // Empty instead of dummy data on error
    } else {
        calendarData = {};
        if (data && data.length > 0) {
            data.forEach(act => {
                if (!calendarData[act.date_key]) calendarData[act.date_key] = [];
                calendarData[act.date_key].push({
                    id: act.id,
                    type: act.type,
                    name: act.name,
                    duration: act.duration,
                    emoji: act.emoji,
                    intensity: act.intensity,
                    customColor: act.custom_color
                });
            });
        }
    }
    renderCalendar();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Initial Render (Show current month immediately with empty grid)
        renderCalendar();

        // 2. Update Sidebar Name and Visibility
        const userName = sessionStorage.getItem('userName');
        const nameElement = document.querySelector('.user-info h3');
        if (nameElement) {
            nameElement.innerText = userName || "User";
        }

        // 3. Fetch and Render (Update with user data)
        await fetchAndRenderData();

    } catch (err) {
        console.error("Startup error:", err);
        renderCalendar();
    }
});

// Delete Activity
document.getElementById('btnDelete').addEventListener('click', async () => {
    const actId = document.getElementById('activityId').value;

    try {
        const { error } = await supabaseClient
            .from('activities')
            .delete()
            .eq('id', actId);

        if (error) throw error;

        // Refresh UI by fetching fresh data
        await fetchAndRenderData();
        closeModal();
    } catch (err) {
        console.error("Error deleting activity:", err.message);
        alert("Failed to delete activity.");
    }
});

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Dynamic Weekly Progress Tracking
function updateWeeklyProgress() {
    const today = new Date();

    // Get Monday of current real-world week
    const currentDay = today.getDay(); // 0 is Sun, 1 is Mon
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;

    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    let activeDaysThisWeek = 0;

    // Globally aggregate Nutrition points for lifetime score accumulation
    let totalNutritionPoints = 0;
    for (let dk in calendarData) {
        calendarData[dk].forEach(act => {
            if (act.type === 'nutrition') {
                totalNutritionPoints += 10;
            }
        });
    }

    // Check 7 day span starting from Monday for workouts
    for (let i = 0; i < 7; i++) {
        let loopDate = new Date(monday);
        loopDate.setDate(monday.getDate() + i);
        let key = formatDateKey(loopDate.getFullYear(), loopDate.getMonth(), loopDate.getDate());

        if (calendarData[key] && calendarData[key].length > 0) {
            let hasTrueWorkout = false;

            calendarData[key].forEach(act => {
                if (act.type !== 'rest' && act.type !== 'nutrition') {
                    hasTrueWorkout = true;
                }
            });

            if (hasTrueWorkout) {
                activeDaysThisWeek++;
            }
        }
    }

    const targetGoal = 4;
    let pct = (activeDaysThisWeek / targetGoal) * 100;
    if (pct > 100) pct = 100;

    document.getElementById('weeklyProgressSpan').style.width = pct + '%';
    document.getElementById('weeklyProgressText').innerText = `${activeDaysThisWeek} / ${targetGoal} workouts`;
    document.getElementById('nutritionScoreUI').innerText = `${totalNutritionPoints} pts`;

    // Dynamic Streak Calculation
    let currentStreak = 0;
    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    // Test if user hasn't logged today yet; check unbroken streak up to yesterday
    let todayK = formatDateKey(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
    let hasLoggedToday = calendarData[todayK] && calendarData[todayK].some(act => act.type !== 'rest');

    if (!hasLoggedToday) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        let loopK = formatDateKey(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
        let acts = calendarData[loopK] || [];
        let isActiveThatDay = acts.some(act => act.type !== 'rest');

        if (isActiveThatDay) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1); // step backwards endlessly
        } else {
            break; // broken sequence
        }
    }

    document.getElementById('streakUI').innerText = `🔥 ${currentStreak} Days`;
}

// Today Button Logic
document.getElementById('btnToday').addEventListener('click', () => {
    const today = new Date();
    currentViewDate = new Date(today.getFullYear(), today.getMonth(), 1);
    renderCalendar();
});

// Clear Data Utility - Premium Modal
const resetModalOverlay = document.getElementById('resetModalOverlay');

document.getElementById('btnClearData').addEventListener('click', () => {
    resetModalOverlay.classList.add('active');
});

document.getElementById('btnCancelReset').addEventListener('click', () => {
    resetModalOverlay.classList.remove('active');
});

document.getElementById('btnConfirmReset').addEventListener('click', async () => {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const { error } = await supabaseClient
                .from('activities')
                .delete()
                .eq('user_id', user.id);
            
            if (error) throw error;
        }
        
        calendarData = {};
        await fetchAndRenderData();
        resetModalOverlay.classList.remove('active');
    } catch (err) {
        console.error("Reset Error:", err.message);
        alert("Failed to reset data: " + err.message);
    }
});

// Premium PDF Export Utility
document.getElementById('btnExportPdf').addEventListener('click', () => {
    // Utilize jsPDF from window scope
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Core Layout Colors (Matching Dark Mode Strategy)
    const bgMain = [26, 26, 27]; // #1A1A1B
    const bgSurface = [38, 38, 41]; // #262629
    const textDark = [245, 245, 247]; // #F5F5F7
    const accentPrimary = [16, 185, 129]; // #10B981

    // 1. Fill entire document background with premium dark color
    doc.setFillColor(...bgMain);
    doc.rect(0, 0, 210, 297, 'F');

    // 2. Draw Premium Header Rectangle
    doc.setFillColor(...bgSurface);
    doc.rect(0, 0, 210, 30, 'F');

    // 3. Header Text
    doc.setTextColor(...accentPrimary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Freshfit Analytics Report", 15, 20);

    doc.setTextColor(...textDark);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const exportDate = new Date().toLocaleDateString();
    doc.text(`Generated: ${exportDate}`, 150, 20);

    // 4. Construct Sorted Data Engine
    const tableData = [];
    const sortedKeys = Object.keys(calendarData).sort(); // Sort chronological automatically

    sortedKeys.forEach(date => {
        calendarData[date].forEach(act => {
            tableData.push([date, act.type.toUpperCase(), act.name, act.duration]);
        });
    });

    if (tableData.length === 0) {
        tableData.push(["-", "No Activities Logged", "-", "-"]);
    }

    // 5. Build Dynamic High-Contrast AutoTable
    doc.autoTable({
        startY: 40,
        head: [['Date', 'Category', 'Activity Name', 'Duration']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: accentPrimary, textColor: bgMain, fontSize: 11, fontStyle: 'bold' },
        bodyStyles: { fillColor: bgSurface, textColor: textDark },
        alternateRowStyles: { fillColor: [45, 45, 48] },
        styles: { lineColor: [51, 51, 54], lineWidth: 0.2 }
    });

    // 6. Append Universal Footers per page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(...bgSurface);
        doc.rect(0, 280, 210, 17, 'F');
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.text(`Personal Fitness Tracking Data Export • Page ${i} of ${pageCount}`, 15, 290);
    }

    // 7. Fire Secure Local Download
    doc.save('Freshfit_Premium_Export.pdf');
});
