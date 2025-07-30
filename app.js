// This is the main application script that orchestrates everything.

/**
 * Manages all event data, including loading from files, handling custom events,
 * and providing a unified, filtered list of events for rendering.
 */
class EventItemManager {
    constructor() {
        this.fileEvents = new Map(); // Events from the CSV file, mapped by uniqueId
        this.customEvents = new Map(); // Custom events from localStorage, mapped by uniqueId
        this.hiddenEventIds = new Set(); // Set of uniqueIds for hidden events
        this.loadFromLocalStorage();
    }

    /**
     * Loads custom events and hidden event IDs from the browser's localStorage.
     */
    loadFromLocalStorage() {
        const customEventsRaw = JSON.parse(localStorage.getItem('customEvents')) || [];
        customEventsRaw.forEach(obj => {
            const eventItem = EventItem.fromObject(obj);
            this.customEvents.set(eventItem.uniqueId, eventItem);
        });

        const hiddenEventsRaw = JSON.parse(localStorage.getItem('hiddenEvents')) || [];
        this.hiddenEventIds = new Set(hiddenEventsRaw);
    }

    /**
     * Saves custom events and hidden event IDs to localStorage.
     */
    saveToLocalStorage() {
        const customEventsToSave = Array.from(this.customEvents.values()).map(event => {
            // Create a plain object for serialization
            return {
                summary: event.summary,
                start: event.start,
                end: event.end,
                description: event.description,
                rsvp: event.rsvp,
                private: event.private,
                ooo: event.ooo,
                uniqueId: event.uniqueId, // Important to save the ID
                isCustom: event.isCustom,
                bgColor: event.bgColor,
                textColor: event.textColor,
                images: event.images
            };
        });
        localStorage.setItem('customEvents', JSON.stringify(customEventsToSave));
        localStorage.setItem('hiddenEvents', JSON.stringify(Array.from(this.hiddenEventIds)));
    }

    /**
     * Loads events from a CSV text string, replacing existing file-based events.
     * @param {string} csvText - The raw CSV data.
     */
    loadFromCsv(csvText) {
        this.fileEvents.clear();
        const parsedRows = parseCSV(csvText);
        parsedRows.forEach(row => {
            const eventItem = EventItem.fromCsv(row);
            // Only add if it has a valid uniqueId
            if (eventItem.uniqueId) {
                this.fileEvents.set(eventItem.uniqueId, eventItem);
            }
        });
    }

    /**
     * Adds or updates a custom event. If the event already exists, it's replaced.
     * This handles both new events and edits of existing ones.
     * @param {EventItem} eventItem - The event to save.
     */
    saveCustomEvent(eventItem) {
        this.customEvents.set(eventItem.uniqueId, eventItem);
        this.saveToLocalStorage();
    }

    /**
     * Deletes a custom event by its ID.
     * @param {string} eventId - The unique ID of the event to delete.
     */
    deleteCustomEvent(eventId) {
        this.customEvents.delete(eventId);
        this.saveToLocalStorage();
    }

    /**
     * Hides or unhides an event.
     * @param {string} eventId - The ID of the event to toggle.
     */
    toggleEventVisibility(eventId) {
        if (this.hiddenEventIds.has(eventId)) {
            this.hiddenEventIds.delete(eventId);
        } else {
            this.hiddenEventIds.add(eventId);
        }
        this.saveToLocalStorage();
    }

    /**
     * Retrieves a single event by its ID, considering custom overrides.
     * @param {string} eventId - The unique ID of the event.
     * @returns {EventItem|undefined} The event item, or undefined if not found.
     */
    getEventById(eventId) {
        // Custom events take precedence
        return this.customEvents.get(eventId) || this.fileEvents.get(eventId);
    }

    /**
     * Removes old hidden event IDs from localStorage if the corresponding event has passed.
     */
    cleanupHiddenEvents() {
        const now = fakeNow ? new Date(fakeNow.getTime()) : new Date();
        let changed = false;

        this.hiddenEventIds.forEach(id => {
            const event = this.getEventById(id);
            // If the event doesn't exist anymore or has passed, remove it from the hidden set
            if (!event || new Date(event.end) < now) {
                this.hiddenEventIds.delete(id);
                changed = true;
            }
        });

        if (changed) {
            this.saveToLocalStorage();
        }
    }

    /**
     * Gets a consolidated list of all events, with custom events overriding file events.
     * This is the master list of all known events.
     * @returns {Array<EventItem>} A list of all events.
     */
    getAllEvents() {
        const allEventsMap = new Map(this.fileEvents);
        // Let custom events override file events
        this.customEvents.forEach((event, id) => {
            allEventsMap.set(id, event);
        });
        return Array.from(allEventsMap.values());
    }

    /**
     * Gets a list of events that should be visible on the page, based on current filters.
     * @param {Date} now - The current time.
     * @returns {Array<EventItem>} The filtered and sorted list of visible events.
     */
    getVisibleEvents(now) {
        this.cleanupHiddenEvents();
        const allEvents = this.getAllEvents();

        const visibleEvents = allEvents.filter(e => {
            const isHidden = this.hiddenEventIds.has(e.uniqueId) && !showHiddenOverride;
            const isDeclined = e.rsvp === 'declined';
            const isOOO = e.ooo === 'yes';

            if (!e.end) return false;

            return !isHidden && !isDeclined && !isOOO && new Date(e.end) >= now;
        });

        return visibleEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    }
}

// ===================================================================================
// Main Application Logic - Now using EventItemManager
// ===================================================================================

const eventManager = new EventItemManager();

/**
 * Updates the current time display and event countdowns every second.
 */
function updateTime() {
    const now = fakeNow ? new Date(fakeNow.getTime()) : new Date();
    document.getElementById('current-time').innerText = now.toLocaleTimeString();
    if (fakeNow) fakeNow.setSeconds(fakeNow.getSeconds() + 1);

    Array.from(document.querySelectorAll('.event')).forEach(el => {
        const start = new Date(el.dataset.start);
        const end = new Date(el.dataset.end);
        const msUntil = start - now;
        const timeDiv = el.querySelector('.time-until, .big-time');

        el.classList.remove('happening-now', 'final-countdown', 'starting-soon');
        if ((start <= now) && (end > now)) {
            el.classList.add('happening-now');
            const eventId = el.dataset.id;
            const msSinceStart = now - start;

            if (msSinceStart <= autoCloseDuration && !shownEventDetails.has(eventId)) {
                shownEventDetails.add(eventId);
                // This is the only place that should show the details view automatically
                showDetailsById(eventId, { glow: true });
            }

        } else if (msUntil > 0 && msUntil <= 2 * 60 * 1000) {
            el.classList.add('final-countdown');
        } else if (msUntil > 2 * 60 * 1000 && msUntil < 10 * 60 * 1000) {
            el.classList.add('starting-soon');
        }

        if (end <= now && !el.classList.contains('slide-out')) {
            el.classList.add('slide-out');
            setTimeout(() => el.remove(), 500);
        }
        if (timeDiv) {
            timeDiv.className = (msUntil > 0 && msUntil < 10 * 60 * 1000) ? 'big-time' : 'time-until';
            timeDiv.textContent = msUntil > 0 ? formatDuration(msUntil) : (end > now ? 'Happening now' : 'Started');
        }
    });
}

/**
 * Renders the all-day events for the current day.
 * @param {Array<EventItem>} events - The list of all-day events.
 */
function renderTodaysAllDayEvents(events) {
    const container = document.getElementById('all-day-container');
    container.innerHTML = '';

    if (events.length > 0) {
        container.style.display = '';
        const title = document.createElement('div');
        title.className = 'all-day-title';
        title.textContent = "All-Day Events";
        container.appendChild(title);

        events.forEach(e => {
            const el = document.createElement('div');
            el.className = 'all-day-event';
            el.textContent = e.summary;
            if (e.bgColor) el.style.backgroundColor = e.bgColor;
            if (e.textColor) el.style.color = e.textColor;
            el.onclick = () => openAddEventModal(e, true);
            container.appendChild(el);
        });
    } else {
        container.style.display = 'none';
    }
}

/**
 * Renders a single event element.
 * @param {EventItem} e - The event object.
 * @param {Date} now - The current date.
 * @returns {HTMLElement} The event element.
 */
function createEventElement(e, now) {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const msUntil = start - now;

    let cssClass = 'event';
    if ((start <= now) && (end > now)) cssClass += ' happening-now';
    else if (msUntil > 0 && msUntil <= 2 * 60 * 1000) cssClass += ' final-countdown';
    else if (msUntil > 2 * 60 * 1000 && msUntil < 10 * 60 * 1000) cssClass += ' starting-soon';

    let timeClass = 'time-until';
    if (msUntil > 0 && msUntil < 10 * 60 * 1000) timeClass = 'big-time';

    const el = document.createElement('div');
    const timeDisplay = isAllDayEvent(e) ? `<span>All Day</span>` : `<span>${formatTimeOnly(start)}</span><span class="event-duration">(${formatDurationMinutes(start, end)})</span>`;

    el.innerHTML = `
        <strong>${e.summary}</strong><br/>
        <span class="event-time-row">${timeDisplay}</span>
        <div class="${timeClass}">${formatDuration(msUntil)}</div>
      `;

    if (e.isCustom) {
        cssClass += ' custom-colored';
        if (e.bgColor) el.style.backgroundColor = e.bgColor;
        if (e.textColor) {
            el.style.color = e.textColor;
            el.querySelector('.event-duration').style.color = e.textColor;
            el.querySelector('.event-duration').style.opacity = '0.7';
        }
    }
    el.className = cssClass;
    el.dataset.id = e.uniqueId;
    el.dataset.start = e.start;
    el.dataset.end = e.end;
    // **CHANGE**: Clicking an event now opens the edit modal directly.
    el.onclick = () => openAddEventModal(e, true);

    // Add a class to trigger the animation
    el.classList.add('slide-in');
    // Force reflow to apply the animation
    void el.offsetWidth;
    el.classList.add('slide-in-active');

    return el;
}


/**
 * Filters and renders all visible events.
 */
function renderEvents() {
    const now = fakeNow ? new Date(fakeNow.getTime()) : new Date();

    const allVisibleEvents = eventManager.getVisibleEvents(now);

    const todaysAllDayEvents = [];
    const otherEvents = [];

    allVisibleEvents.forEach(e => {
        if (isAllDayEvent(e)) {
            const start = new Date(e.start);
            const end = new Date(e.end);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (today >= start && today < end) {
                todaysAllDayEvents.push(e);
            }
        } else {
            otherEvents.push(e);
        }
    });

    renderTodaysAllDayEvents(todaysAllDayEvents);

    let filtered = otherEvents;

    const currentCountParam = urlParams.get('count') || settings.count;

    if (/^\d+$/.test(currentCountParam)) {
        filtered = filtered.slice(0, parseInt(currentCountParam));
    } else if (currentCountParam === 'today') {
        filtered = filtered.filter(e => isSameDay(new Date(e.start), now));
    } else if (currentCountParam === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        filtered = filtered.filter(e => isSameDay(new Date(e.start), tomorrow) || isSameDay(new Date(e.start), now));
    } else if (currentCountParam === 'this_week') {
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);
        filtered = filtered.filter(e => new Date(e.start) <= endOfWeek);
    }

    const eventsDiv = document.getElementById('events');
    // Clear previous events and dividers
    eventsDiv.innerHTML = '<div id="drop-marker"></div>';

    let lastDateStr = '';
    filtered.forEach(e => {
        const start = new Date(e.start);
        const dateStr = start.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        if (dateStr !== lastDateStr && !isAllDayEvent(e)) {
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.textContent = dateStr;
            eventsDiv.appendChild(divider);
            lastDateStr = dateStr;
        }

        const eventElement = createEventElement(e, now);
        eventsDiv.appendChild(eventElement);
    });
}


/**
 * Fetches the event data from the source file and triggers a re-render.
 */
function fetchAndReloadData() {
    console.log('Reloading event data at', new Date().toLocaleTimeString());
    fetch(`${fileName}?_=${Date.now()}`)
        .then(r => r.text())
        .then(data => {
            if (fileName.endsWith(".csv")) {
                eventManager.loadFromCsv(data);
            }
            renderEvents();
        })
        .catch(err => console.error("Failed to reload file:", err));
}

/**
 * Schedules the data to be reloaded precisely on the next minute.
 */
function scheduleNextReload() {
    const now = fakeNow ? new Date(fakeNow.getTime()) : new Date();
    let msToNext = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    if (msToNext <= 0) msToNext += 60000;

    setTimeout(() => {
        fetchAndReloadData();
        setInterval(fetchAndReloadData, 60000);
    }, msToNext);
}

// --- Initial Application Setup ---
document.addEventListener('DOMContentLoaded', () => {
    setupSettingsModal();
    setupAddEventModal();
    setupDragAndDrop();
    setupClipboardPaste();
    fetchAndReloadData();
    setInterval(updateTime, 1000);
    scheduleNextReload();
});
