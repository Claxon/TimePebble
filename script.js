const urlParams = new URLSearchParams(window.location.search);

const defaults = {
    file: 'calendar.csv',
    count: 'tomorrow',
    private: false,
    trans: false,
    showHidden: false,
    layout: 'top' // 'top' or 'split'
};
let settings = { ...defaults, ...JSON.parse(localStorage.getItem('eventSettings')) };
let hiddenEvents = new Set(JSON.parse(localStorage.getItem('hiddenEvents')) || []);
let customEvents = JSON.parse(localStorage.getItem('customEvents')) || [];
let imageUrls = []; // Temp store for image data URLs
let currentlyEditingEventId = null;

// URL parameters have priority over saved settings
const fileName = urlParams.get('file') || settings.file;
const countParam = urlParams.get('count') || settings.count;
const privateOverride = urlParams.has('private') ? urlParams.get('private') === '1' : settings.private;
const transparentBg = urlParams.has('trans') ? urlParams.get('trans') === '1' : settings.trans;
const showHiddenOverride = urlParams.has('showHidden') ? urlParams.get('showHidden') === '1' : settings.showHidden;
const layoutOverride = urlParams.get('layout') || settings.layout;


const nowParam = urlParams.get('now');
const shownEventDetails = new Set();
let autoCloseTimeout = null;
const autoCloseDuration = 10000;

if (transparentBg) {
  const style = document.createElement('style');
  style.textContent = `
    body { background: transparent !important; }
    #fullscreen, #add-event-modal { background: transparent !important; }
    .details-card, .event, .modal-card {
      background: rgba(30,40,60,0.8) !important;
    }
  `;
  document.head.appendChild(style);
}
if (layoutOverride === 'split') {
    document.body.classList.add('layout-split-column');
}


let fakeNow = nowParam ? new Date(nowParam) : null;
let eventsData = [];

// --- Settings Management Functions ---
function updateSettingsForm() {
    document.getElementById('file-setting').value = fileName;
    document.getElementById('private-setting').checked = privateOverride;
    document.getElementById('trans-setting').checked = transparentBg;
    document.getElementById('show-hidden-setting').checked = showHiddenOverride;
    document.getElementById('layout-setting').checked = layoutOverride === 'split';

    // Handle radio buttons for 'count'
    const customCountInput = document.getElementById('custom-count-input');
    if (/^\d+$/.test(countParam)) {
        document.getElementById('count-custom').checked = true;
        customCountInput.value = countParam;
        customCountInput.disabled = false;
    } else {
        const radio = document.getElementById(`count-${countParam}`);
        if (radio) radio.checked = true;
        else document.getElementById('count-tomorrow').checked = true; // Default
        customCountInput.disabled = true;
    }
}

function saveSettings() {
    let countValue;
    if (document.getElementById('count-custom').checked) {
        countValue = document.getElementById('custom-count-input').value || '3';
    } else {
        countValue = document.querySelector('input[name="count-type"]:checked').value;
    }

    const newSettings = {
        file: document.getElementById('file-setting').value,
        count: countValue,
        private: document.getElementById('private-setting').checked,
        trans: document.getElementById('trans-setting').checked,
        showHidden: document.getElementById('show-hidden-setting').checked,
        layout: document.getElementById('layout-setting').checked ? 'split' : 'top'
    };
    localStorage.setItem('eventSettings', JSON.stringify(newSettings));

    // Reload the page at its base path, clearing any URL params
    window.location.href = window.location.pathname;
}

function setupSettingsModal() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('settings-close-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const countRadios = document.querySelectorAll('input[name="count-type"]');
    const customCountInput = document.getElementById('custom-count-input');
    
    settingsBtn.onclick = () => {
        updateSettingsForm(); // Ensure form shows current settings
        setModalOpenState(true);
        settingsModal.style.display = 'flex'; // Use flex to center the panel
    };
    closeBtn.onclick = () => {
        setModalOpenState(false);
        settingsModal.style.display = 'none';
    }
    saveBtn.onclick = saveSettings;
    // Close if user clicks outside the panel
    settingsModal.onclick = (e) => {
        if (e.target === settingsModal) {
            setModalOpenState(false);
            settingsModal.style.display = 'none';
        }
    };

    // Enable/disable custom count input
    countRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            customCountInput.disabled = (radio.value !== 'custom');
        });
    });
}

function cleanupHiddenEvents() {
    const now = fakeNow ? new Date(fakeNow.getTime()) : new Date();
    let changed = false;
    const allKnownEvents = [...eventsData, ...customEvents];
    const allEventIds = new Set(allKnownEvents.map(generateId));
    
    hiddenEvents.forEach(id => {
        const event = allKnownEvents.find(e => generateId(e) === id);
        // Remove if event is over OR if it's no longer in the main data source
        if (!event || new Date(event.end) < now) {
            hiddenEvents.delete(id);
            changed = true;
        }
    });

    if (changed) {
        localStorage.setItem('hiddenEvents', JSON.stringify(Array.from(hiddenEvents)));
    }
}

function updateTime() {
  const now = fakeNow ? new Date(fakeNow.getTime()) : new Date();
  document.getElementById('current-time').innerText = now.toLocaleTimeString();
  if (fakeNow) fakeNow.setSeconds(fakeNow.getSeconds() + 1);

  // Only updates timers, does not trigger full render
  Array.from(document.querySelectorAll('.event')).forEach(el => {
    const start = new Date(el.dataset.start);
    const end = new Date(el.dataset.end);
    const msUntil = start - now;
    const msUntilEnd = end - now;
    const timeDiv = el.querySelector('.time-until, .big-time');

    // --- LOGIC TO UPDATE COLOURS/CLASSES DYNAMICALLY ---
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
      el.classList.remove('slide-in', 'slide-in-active');
      el.classList.add('slide-out');
      setTimeout(() => el.remove(), 500);
    }
    if (timeDiv) {
      timeDiv.className = (msUntil > 0 && msUntil < 10 * 60 * 1000) ? 'big-time' : 'time-until';
      timeDiv.textContent = msUntil > 0 ? formatDuration(msUntil) : (end > now ? 'Happening now' : 'Started');
    }
  });
}

function formatDurationMinutes(start, end) {
  const ms = end - start;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let text = '';
  if (hours > 0) text += `${hours} hour${hours !== 1 ? 's' : ''} `;
  if (minutes > 0 || hours === 0) text += `${minutes} min${minutes !== 1 ? 's' : ''}`;
  return text.trim();
}

function generateId(e) {
  // Custom events might not have a start time if created improperly, guard against it.
  const startTime = e.start || new Date().toISOString();
  return `${startTime}_${e.summary}`;
}

function isAllDayEvent(e) {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const durationHours = (end - start) / (1000 * 60 * 60);
    const startsAtMidnight = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0;
    // Use >= 23 hours to account for daylight saving changes
    return durationHours >= 23 && startsAtMidnight;
}

function renderTodaysAllDayEvents(events, now) {
    const container = document.getElementById('all-day-container');
    container.innerHTML = ''; // Clear previous content

    if (events.length > 0) {
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
    }
}

function renderEvents(now) {
  cleanupHiddenEvents();
  
  const allEventsMap = new Map();
  eventsData.forEach(e => allEventsMap.set(generateId(e), e));
  customEvents.forEach(e => allEventsMap.set(generateId(e), e));
  const allKnownEvents = Array.from(allEventsMap.values());

  const visibleEvents = allKnownEvents.filter(e => {
    const id = generateId(e);
    const isHidden = hiddenEvents.has(id) && !showHiddenOverride;

	return !isHidden && e.rsvp !== 'declined' && new Date(e.end) >= now && e.ooo !== 'yes';
  });

  const todaysAllDayEvents = [];
  const otherEvents = [];

  visibleEvents.forEach(e => {
      if (isAllDayEvent(e) && isSameDay(new Date(e.start), now)) {
          todaysAllDayEvents.push(e);
      } else {
          otherEvents.push(e);
      }
  });

  renderTodaysAllDayEvents(todaysAllDayEvents, now);

  let filtered = otherEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

  if (/^\d+$/.test(countParam)) {
    filtered = filtered.slice(0, parseInt(countParam));
  } else if (countParam === 'today') {
    filtered = filtered.filter(e => isSameDay(new Date(e.start), now));
  } else if (countParam === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    filtered = filtered.filter(e => isSameDay(new Date(e.start), tomorrow) || isSameDay(new Date(e.start), now));
  } else if (countParam === 'this_week') {
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);
    filtered = filtered.filter(e => new Date(e.start) <= endOfWeek);
  } else if (countParam !== 'all') {
    // This is a fallback, 'all' will show all timedEvents
  }

  const eventsDiv = document.getElementById('events');
  const existingEls = Array.from(eventsDiv.querySelectorAll('.event'));
  const newIds = filtered.map(generateId);
  const elsToRemove = existingEls.filter(el => !newIds.includes(el.dataset.id));
  const newEvents = filtered.filter(e => !document.querySelector(`[data-id="${generateId(e)}"]`));

  removeEventsSequentially(elsToRemove, () => {
    insertEventsSequentially(newEvents, now);
  });
}

function removeEventsSequentially(els, callback, index = 0) {
      if (index >= els.length) return callback();
      const el = els[index];
      el.classList.remove('slide-in', 'slide-in-active');
      el.classList.add('slide-out');

      const eventsDiv = document.getElementById('events');
      Array.from(eventsDiv.children).forEach(child => {
        if (child.classList && child.classList.contains('event') && child !== el) {
          child.classList.remove('slide-in', 'slide-in-active', 'slide-out');
        }
      });

      const prevRects = [];
      Array.from(eventsDiv.children).forEach(child => {
        if (child !== el && child.classList.contains('event')) {
          prevRects.push({
            el: child,
            top: child.getBoundingClientRect().top
          });
        }
      });

      setTimeout(() => {
        el.remove();

        const newRects = [];
        Array.from(eventsDiv.children).forEach(child => {
          if (child.classList.contains('event')) {
            newRects.push({
              el: child,
              top: child.getBoundingClientRect().top
            });
          }
        });

        newRects.forEach((newRect, i) => {
          const prevRect = prevRects.find(r => r.el === newRect.el);
          if (prevRect) {
            const dy = prevRect.top - newRect.top;
            if (dy) {
              newRect.el.classList.add('event-animating');
              newRect.el.style.transform = `translateY(${dy}px)`;
              void newRect.el.offsetWidth;
              newRect.el.style.transform = '';
              setTimeout(() => newRect.el.classList.remove('event-animating'), 500);
            }
          }
        });

        removeEventsSequentially(els, callback, index + 1);
      }, 500);
    }

function showDetailsById(id, options = {}) {
  const allEventsMap = new Map();
  eventsData.forEach(e => allEventsMap.set(generateId(e), e));
  customEvents.forEach(e => allEventsMap.set(generateId(e), e));
  const e = allEventsMap.get(id);

  if (!e) {
    console.error("Sorry, event not found for ID:", id);
    return;
  }

    const fullscreen = document.getElementById('fullscreen');
    setModalOpenState(true);
    if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = null;
    }
      
    if (options.glow && !isAllDayEvent(e)) { // Don't auto-glow for all-day events
        fullscreen.classList.add('auto-glow');
        autoCloseTimeout = setTimeout(() => {
          fullscreen.style.display = 'none';
          fullscreen.classList.remove('auto-glow');
          setModalOpenState(false);
        }, autoCloseDuration); 
    } else {
        fullscreen.classList.remove('auto-glow');
    }

  const startDate = new Date(e.start);
  const endDate = new Date(e.end);
  const dateString = startDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const startTime = formatTimeOnly(startDate);
  const endTime = formatTimeOnly(endDate);
  const duration = formatDurationMinutes(startDate, endDate);
  const rsvp = e.rsvp ? e.rsvp.charAt(0).toUpperCase() + e.rsvp.slice(1) : 'Accepted';
  const privacy = e.private === 'yes' ? "Private" : "Public";
  
  const isHidden = hiddenEvents.has(id);
  const buttonId = isHidden ? 'unhide-event-btn' : 'hide-event-btn';
  const buttonText = isHidden ? 'Unhide this event' : 'Hide this event';
  
  let actionButtonsHTML = `<div class="details-action-btn-group">`;
  // Any event can be edited. This will create a custom override if it's a calendar event.
  actionButtonsHTML += `<button id="edit-event-btn" class="details-action-btn" data-id="${id}">Edit</button>`;
  if (e.isCustom) {
      actionButtonsHTML += `<button id="delete-event-btn" class="details-action-btn" data-id="${id}">Delete</button>`;
  }
  actionButtonsHTML += `<button id="${buttonId}" class="details-action-btn" data-id="${id}">${buttonText}</button>`;
  actionButtonsHTML += `</div>`;
  
  let descriptionHTML = '';
  if (privateOverride || e.private !== 'yes') {
      try {
          const descObj = JSON.parse(e.description);
          if (descObj.images && descObj.images.length > 0) {
              descriptionHTML += '<div class="details-image-gallery">';
              descObj.images.forEach(imgSrc => {
                  descriptionHTML += `<img src="${imgSrc}" onclick="showImageViewer('${imgSrc}')">`;
              });
              descriptionHTML += '</div>';
          }
          if (descObj.text) {
              descriptionHTML += `<p>${descObj.text}</p>`;
          }
      } catch (err) {
          descriptionHTML = e.description || '<i>No description</i>';
      }
  } else {
      descriptionHTML = '<i>Details hidden</i>';
  }


  document.getElementById('fullscreen-content').innerHTML = `
      <div class="details-card">
        <button class="close-btn">&times;</button>
        <div class="details-title">${e.summary}</div>
        <div class="details-row details-date"><span class="details-label">Date:</span> ${dateString}</div>
        ${!isAllDayEvent(e) ? `<div class="details-row"><span class="details-label">Time:</span> ${startTime} &ndash; ${endTime}</div>` : ''}
        <div class="details-row"><span class="details-label">Duration:</span> ${duration}</div>
        <div class="details-row"><span class="details-label">RSVP:</span> ${rsvp}</div>
        <div class="details-row"><span class="details-label">Privacy:</span> ${privacy}</div>
        <div class="details-description">
          <span class="details-label">Description:</span>
          <div>${descriptionHTML}</div>
        </div>
        ${actionButtonsHTML}
      </div>
    `;
  
  const closeFullscreen = () => {
      document.getElementById('fullscreen').style.display = 'none';
      document.getElementById('fullscreen').classList.remove('auto-glow');
      if (window.autoCloseTimeout) { clearTimeout(window.autoCloseTimeout); autoCloseTimeout = null; }
      setModalOpenState(false);
  };

  document.querySelector('#fullscreen-content .close-btn').onclick = closeFullscreen;
  
  document.getElementById(buttonId).onclick = (evt) => {
      const eventIdToToggle = evt.target.dataset.id;
      if (hiddenEvents.has(eventIdToToggle)) {
          hiddenEvents.delete(eventIdToToggle);
      } else {
          hiddenEvents.add(eventIdToToggle);
      }
      localStorage.setItem('hiddenEvents', JSON.stringify(Array.from(hiddenEvents)));
      closeFullscreen();
      renderEvents(fakeNow || new Date());
  };

  document.getElementById('edit-event-btn').onclick = () => {
      closeFullscreen();
      openAddEventModal(e, true);
  };
  
  if (e.isCustom) {
      const deleteBtn = document.getElementById('delete-event-btn');
      let deleteTimeout = null;
      deleteBtn.onclick = (evt) => {
          if (deleteBtn.classList.contains('confirm-delete')) {
              const eventIdToDelete = evt.target.dataset.id;
              customEvents = customEvents.filter(event => generateId(event) !== eventIdToDelete);
              localStorage.setItem('customEvents', JSON.stringify(customEvents));
              closeFullscreen();
              renderEvents(fakeNow || new Date());
          } else {
              deleteBtn.classList.add('confirm-delete');
              deleteBtn.textContent = 'Confirm?';
              deleteTimeout = setTimeout(() => {
                  deleteBtn.classList.remove('confirm-delete');
                  deleteBtn.textContent = 'Delete';
              }, 3000);
          }
      };
  }

  fullscreen.style.display = 'flex';
}


function insertEventsSequentially(events, now, index = 0, lastDateStr = '') {
  if (index >= events.length) return;
  const e = events[index];
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

  const dateStr = start.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const eventsDiv = document.getElementById('events');

  if (dateStr !== lastDateStr && !isAllDayEvent(e)) {
      let needDivider = true;
      let insertBefore = null;

      for (let child of eventsDiv.children) {
        if (child.classList.contains('event')) {
          const childStart = new Date(child.dataset.start);
          const childDateStr = childStart.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

          if (dateStr === childDateStr) {
            if (child.previousElementSibling && child.previousElementSibling.classList.contains('date-divider') && child.previousElementSibling.textContent === dateStr) {
              needDivider = false;
            } else {
              insertBefore = child;
            }
            break;
          }
        }
      }

      if (needDivider) {
        const divider = document.createElement('div');
        divider.className = 'date-divider';
        divider.textContent = dateStr;
        if (insertBefore) {
          eventsDiv.insertBefore(divider, insertBefore);
        } else {
          eventsDiv.appendChild(divider);
        }
      }

      lastDateStr = dateStr;
    }


  const el = document.createElement('div');
  
  const timeDisplay = isAllDayEvent(e)
    ? `<span>All Day</span>`
    : `<span>${formatTimeOnly(start)}</span>
       <span class="event-duration">(${formatDurationMinutes(start, end)})</span>`;

  el.innerHTML = `
      <strong>${e.summary}</strong><br/>
      <span class="event-time-row">
        ${timeDisplay}
      </span>
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
  el.className = cssClass + ' slide-in';
  el.dataset.id = id;
  el.dataset.start = e.start;
  el.dataset.end = e.end;
  el.dataset.msUntil = msUntil;
  el.onclick = () => showDetailsById(id);

  // Direct drag-and-drop onto events
  el.addEventListener('dragover', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      el.classList.remove('drag-over');
  });
  el.addEventListener('drop', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      el.classList.remove('drag-over');
      
      const eventId = el.dataset.id;
      let eventToUpdate = customEvents.find(ev => generateId(ev) === eventId);
      let isNewOverride = false;

      if (!eventToUpdate) {
          const originalEvent = eventsData.find(ev => generateId(ev) === eventId);
          if (!originalEvent) return;
          eventToUpdate = { ...originalEvent, isCustom: true };
          isNewOverride = true;
      }

      const files = evt.dataTransfer.files;
      const imageFiles = [...files].filter(f => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      let imagesProcessed = 0;
      const newImageUrls = [];

      imageFiles.forEach(file => {
          const reader = new FileReader();
          reader.onload = (readEvent) => {
              newImageUrls.push(readEvent.target.result);
              imagesProcessed++;
              if (imagesProcessed === imageFiles.length) {
                  let descObj = {};
                  try { descObj = JSON.parse(eventToUpdate.description || '{}'); } 
                  catch (err) { descObj = { text: eventToUpdate.description || '' }; }
                  
                  descObj.images = [...(descObj.images || []), ...newImageUrls];
                  eventToUpdate.description = JSON.stringify(descObj);

                  if (isNewOverride) {
                      customEvents.push(eventToUpdate);
                  }
                  
                  localStorage.setItem('customEvents', JSON.stringify(customEvents));
                  renderEvents(fakeNow || new Date());
              }
          };
          reader.readAsDataURL(file);
      });
  });


    let inserted = false;
    for (let child of eventsDiv.children) {
      if (child.classList.contains('event')) {
        const childStart = new Date(child.dataset.start);
        if (start < childStart) {
          eventsDiv.insertBefore(el, child);
          inserted = true;
          break;
        }
      }
    }
    if (!inserted) eventsDiv.appendChild(el);
  void el.offsetWidth;
  el.classList.add('slide-in-active');

  setTimeout(() => insertEventsSequentially(events, now, index + 1, lastDateStr), 300);
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  let parts = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (totalSeconds < 60) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  return parts.join(' ');
}

function formatTimeOnly(date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

function toLocalISOString(date) {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, -1);
    return localISOTime.substring(0, 16);
}

function setModalOpenState(isOpen) {
    document.body.classList.toggle('modal-open', isOpen);
}

function openAddEventModal(data = {}, isEditing = false) {
    const modal = document.getElementById('add-event-modal');
    setModalOpenState(true);
    const title = modal.querySelector('.modal-title');
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30 - (now.getMinutes() % 30));
    const defaultStart = new Date(now);
    const defaultEnd = new Date(now.getTime() + 60 * 60 * 1000);
    
    currentlyEditingEventId = isEditing ? generateId(data) : null;
    title.textContent = isEditing ? 'Edit Event' : 'Add New Event';

    imageUrls = [];
    let descriptionText = data.description || '';
    try {
        const descObj = JSON.parse(data.description);
        if (descObj.images) imageUrls = [...descObj.images];
        if (descObj.hasOwnProperty('text')) descriptionText = descObj.text;
    } catch(e) {
        // Not a JSON description, treat as plain text
    }
    
    updateImagePreviewGallery();

    document.getElementById('event-summary').value = data.summary || '';
    document.getElementById('event-start').value = toLocalISOString(data.start ? new Date(data.start) : defaultStart);
    document.getElementById('event-end').value = toLocalISOString(data.end ? new Date(data.end) : defaultEnd);
    document.getElementById('event-description').value = descriptionText;
    document.getElementById('event-bg-color').value = data.bgColor || '#37474f';
    document.getElementById('event-text-color').value = data.textColor || '#eceff1';
    
    modal.style.display = 'flex';
}

function updateImagePreviewGallery() {
    const gallery = document.getElementById('image-preview-gallery');
    gallery.innerHTML = '';
    imageUrls.forEach((url, index) => {
        const container = document.createElement('div');
        container.className = 'thumbnail-container';
        
        const img = document.createElement('img');
        img.src = url;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'thumbnail-remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => {
            imageUrls.splice(index, 1);
            updateImagePreviewGallery();
        };
        
        container.appendChild(img);
        container.appendChild(removeBtn);
        gallery.appendChild(container);
    });
}

function setupAddEventModal() {
    const addBtn = document.getElementById('add-event-btn');
    const modal = document.getElementById('add-event-modal');
    const closeBtn = document.getElementById('add-event-close-btn');
    const saveBtn = document.getElementById('save-event-btn');
    const dropZone = document.getElementById('image-drop-zone');

    addBtn.onclick = () => openAddEventModal({}, false);

    closeBtn.onclick = () => {
        modal.style.display = 'none';
        setModalOpenState(false);
    }
    saveBtn.onclick = () => {
        const descriptionText = document.getElementById('event-description').value;
        let finalDescription;

        if (imageUrls.length > 0) {
            finalDescription = JSON.stringify({
                images: imageUrls,
                text: descriptionText
            });
        } else {
            finalDescription = descriptionText;
        }

        const eventData = {
            summary: document.getElementById('event-summary').value || 'New Event',
            start: new Date(document.getElementById('event-start').value).toISOString(),
            end: new Date(document.getElementById('event-end').value).toISOString(),
            description: finalDescription,
            bgColor: document.getElementById('event-bg-color').value,
            textColor: document.getElementById('event-text-color').value,
            isCustom: true
        };

        if (currentlyEditingEventId) {
            const index = customEvents.findIndex(e => generateId(e) === currentlyEditingEventId);
            if (index > -1) {
                customEvents[index] = eventData;
            } else {
                // This case handles overriding a calendar event for the first time
                customEvents.push(eventData);
            }
        } else {
            customEvents.push(eventData);
        }

        localStorage.setItem('customEvents', JSON.stringify(customEvents));
        modal.style.display = 'none';
        setModalOpenState(false);
        renderEvents(fakeNow || new Date());
    };

    // Drag and drop for the modal's drop zone
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', e => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
}

function handleFiles(files) {
    [...files].forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e => {
                imageUrls.push(e.target.result);
                updateImagePreviewGallery();
            };
            reader.readAsDataURL(file);
        }
    });
}

function setupDragAndDrop() {
    const eventsContainer = document.getElementById('events');
    const dropMarker = document.getElementById('drop-marker');
    let lastY = 0;

    window.addEventListener('dragover', e => {
        e.preventDefault();
    });
    window.addEventListener('drop', e => {
        e.preventDefault();
    });

    eventsContainer.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        
        let targetEl = e.target.closest('.event, .date-divider');
        if (!targetEl) {
            const children = Array.from(eventsContainer.children).filter(c => c.id !== 'drop-marker');
            targetEl = children[children.length - 1];
        }
        if (!targetEl) return;

        const rect = targetEl.getBoundingClientRect();
        const isAfter = e.clientY > rect.top + rect.height / 2;
        
        dropMarker.style.display = 'block';
        if (isAfter) {
            dropMarker.style.top = `${targetEl.offsetTop + targetEl.offsetHeight}px`;
        } else {
            dropMarker.style.top = `${targetEl.offsetTop}px`;
        }
        lastY = e.clientY;
    });

    eventsContainer.addEventListener('dragleave', e => {
        if (e.relatedTarget === null || !eventsContainer.contains(e.relatedTarget)) {
            dropMarker.style.display = 'none';
        }
    });

    eventsContainer.addEventListener('drop', e => {
        e.preventDefault();
        dropMarker.style.display = 'none';
        const now = fakeNow || new Date();
        let dropTime;

        const children = Array.from(eventsContainer.children).filter(c => c.classList.contains('event'));
        let closestEl = children.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = lastY - box.top - box.height / 2;
            return offset < 0 && offset > closest.offset ? { offset: offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
        
        if(closestEl) {
            const isAfter = lastY > closestEl.getBoundingClientRect().top + closestEl.offsetHeight / 2;
            dropTime = new Date(isAfter ? closestEl.dataset.end : closestEl.dataset.start);
        } else {
            dropTime = new Date(now);
            dropTime.setMinutes(now.getMinutes() + 30 - (now.getMinutes() % 30));
        }

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const reader = new FileReader();
            
            reader.onload = (readEvent) => {
                const prefill = {
                    summary: file.name.replace(/\.[^/.]+$/, ""),
                    start: dropTime,
                    end: new Date(dropTime.getTime() + 60*60*1000)
                };
                if (file.type.startsWith('image/')) {
                     prefill.image = readEvent.target.result;
                } else {
                     prefill.description = readEvent.target.result;
                }
                openAddEventModal(prefill, false);
            };
            
            if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        }
        else {
            const text = e.dataTransfer.getData('text/plain');
            if (!text) return;
            openAddEventModal({
                summary: text,
                start: dropTime,
                end: new Date(dropTime.getTime() + 60 * 60 * 1000)
            }, false);
        }
    });
}

function setupClipboardPaste() {
    window.addEventListener('paste', e => {
        const addEventModal = document.getElementById('add-event-modal');
        const isModalOpen = addEventModal.style.display === 'flex';

        const items = e.clipboardData.items;
        let foundImage = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                foundImage = true;
                const file = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (isModalOpen) {
                        imageUrls.push(event.target.result);
                        updateImagePreviewGallery();
                    } else {
                        openAddEventModal({ image: event.target.result }, false);
                    }
                };
                reader.readAsDataURL(file);
                break; 
            }
        }
        if (!foundImage && !isModalOpen) {
            const text = e.clipboardData.getData('text/plain');
            if (text) {
                openAddEventModal({ summary: text }, false);
            }
        }
    });
}

function showImageViewer(src) {
    const modal = document.getElementById('image-viewer-modal');
    setModalOpenState(true);
    modal.querySelector('img').src = src;
    modal.style.display = 'flex';
    modal.querySelector('.close-btn').onclick = () => {
        modal.style.display = 'none';
        setModalOpenState(false);
    }
}

function parseCSV(data) {
  const lines = data.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map(line => {
    const values = [];
    let current = '', inQuotes = false;
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { values.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
      else current += char;
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || "");
    return {
      summary: obj["subject"] || "No subject",
      start: obj["start"],
      end: obj["end"],
      description: obj["description"] || "",
      rsvp: (obj["rsvp"] || "").toLowerCase(),
      ooo: (obj["ooo"] || "").toLowerCase(),
      private: (obj["private"] || "").toLowerCase()
    };
  });
}

function fetchAndReloadData() {
  console.log('Reloading event data (fetchAndReloadData) at', new Date().toLocaleTimeString());
  
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

// --- Initial Setup ---
setupSettingsModal();
setupAddEventModal();
setupDragAndDrop();
setupClipboardPaste();
fetchAndReloadData();
setInterval(updateTime, 1000);

function scheduleNextReload() {
  const now = fakeNow ? new Date(fakeNow.getTime()) : new Date();
  let msToNext = (60 - now.getSeconds() + 1) % 60 * 1000 - now.getMilliseconds();
  if (msToNext <= 0) msToNext += 60000; // just in case
  console.log('msToNext:', msToNext);
  
  setTimeout(() => {
    fetchAndReloadData();
    setInterval(fetchAndReloadData, 60000); // After first precise reload, just repeat every minute
  }, msToNext);
}
scheduleNextReload();
