// ========================================
// API Configuration - Update this when deployed
// ========================================
// Local development: 'http://localhost:3001'
// Render production: 'https://ojt-hours-tracker-ylcm.onrender.com'
// Firebase Functions: 'https://us-central1-ojt-tracker-bf9ba.cloudfunctions.net'
const API_BASE = (() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        return 'http://localhost:3001';  // Local development
    }
    // For production, use Render or other deployment URL
    return 'https://ojt-hours-tracker-ylcm.onrender.com';  // Render backend
})();

class CalendarOJTTracker {
    constructor() {
        this.currentDate = new Date();
        this.data = {};
        this.settings = {
            requiredHours: 240,
        };
        this.selectedDay = null;

        this.elements = {
            calendar: document.getElementById('calendar'),
            monthYear: document.getElementById('monthYear'),
            prevMonth: document.getElementById('prevMonth'),
            nextMonth: document.getElementById('nextMonth'),
            todayBtn: document.getElementById('todayBtn'),
            totalHours: document.getElementById('totalHours'),
            estimatedDaysLeft: document.getElementById('estimatedDaysLeft'),
            avgHours: document.getElementById('avgHours'),
            exportBtn: document.getElementById('exportBtn'),
            printViewBtn: document.getElementById('printViewBtn'),
            clearMonthBtn: document.getElementById('clearMonthBtn'),
            editModal: document.getElementById('editModal'),
            modalDate: document.getElementById('modalDate'),
            hoursSelect: document.getElementById('hoursSelect'),
            minutesSelect: document.getElementById('minutesSelect'),
            statusSelect: document.getElementById('statusSelect'),
            notesInput: document.getElementById('notesInput'),
            saveHours: document.getElementById('saveHours'),
            cancelBtn: document.getElementById('cancelBtn'),
            requiredHours: document.getElementById('requiredHours'),
            saveSettings: document.getElementById('saveSettings'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            exportOptionsModal: document.getElementById('exportOptionsModal'),
            exportCsvBtn: document.getElementById('exportCsvBtn'),
            exportPdfBtn: document.getElementById('exportPdfBtn'),
            cancelExportBtn: document.getElementById('cancelExportBtn')
        };

        this.initEventListeners();
        this.init();
    }

    async init() {
        await this.loadRemoteData();
        this.elements.requiredHours.value = this.settings.requiredHours;
        this.renderCalendar();
        this.updateSummary();
        this.updateProgress();
    }

    async fetchJson(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.message || 'Request failed');
        }
        return response.json();
    }

    async loadRemoteData() {
        try {
            const [settingsPayload, entriesPayload] = await Promise.all([
                this.fetchJson(`${API_BASE}/api/settings`),
                this.fetchJson(`${API_BASE}/api/entries`)
            ]);
            this.settings.requiredHours = settingsPayload.requiredHours || 240;
            this.data = entriesPayload.data || {};
        } catch (error) {
            alert('Could not connect to backend. Check the Firebase service account and Firestore config.');
        }
    }

    initEventListeners() {
        // Safely attach event listeners only if elements exist
        if (this.elements.prevMonth) this.elements.prevMonth.onclick = () => this.changeMonth(-1);
        if (this.elements.nextMonth) this.elements.nextMonth.onclick = () => this.changeMonth(1);
        if (this.elements.todayBtn) this.elements.todayBtn.onclick = () => this.goToToday();

        if (this.elements.exportBtn) this.elements.exportBtn.onclick = () => this.openExportOptions();
        if (this.elements.printViewBtn) this.elements.printViewBtn.onclick = () => this.openPrintView();
        if (this.elements.exportCsvBtn) this.elements.exportCsvBtn.onclick = () => this.exportCSV();
        if (this.elements.exportPdfBtn) this.elements.exportPdfBtn.onclick = () => this.exportPdf();
        if (this.elements.cancelExportBtn) this.elements.cancelExportBtn.onclick = () => this.closeExportOptions();
        if (this.elements.clearMonthBtn) this.elements.clearMonthBtn.onclick = () => this.clearCurrentMonth();

        if (this.elements.saveHours) this.elements.saveHours.onclick = () => this.saveHours();
        if (this.elements.cancelBtn) this.elements.cancelBtn.onclick = () => this.closeModal();

        if (this.elements.saveSettings) this.elements.saveSettings.onclick = () => this.saveSettingsFunc();

        window.onclick = (e) => {
            if (e.target === this.elements.editModal) {
                this.closeModal();
            }

            if (e.target === this.elements.exportOptionsModal) {
                this.closeExportOptions();
            }
        };
    }

    openExportOptions() {
        this.elements.exportOptionsModal.style.display = 'block';
    }

    closeExportOptions() {
        this.elements.exportOptionsModal.style.display = 'none';
    }

    async saveSettingsFunc() {
        const requiredHours = parseInt(this.elements.requiredHours.value, 10) || 240;
        try {
            const payload = await this.fetchJson(`${API_BASE}/api/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requiredHours })
            });
            this.settings.requiredHours = payload.requiredHours;
            this.updateProgress();
            this.updateSummary();
        } catch (error) {
            alert(error.message || 'Failed to save settings');
        }
    }

    changeMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.renderCalendar();
        this.updateSummary();
    }

    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
        this.updateSummary();
    }

    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        this.elements.monthYear.textContent = this.currentDate.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long'
        });

        this.elements.calendar.innerHTML = '';

        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
            const div = document.createElement('div');
            div.className = 'calendar-day day-header';
            div.textContent = day;
            this.elements.calendar.appendChild(div);
        });

        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const leadingEmptyDays = firstDay.getDay();
        const today = new Date();

        for (let i = 0; i < leadingEmptyDays; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'calendar-day empty-day';
            this.elements.calendar.appendChild(emptyDiv);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);

            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            dayDiv.dataset.date = this.formatDateKey(date);

            const dayNum = date.getDate();
            const isToday = date.toDateString() === today.toDateString();

            if (isToday) dayDiv.classList.add('today');

            const hours = this.getDayHours(date);
            const dayData = this.data[dayDiv.dataset.date];
            const status = (typeof dayData === 'object' && dayData !== null) ? dayData.status : 'work';
            const notes = (typeof dayData === 'object' && dayData !== null) ? (dayData.notes || '') : '';
            const dayOfWeek = date.getDay();

            if (status === 'holiday') {
                dayDiv.classList.add('holiday');
            } else if (status === 'no-schedule') {
                dayDiv.classList.add('no-schedule');
            } else if (dayOfWeek === 0 && !this.hasDayData(date)) {
                dayDiv.classList.add('no-schedule');
            } else {
                if (hours > 0) dayDiv.classList.add('present');
                else if (hours === 0 && this.hasDayData(date)) dayDiv.classList.add('absent');
            }

            dayDiv.classList.add('editable');
            dayDiv.onclick = () => this.editDay(date);

            const dayContent = document.createElement('div');
            dayContent.className = 'day-number';
            dayContent.textContent = dayNum;

            const hoursContent = document.createElement('div');
            hoursContent.className = 'day-hours';
            hoursContent.textContent = hours > 0 ? (hours + 'h') : '';

            dayDiv.appendChild(dayContent);
            dayDiv.appendChild(hoursContent);

            if (notes) {
                const noteBadge = document.createElement('div');
                noteBadge.className = 'day-note-badge';
                noteBadge.textContent = 'Note';
                dayDiv.appendChild(noteBadge);
                dayDiv.title = notes;
            }

            this.elements.calendar.appendChild(dayDiv);
        }

        const totalCells = leadingEmptyDays + daysInMonth;
        const trailingEmptyDays = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < trailingEmptyDays; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'calendar-day empty-day';
            this.elements.calendar.appendChild(emptyDiv);
        }
    }

    getDayHours(date) {
        const key = this.formatDateKey(date);
        const data = this.data[key];
        if (typeof data === 'number') return data;
        if (typeof data === 'object' && data !== null) return data.hours || 0;
        return 0;
    }

    hasDayData(date) {
        const key = this.formatDateKey(date);
        const data = this.data[key];
        if (typeof data === 'number') return data !== null && data !== undefined;
        if (typeof data === 'object' && data !== null) return true;
        return false;
    }

    editDay(date) {
        this.selectedDay = this.formatDateKey(date);
        this.elements.modalDate.textContent = date.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const stored = this.data[this.selectedDay];
        let hours = 0, minutes = 0, status = 'work', notes = '';

        if (typeof stored === 'number') {
            hours = Math.floor(stored);
            minutes = Math.round((stored - hours) * 60);
        } else if (typeof stored === 'object' && stored !== null) {
            hours = Math.floor(stored.hours || 0);
            minutes = Math.round(((stored.hours || 0) - hours) * 60);
            status = stored.status || 'work';
            notes = stored.notes || '';
        } else {
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0) {
                status = 'no-schedule';
            }
        }

        this.elements.hoursSelect.value = hours;
        this.elements.statusSelect.value = status;
        this.elements.notesInput.value = notes;

        const snappedMinutes = [0, 15, 30, 45].reduce((prev, curr) =>
            Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev
        , 0);
        this.elements.minutesSelect.value = String(snappedMinutes);

        this.elements.editModal.style.display = 'block';
    }

    async saveHours() {
        const hours = parseInt(this.elements.hoursSelect.value, 10);
        const minutes = parseInt(this.elements.minutesSelect.value, 10) || 0;
        const status = this.elements.statusSelect.value;
        const notes = this.elements.notesInput.value.trim();
        const totalHours = hours + (minutes / 60);

        if (!this.selectedDay) {
            alert('Select a date before saving.');
            return;
        }

        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
            alert('Hours and minutes must be valid numbers.');
            return;
        }

        if (![0, 15, 30, 45].includes(minutes)) {
            alert('Minutes must be 00, 15, 30, or 45.');
            return;
        }

        if (notes.length > 500) {
            alert('Notes must be 500 characters or less.');
            return;
        }

        if (totalHours < 0 || totalHours > 24) {
            alert('Hours worked must be between 0 and 24.');
            return;
        }

        try {
            const payload = await this.fetchJson(`${API_BASE}/api/entries/${this.selectedDay}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hours: Number(totalHours.toFixed(2)),
                    status,
                    notes
                })
            });

            this.data[this.selectedDay] = {
                hours: payload.hours,
                status: payload.status,
                notes: payload.notes || ''
            };

            this.closeModal();
            this.renderCalendar();
            this.updateSummary();
            this.updateProgress();
        } catch (error) {
            alert(error.message || 'Failed to save hours. Check the selected date, hours, and notes.');
        }
    }

    closeModal() {
        this.elements.editModal.style.display = 'none';
        this.selectedDay = null;
        this.elements.notesInput.value = '';
    }

    updateSummary() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        let totalHours = 0, daysWithData = 0;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const key = this.formatDateKey(date);
            if (key in this.data) {
                daysWithData++;
                totalHours += this.getDayHours(date);
            }
        }

        const avgHours = daysWithData > 0 ? totalHours / daysWithData : 0;
        const totalLoggedHours = Object.values(this.data).reduce((sum, data) => {
            if (typeof data === 'number') return sum + (data || 0);
            if (typeof data === 'object' && data !== null) return sum + (data.hours || 0);
            return sum;
        }, 0);
        const remainingHours = Math.max(0, this.settings.requiredHours - totalLoggedHours);
        const estimatedDaysLeft = Math.ceil(remainingHours / 8);

        this.elements.totalHours.textContent = this.formatHours(totalHours);
        this.elements.estimatedDaysLeft.textContent = estimatedDaysLeft;
        this.elements.avgHours.textContent = this.formatHours(avgHours);
    }

    updateProgress() {
        const totalLoggedHours = Object.values(this.data).reduce((sum, data) => {
            if (typeof data === 'number') return sum + (data || 0);
            if (typeof data === 'object' && data !== null) return sum + (data.hours || 0);
            return sum;
        }, 0);
        const required = this.settings.requiredHours;
        const progressPercent = Math.min((totalLoggedHours / required) * 100, 100);

        this.elements.progressFill.style.width = progressPercent + '%';
        this.elements.progressFill.dataset.percent = Math.round(progressPercent);

        this.elements.progressText.textContent = `${Math.round(progressPercent)}% - ${this.formatHours(totalLoggedHours)} / ${this.formatHours(required)}`;
    }

    formatHours(hours) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    }

    async exportCSV() {
        try {
            const entriesPayload = await this.fetchJson(`${API_BASE}/api/entries`);
            const exportData = entriesPayload.data || {};
            const dates = Object.keys(exportData);

            if (dates.length === 0) return alert('No data to export!');

            dates.sort();

            const parseLocalDate = (dateStr) => {
                const [year, month, day] = dateStr.split('-').map(Number);
                return new Date(year, month - 1, day);
            };

            const startDate = parseLocalDate(dates[0]);
            const endDate = parseLocalDate(dates[dates.length - 1]);

            const lines = [];

            const startMonth = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const endMonth = endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            lines.push(`"Daily Time Record","${startMonth} - ${endMonth}"`);
            lines.push('');
            lines.push('"Date","Day","Hours","Status","Notes"');

            const current = new Date(startDate);
            while (current <= endDate) {
                const key = this.formatDateKey(current);
                const dayName = current.toLocaleDateString('en-US', { weekday: 'short' });
                const dayOfWeek = current.getDay();

                const dayData = exportData[key];
                let hours = 0, status = 'Regular';
                let notes = '';

                if (typeof dayData === 'number') {
                    hours = dayData;
                    status = hours > 0 ? 'Present' : 'Absent';
                } else if (typeof dayData === 'object' && dayData !== null) {
                    hours = dayData.hours || 0;
                    notes = dayData.notes || '';
                    const dayStatus = dayData.status || 'work';
                    if (dayStatus === 'holiday') {
                        status = 'Holiday';
                    } else if (dayStatus === 'no-schedule') {
                        status = 'No Schedule';
                    } else {
                        status = hours > 0 ? 'Present' : 'Absent';
                    }
                } else if (dayOfWeek === 0) {
                    status = 'No Schedule';
                }

                const hoursFormatted = (status === 'Holiday' || status === 'No Schedule') ? '-' : (hours > 0 ? this.formatHours(hours) : '-');
                const notesFormatted = `"${String(notes).replace(/"/g, '""')}"`;
                lines.push(`"${key}","${dayName}","${hoursFormatted}","${status}",${notesFormatted}`);

                current.setDate(current.getDate() + 1);
            }

            const csv = lines.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'DTR-Complete.csv';
            a.click();
            URL.revokeObjectURL(url);
            this.closeExportOptions();
        } catch (error) {
            alert(error.message || 'Failed to export CSV. Check that the Firestore data is available.');
        }
    }

    async exportPdf() {
        try {
            this.closeExportOptions();
            this.launchPrintPreview();
        } catch (error) {
            alert(error.message || 'Failed to prepare PDF export.');
        }
    }

    openPrintView() {
        this.launchPrintPreview();
    }

    launchPrintPreview() {
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        printFrame.style.visibility = 'hidden';
        printFrame.setAttribute('aria-hidden', 'true');

        document.body.appendChild(printFrame);

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const monthLabel = this.currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const rows = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const key = this.formatDateKey(date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayData = this.data[key];
            let hours = 0;
            let status = 'Regular';
            let notes = '';

            if (typeof dayData === 'number') {
                hours = dayData;
                status = hours > 0 ? 'Present' : 'Absent';
            } else if (typeof dayData === 'object' && dayData !== null) {
                hours = dayData.hours || 0;
                status = dayData.status === 'holiday' ? 'Holiday' : dayData.status === 'no-schedule' ? 'No Schedule' : (hours > 0 ? 'Present' : 'Absent');
                notes = dayData.notes || '';
            } else if (date.getDay() === 0) {
                status = 'No Schedule';
            }

            const hoursFormatted = (status === 'Holiday' || status === 'No Schedule') ? '-' : (hours > 0 ? this.formatHours(hours) : '-');

            rows.push(`
                <tr>
                    <td>${key}</td>
                    <td>${dayName}</td>
                    <td>${hoursFormatted}</td>
                    <td>${status}</td>
                    <td>${this.escapeHtml(notes)}</td>
                </tr>
            `);
        }

        const summaryHtml = `
            <div class="print-summary">
                <div><strong>Month Total:</strong> ${this.elements.totalHours.textContent}</div>
                <div><strong>Est. Days Left:</strong> ${this.elements.estimatedDaysLeft.textContent}</div>
                <div><strong>Avg:</strong> ${this.elements.avgHours.textContent}</div>
            </div>
        `;

        const printStyles = `
            <style>
                body { font-family: Arial, sans-serif; padding: 24px; color: #1f2d3d; }
                h1 { margin: 0 0 10px; font-size: 24px; }
                .print-summary { display: flex; gap: 16px; flex-wrap: wrap; margin: 14px 0 20px; }
                .print-summary div { background: #eef4fa; padding: 10px 12px; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { border: 1px solid #cfd8e3; padding: 8px 10px; text-align: left; vertical-align: top; }
                th { background: #eaf1f7; }
                .actions { margin: 18px 0 24px; }
                .actions button { padding: 10px 14px; border: 0; border-radius: 6px; margin-right: 8px; cursor: pointer; }
                .primary { background: #547493; color: white; }
                .secondary { background: #7f8e97; color: white; }
                @media print { .actions { display: none; } body { padding: 0; } }
            </style>
        `;

        printFrame.addEventListener('load', () => {
            const frameWindow = printFrame.contentWindow;
            if (!frameWindow) {
                printFrame.remove();
                throw new Error('Unable to open print preview.');
            }

            const cleanup = () => printFrame.remove();
            frameWindow.onafterprint = cleanup;
            frameWindow.focus();
            frameWindow.print();
            setTimeout(cleanup, 1000);
        }, { once: true });

        printFrame.srcdoc = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>OJT Hours Tracker - Print View</title>
                ${printStyles}
            </head>
            <body>
                <div class="actions">
                    <button class="primary" onclick="window.print()">Print / Save as PDF</button>
                    <button class="secondary" onclick="window.close()">Close</button>
                </div>
                <h1>OJT Hours Tracker</h1>
                <h2>${monthLabel}</h2>
                ${summaryHtml}
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Day</th>
                            <th>Hours</th>
                            <th>Status</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async clearCurrentMonth() {
        if (!confirm('Clear current month?')) return;

        const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
        const yearMonth = `${this.currentDate.getFullYear()}-${month}`;

        try {
            await this.fetchJson(`${API_BASE}/api/entries/month/${yearMonth}`, {
                method: 'DELETE'
            });

            const year = this.currentDate.getFullYear();
            const currentMonth = this.currentDate.getMonth();
            const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();

            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, currentMonth, day);
                const key = this.formatDateKey(date);
                delete this.data[key];
            }

            this.renderCalendar();
            this.updateSummary();
            this.updateProgress();
        } catch (error) {
            alert(error.message || 'Failed to clear month entries');
        }
    }
}

// Initialize Calendar Tracker only on calendar page
if (document.getElementById('calendar')) {
    const tracker = new CalendarOJTTracker();
}

// ========================================
// Dashboard Analytics
// ========================================
class DashboardApp {
    constructor() {
        this.allEntries = {};
        this.settings = {
            requiredHours: 240,
        };
        this.elements = {};  // Will be populated on init
        this.debugMode = true;
    }

    async init() {
        try {
            // Initialize element references
            this.elements = {
                totalHoursLogged: document.getElementById('totalHoursLogged'),
                requiredHoursDisplay: document.getElementById('requiredHoursDisplay'),
                completionPercentage: document.getElementById('completionPercentage'),
                daysPresent: document.getElementById('daysPresent'),
                presentBar: document.getElementById('presentBar'),
                absentBar: document.getElementById('absentBar'),
                holidayBar: document.getElementById('holidayBar'),
                noScheduleBar: document.getElementById('noScheduleBar'),
                presentCount: document.getElementById('presentCount'),
                absentCount: document.getElementById('absentCount'),
                holidayCount: document.getElementById('holidayCount'),
                noScheduleCount: document.getElementById('noScheduleCount'),
                monthlySummaryBody: document.getElementById('monthlySummaryBody'),
                entriesTableBody: document.getElementById('entriesTableBody'),
                absenceNotesList: document.getElementById('absenceNotesList'),
                monthFilter: document.getElementById('monthFilter'),
            };

            this.showDebug(`Dashboard init started | API: ${API_BASE}`);

            await this.loadAllData();
            await this.loadSettings();
            this.renderDashboard();
            this.setupEventListeners();
            
            this.showDebug('Dashboard ready!');
        } catch (error) {
            this.showDebug(`✗ Fatal error: ${error.message}`);
            console.error('Failed to initialize dashboard:', error);
        }
    }

    async loadAllData() {
        try {
            const url = `${API_BASE}/api/entries`;
            this.showDebug(`Fetching from: ${url}`);
            
            const response = await fetch(url);
            this.showDebug(`Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.showDebug(`Raw response keys: ${Object.keys(data).join(', ')}`);
            
            // Handle both direct object and wrapped format
            this.allEntries = data.data || data || {};
            const count = Object.keys(this.allEntries).length;
            this.showDebug(`✓ Loaded ${count} entries`);
        } catch (error) {
            this.showDebug(`✗ Error loading entries: ${error.message}`);
            this.showDebug(`API Base: ${API_BASE}`);
            this.allEntries = {};
        }
    }

    async loadSettings() {
        try {
            const url = `${API_BASE}/api/settings`;
            this.showDebug(`Fetching settings from: ${url}`);
            
            const response = await fetch(url);
            this.showDebug(`Settings response status: ${response.status}`);
            
            if (response.ok) {
                const data = await response.json();
                this.settings.requiredHours = data.requiredHours || 240;
                this.showDebug(`✓ Loaded settings: ${this.settings.requiredHours}h required`);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            this.showDebug(`⚠️ Settings API failed: ${error.message} - Using localStorage/default`);
            try {
                const stored = localStorage.getItem('ojt_settings');
                if (stored) {
                    this.settings = JSON.parse(stored);
                    this.showDebug(`✓ Loaded settings from localStorage`);
                }
            } catch (e) {
                this.showDebug(`✗ localStorage error: ${e.message}`);
            }
        }
    }

    renderDashboard() {
        this.updateSummaryCards();
        this.updateStatusBreakdown();
        this.populateMonthlySummary();
        this.populateEntriesTable();
        this.populateAbsenceNotes();
        this.populateMonthFilter();
    }

    updateSummaryCards() {
        const stats = this.calculateStats();
        
        // Total hours logged
        const totalHours = Math.floor(stats.totalMinutes / 60);
        const totalMinutes = stats.totalMinutes % 60;
        this.elements.totalHoursLogged.textContent = `${totalHours}h ${totalMinutes}m`;

        // Required hours
        const requiredHours = this.settings.requiredHours || 240;
        this.elements.requiredHoursDisplay.textContent = `${requiredHours}h`;

        // Completion percentage
        const completionPercent = requiredHours > 0 ? Math.round((stats.totalMinutes / (requiredHours * 60)) * 100) : 0;
        this.elements.completionPercentage.textContent = `${Math.min(completionPercent, 100)}%`;

        // Days present
        this.elements.daysPresent.textContent = stats.presentDays;
    }

    updateStatusBreakdown() {
        const stats = this.calculateStats();
        const total = stats.presentDays + stats.absentDays + stats.holidayDays + stats.noScheduleDays;

        if (total === 0) {
            this.elements.presentBar.style.width = '0%';
            this.elements.absentBar.style.width = '0%';
            this.elements.holidayBar.style.width = '0%';
            this.elements.noScheduleBar.style.width = '0%';
        } else {
            this.elements.presentBar.style.width = `${(stats.presentDays / total) * 100}%`;
            this.elements.absentBar.style.width = `${(stats.absentDays / total) * 100}%`;
            this.elements.holidayBar.style.width = `${(stats.holidayDays / total) * 100}%`;
            this.elements.noScheduleBar.style.width = `${(stats.noScheduleDays / total) * 100}%`;
        }

        this.elements.presentCount.textContent = stats.presentDays;
        this.elements.absentCount.textContent = stats.absentDays;
        this.elements.holidayCount.textContent = stats.holidayDays;
        this.elements.noScheduleCount.textContent = stats.noScheduleDays;
    }

    populateMonthlySummary() {
        const monthlyData = this.getMonthlySummary();
        const tbody = this.elements.monthlySummaryBody;
        
        if (Object.keys(monthlyData).length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No data available</td></tr>';
            return;
        }

        const html = Object.entries(monthlyData)
            .sort((a, b) => new Date(b[0]) - new Date(a[0]))
            .map(([month, data]) => {
                const avgHours = data.presentDays > 0 ? (data.totalMinutes / 60 / data.presentDays).toFixed(1) : '0.0';
                const monthName = this.formatMonthName(month);
                return `
                    <tr>
                        <td>${monthName}</td>
                        <td>${Math.floor(data.totalMinutes / 60)}h ${data.totalMinutes % 60}m</td>
                        <td>${data.presentDays}</td>
                        <td>${data.absentDays}</td>
                        <td>${avgHours}h</td>
                    </tr>
                `;
            })
            .join('');
        
        tbody.innerHTML = html;
    }

    populateEntriesTable() {
        const entries = this.getAllEntries();
        const tbody = this.elements.entriesTableBody;

        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No entries found</td></tr>';
            return;
        }

        // Get the selected month filter value
        const selectedMonth = this.elements.monthFilter.value;
        
        // Filter entries by selected month if not "All Months"
        let filteredEntries = entries;
        if (selectedMonth) {
            filteredEntries = entries.filter(entry => entry.date.startsWith(selectedMonth));
        }

        if (filteredEntries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No entries found for this month</td></tr>';
            return;
        }

        const html = filteredEntries
            .slice(0, 50) // Show last 50 entries
            .map(entry => {
                const hours = Math.floor(entry.totalMinutes / 60);
                const minutes = entry.totalMinutes % 60;
                const statusLabel = entry.status === 'work' ? 'Present' : 
                                   entry.status === 'holiday' ? 'Holiday' : 'No Schedule';
                return `
                    <tr>
                        <td>${entry.date}</td>
                        <td>${hours > 0 ? `${hours}h ${minutes}m` : '-'}</td>
                        <td>${statusLabel}</td>
                        <td>${this.escapeHtml(entry.notes || '')}</td>
                    </tr>
                `;
            })
            .join('');

        tbody.innerHTML = html;
    }

    populateAbsenceNotes() {
        const entries = this.getAllEntries();
        const absenceEntries = entries.filter(e => e.notes && (e.status === 'work' && e.totalMinutes === 0));

        const container = this.elements.absenceNotesList;

        if (absenceEntries.length === 0) {
            container.innerHTML = '<p class="empty-state">No absence notes recorded</p>';
            return;
        }

        const html = absenceEntries
            .map(entry => `
                <div class="absence-note-item">
                    <div class="absence-note-date">${entry.date}</div>
                    <div class="absence-note-text">${this.escapeHtml(entry.notes)}</div>
                </div>
            `)
            .join('');

        container.innerHTML = html;
    }

    populateMonthFilter() {
        const monthSet = new Set();
        Object.keys(this.allEntries).forEach(date => {
            const month = date.substring(0, 7); // YYYY-MM
            monthSet.add(month);
        });

        const months = Array.from(monthSet).sort().reverse();
        const select = this.elements.monthFilter;

        months.forEach(month => {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            select.appendChild(option);
        });
    }

    setupEventListeners() {
        this.elements.monthFilter.addEventListener('change', () => {
            this.populateEntriesTable();
        });
    }

    showDebug(message) {
        if (this.debugMode) {
            console.log(message);
            const debugPanel = document.getElementById('debugPanel');
            const debugMessage = document.getElementById('debugMessage');
            if (debugPanel && debugMessage) {
                debugPanel.style.display = 'block';
                debugMessage.textContent = (debugMessage.textContent ? debugMessage.textContent + '\n' : '') + message;
            }
        }
    }

    calculateStats() {
        let totalMinutes = 0;
        let presentDays = 0;
        let absentDays = 0;
        let holidayDays = 0;
        let noScheduleDays = 0;

        Object.values(this.allEntries).forEach(entry => {
            if (typeof entry === 'object' && entry !== null) {
                const hours = entry.hours || 0;
                const minutes = entry.minutes || 0;
                totalMinutes += (hours * 60) + minutes;

                if (entry.status === 'holiday') {
                    holidayDays++;
                } else if (entry.status === 'no-schedule') {
                    noScheduleDays++;
                } else if (hours > 0) {
                    presentDays++;
                } else {
                    absentDays++;
                }
            }
        });

        return {
            totalMinutes: Math.round(totalMinutes),
            presentDays,
            absentDays,
            holidayDays,
            noScheduleDays,
        };
    }

    getMonthlySummary() {
        const monthly = {};

        Object.entries(this.allEntries).forEach(([date, entry]) => {
            const month = date.substring(0, 7);
            
            if (!monthly[month]) {
                monthly[month] = {
                    totalMinutes: 0,
                    presentDays: 0,
                    absentDays: 0,
                    holidayDays: 0,
                    noScheduleDays: 0,
                };
            }

            if (typeof entry === 'object' && entry !== null) {
                const hours = entry.hours || 0;
                const minutes = entry.minutes || 0;
                monthly[month].totalMinutes += (hours * 60) + minutes;

                if (entry.status === 'holiday') {
                    monthly[month].holidayDays++;
                } else if (entry.status === 'no-schedule') {
                    monthly[month].noScheduleDays++;
                } else if (hours > 0) {
                    monthly[month].presentDays++;
                } else {
                    monthly[month].absentDays++;
                }
            }
        });

        return monthly;
    }

    getAllEntries() {
        const entries = [];

        Object.entries(this.allEntries).forEach(([date, entry]) => {
            if (typeof entry === 'object' && entry !== null) {
                const hours = entry.hours || 0;
                const minutes = entry.minutes || 0;
                const totalMinutes = (hours * 60) + minutes;
                
                entries.push({
                    date,
                    hours,
                    totalMinutes: Math.round(totalMinutes),
                    status: entry.status || 'work',
                    notes: entry.notes || '',
                });
            }
        });

        return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatMonthName(monthStr) {
        // Convert "2026-02" to "February 2026"
        try {
            const date = new Date(monthStr + '-01');
            return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
        } catch (e) {
            return monthStr;
        }
    }
}

const dashboardApp = new DashboardApp();
