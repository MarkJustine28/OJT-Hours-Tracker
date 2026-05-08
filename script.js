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
            clearMonthBtn: document.getElementById('clearMonthBtn'),
            editModal: document.getElementById('editModal'),
            modalDate: document.getElementById('modalDate'),
            hoursSelect: document.getElementById('hoursSelect'),
            minutesSelect: document.getElementById('minutesSelect'),
            statusSelect: document.getElementById('statusSelect'),
            saveHours: document.getElementById('saveHours'),
            cancelBtn: document.getElementById('cancelBtn'),
            requiredHours: document.getElementById('requiredHours'),
            saveSettings: document.getElementById('saveSettings'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText')
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
            alert('Could not connect to backend. Start the Node.js server and check MySQL config.');
        }
    }

    initEventListeners() {
        this.elements.prevMonth.onclick = () => this.changeMonth(-1);
        this.elements.nextMonth.onclick = () => this.changeMonth(1);
        this.elements.todayBtn.onclick = () => this.goToToday();

        this.elements.exportBtn.onclick = () => this.exportCSV();
        this.elements.clearMonthBtn.onclick = () => this.clearCurrentMonth();

        this.elements.saveHours.onclick = () => this.saveHours();
        this.elements.cancelBtn.onclick = () => this.closeModal();

        this.elements.saveSettings.onclick = () => this.saveSettingsFunc();

        window.onclick = (e) => {
            if (e.target === this.elements.editModal) {
                this.closeModal();
            }
        };
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
        let hours = 0, minutes = 0, status = 'work';

        if (typeof stored === 'number') {
            hours = Math.floor(stored);
            minutes = Math.round((stored - hours) * 60);
        } else if (typeof stored === 'object' && stored !== null) {
            hours = Math.floor(stored.hours || 0);
            minutes = Math.round(((stored.hours || 0) - hours) * 60);
            status = stored.status || 'work';
        } else {
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0) {
                status = 'no-schedule';
            }
        }

        this.elements.hoursSelect.value = hours;
        this.elements.statusSelect.value = status;

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
        const totalHours = hours + (minutes / 60);

        if (!this.selectedDay) {
            return;
        }

        try {
            const payload = await this.fetchJson(`${API_BASE}/api/entries/${this.selectedDay}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hours: Number(totalHours.toFixed(2)),
                    status
                })
            });

            this.data[this.selectedDay] = {
                hours: payload.hours,
                status: payload.status
            };

            this.closeModal();
            this.renderCalendar();
            this.updateSummary();
            this.updateProgress();
        } catch (error) {
            alert(error.message || 'Failed to save hours');
        }
    }

    closeModal() {
        this.elements.editModal.style.display = 'none';
        this.selectedDay = null;
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

    exportCSV() {
        const dates = Object.keys(this.data);
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
        lines.push('"Date","Day","Hours","Status"');

        const current = new Date(startDate);
        while (current <= endDate) {
            const key = this.formatDateKey(current);
            const dayName = current.toLocaleDateString('en-US', { weekday: 'short' });
            const dayOfWeek = current.getDay();

            const dayData = this.data[key];
            let hours = 0, status = 'Regular';

            if (typeof dayData === 'number') {
                hours = dayData;
                status = hours > 0 ? 'Present' : 'Absent';
            } else if (typeof dayData === 'object' && dayData !== null) {
                hours = dayData.hours || 0;
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
            lines.push(`"${key}","${dayName}","${hoursFormatted}","${status}"`);

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

const tracker = new CalendarOJTTracker();
