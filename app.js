// This is the main application script that orchestrates everything.

/**
 * Removes old hidden event IDs from localStorage.
 */
function cleanupHiddenEvents() {
    const now = fakeNow ? new Date(fakeNow.getTime()) : new Date();
    let changed = false;
    const allKnownEvents = [...eventsData, ...customEvents];
    
    hiddenEvents.forEach(id => {
        const event = allKnownEvents.find(e => generateId(e) === id);
        if (!event || new Date(event.end) < now) {
            hiddenEvents.delete(id);
            changed = true;
        }
    });

    if (changed) {
        localStorage.setItem('hiddenEvents', JSON.stringify(Array.from(hiddenEvents)));
    }
}

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
 * @param {Array<object>} events - The list of all-day events.
 * @param {Date} now - The current date.
 */
function renderTodaysAllDayEvents(events, now) {
    const container = document.getElementById('all-day-container');
    container.innerHTML = '';

    if (events.length > 0) {
        container.style.display = '';
        const title = document.createElement('div');
        title.className = 'all-day-title';
        title.textContent = "Today's All-Day Events";
        container.appendChild(title);

        events.forEach(e => {
            const el = document.createElement('div');
            el.className = 'all-day-event';
            el.textContent = e.summary;
            if (e.bgColor) el.style.backgroundColor = e.bgColor;
            if (e.textColor) el.style.color = e.textColor;
            el.onclick = () => showDetailsById(generateId(e));
            container.appendChild(el);
        });
    } else {
        container.style.display = 'none';
    }
}

/**
 * Renders a single event element.
 * @param {object} e - The event object.
 * @param {Date} now - The current date.
 * @returns {HTMLElement} The event element.
 */
function createEventElement(e, now) {
    const id = generateId(e);
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
        <div class="event-drop-zone">Drop Images</div>
      `;

    if (e.isCustom || customEvents.find(ce => generateId(ce) === id)) {
        const customEventData = customEvents.find(ce => generateId(ce) === id) || e;
        cssClass += ' custom-colored';
        if (customEventData.bgColor) el.style.backgroundColor = customEventData.bgColor;
        if (customEventData.textColor) {
            el.style.color = customEventData.textColor;
            el.querySelector('.event-duration').style.color = customEventData.textColor;
            el.querySelector('.event-duration').style.opacity = '0.7';
        }
    }
    el.className = cssClass;
    el.dataset.id = id;
    el.dataset.start = e.start;
    el.dataset.end = e.end;
    el.onclick = () => showDetailsById(id);

    // Add a class to trigger the animation
    el.classList.add('slide-in');
    // Force reflow to apply the animation
    void el.offsetWidth;
    el.classList.add('slide-in-active');

    return el;
}


/**
 * Filters and renders all visible events.
 * @param {Date} now - The current date.
 */
function renderEvents(now) {
  cleanupHiddenEvents();
  
  const allEventsMap = new Map();
  // First, add all base events from the CSV
  eventsData.forEach(e => allEventsMap.set(generateId(e), e));
  
  // Then, process custom events to correctly override or add
  customEvents.forEach(custom => {
    // A custom event that is an edit of another will have a 'replacesId' property.
    // This is now added during the save process in ui.js.
    if (custom.replacesId) {
        // This is an override. Delete the original it replaces from the map.
        allEventsMap.delete(custom.replacesId);
    }
    // Add the custom event itself to the map. This handles both brand new
    // custom events and the updated versions of overridden events, using their own ID.
    allEventsMap.set(generateId(custom), custom);
  });

  const allKnownEvents = Array.from(allEventsMap.values());

  const visibleEvents = allKnownEvents.filter(e => {
    const id = generateId(e);
    const isHidden = hiddenEvents.has(id) && !showHiddenOverride;

    // Defensive checks for properties that might be undefined or have extra whitespace
    const rsvpStatus = (e.rsvp || '').trim().toLowerCase();
    const oooStatus = (e.ooo || '').trim().toLowerCase();
    
    const isDeclined = rsvpStatus === 'declined';
    const isOOO = oooStatus === 'yes';

    // Ensure event has a valid end date before proceeding
    if (!e.end) return false;

    return !isHidden && !isDeclined && !isOOO && new Date(e.end) >= now;
  });

  const todaysAllDayEvents = [];
  const otherEvents = [];

  visibleEvents.forEach(e => {
      if (isAllDayEvent(e)) {
          // It's an all-day event. Check if it's for today.
          const start = new Date(e.start);
          const end = new Date(e.end);
          // Normalize 'now' to the start of the day for comparison
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

          // Check if today's date is on or after the start date and before the end date.
          if (today >= start && today < end) {
              todaysAllDayEvents.push(e);
          }
          // If it's an all-day event for another day, we simply ignore it 
          // and don't add it to `otherEvents` to prevent it from showing in the timed list.
      } else {
          // It's not an all-day event, so it's a timed event. Add it to the list.
          otherEvents.push(e);
      }
  });

  renderTodaysAllDayEvents(todaysAllDayEvents, now);

  let filtered = otherEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
  
  // **FIX**: Read the 'count' parameter directly from urlParams every time renderEvents is called.
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
        eventsData = parseCSV(data);
      }
      renderEvents(fakeNow ? new Date(fakeNow.getTime()) : new Date());
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
