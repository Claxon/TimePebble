// This file manages all user interface elements and interactions.
// Features a modal-based editing flow with automatic saving and UI refinements.

/**
 * Updates the settings form with the current settings.
 */
function updateSettingsForm() {
    document.getElementById('file-setting').value = fileName;
    document.getElementById('private-setting').checked = privateOverride;
    document.getElementById('trans-setting').checked = transparentBg;
    document.getElementById('show-hidden-setting').checked = showHiddenOverride;
    document.getElementById('layout-setting').checked = layoutOverride === 'split';

    const customCountInput = document.getElementById('custom-count-input');
    const countValue = urlParams.get('count') || settings.count;

    if (/^\d+$/.test(countValue)) {
        document.getElementById('count-custom').checked = true;
        customCountInput.value = countValue;
        customCountInput.disabled = false;
    } else {
        const radio = document.getElementById(`count-${countValue}`);
        if (radio) radio.checked = true;
        else document.getElementById('count-tomorrow').checked = true; // Default
        customCountInput.disabled = true;
    }
}

/**
 * Saves the settings from the form to localStorage and reloads the page.
 */
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
    alert('Settings saved. The page will now reload to apply them.');
    window.location.href = window.location.pathname; // Reload without query params
}

/**
 * Sets up the event listeners for the settings modal.
 */
function setupSettingsModal() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');

    settingsBtn.onclick = () => {
        updateSettingsForm();
        setModalOpenState(true);
        settingsModal.style.display = 'flex';
    };

    const closeModal = () => {
        setModalOpenState(false);
        settingsModal.style.display = 'none';
    };

    settingsModal.querySelector('#settings-close-btn').onclick = closeModal;
    settingsModal.querySelector('#save-settings-btn').onclick = saveSettings;
    settingsModal.onclick = (e) => {
        if (e.target === settingsModal) closeModal();
    };

    const countRadios = document.querySelectorAll('input[name="count-type"]');
    const customCountInput = document.getElementById('custom-count-input');
    countRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            customCountInput.disabled = (radio.value !== 'custom');
            if (radio.value === 'custom') customCountInput.focus();
        });
    });
}

/**
 * Shows the details for a specific event in a fullscreen modal.
 * @param {string} id - The ID of the event to show.
 * @param {object} options - Display options, e.g., { glow: true }.
 */
function showDetailsById(id, options = {}) {
    const e = eventManager.getEventById(id);
    if (!e) {
        console.error("Sorry, event not found for ID:", id);
        return;
    }

    const fullscreen = document.getElementById('fullscreen');
    setModalOpenState(true);
    if (autoCloseTimeout) clearTimeout(autoCloseTimeout);

    fullscreen.className = (options.glow && !isAllDayEvent(e)) ? 'auto-glow' : '';
    if (options.glow && !isAllDayEvent(e)) {
        autoCloseTimeout = setTimeout(closeFullscreen, autoCloseDuration);
    }

    const startDate = new Date(e.start);
    const endDate = new Date(e.end);
    const dateString = startDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeString = isAllDayEvent(e) ? 'All Day' : `${formatTimeOnly(startDate)} &ndash; ${formatTimeOnly(endDate)}`;
    const isHidden = eventManager.hiddenEventIds.has(id);

    let descriptionHTML = '';
    if (privateOverride || e.private !== 'yes') {
        descriptionHTML = `
            <div class="details-image-gallery">
                ${(e.images || []).map(imgSrc => `<img src="${imgSrc}" onclick="showImageViewer('${imgSrc}')">`).join('')}
            </div>
            <p>${e.description.replace(/\n/g, '<br>') || '<i>No description</i>'}</p>
        `;
    } else {
        descriptionHTML = '<i>Details hidden</i>';
    }

    const hideIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const unhideIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
    const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

    document.getElementById('fullscreen-content').innerHTML = `
      <div class="details-card">
        <div class="card-toolbox-left">
            <button class="close-btn">&times;</button>
            <button id="edit-event-btn" class="toolbox-btn" title="Edit Event" data-id="${id}">${editIcon}</button>
            <button id="hide-event-btn" class="toolbox-btn" title="${isHidden ? 'Unhide Event' : 'Hide Event'}" data-id="${id}">${isHidden ? unhideIcon : hideIcon}</button>
            ${e.isCustom ? `<button id="delete-event-btn" class="toolbox-btn" title="Delete Event" data-id="${id}">${deleteIcon}</button>` : ''}
        </div>
        <div class="details-title">${e.summary}</div>
        <div class="details-row details-date"><span class="details-label">Date:</span> ${dateString}</div>
        <div class="details-row"><span class="details-label">Time:</span> ${timeString}</div>
        <div class="details-row"><span class="details-label">Duration:</span> ${formatDurationMinutes(startDate, endDate)}</div>
        <div class="details-description">
          <span class="details-label">Description:</span>
          <div>${descriptionHTML}</div>
        </div>
      </div>
    `;

    fullscreen.style.display = 'flex';

    const closeFullscreen = () => {
        fullscreen.style.display = 'none';
        if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
        setModalOpenState(false);
    };

    fullscreen.querySelector('.close-btn').onclick = closeFullscreen;
    fullscreen.querySelector('#edit-event-btn').onclick = () => {
        closeFullscreen();
        openAddEventModal(e, true);
    };
    fullscreen.querySelector('#hide-event-btn').onclick = () => {
        eventManager.toggleEventVisibility(id);
        renderEvents(); // Update main list
        showDetailsById(id); // Re-render the modal to update the icon
    };
    const deleteBtn = fullscreen.querySelector('#delete-event-btn');
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (confirm('Are you sure you want to delete this event permanently?')) {
                eventManager.deleteCustomEvent(id);
                closeFullscreen();
                renderEvents();
            }
        };
    }

    fullscreen.onclick = (event) => {
        if (event.target === fullscreen) closeFullscreen();
    };
}

/**
 * Toggles a class on the body to indicate if a modal is open.
 * @param {boolean} isOpen - Whether a modal is open.
 */
function setModalOpenState(isOpen) {
    document.body.classList.toggle('modal-open', isOpen);
}

/**
 * Reads all values from the event modal, creates an EventItem, and saves it.
 */
function autoSaveEventFromModal() {
    const summary = document.getElementById('event-summary').value;
    if (!currentlyEditingEventId && !summary.trim()) return;

    const eventDataObject = {
        subject: summary || 'New Event',
        start: new Date(document.getElementById('event-start').value).toISOString(),
        end: new Date(document.getElementById('event-end').value).toISOString(),
        description: document.getElementById('event-description').value,
        images: imageUrls,
        bgColor: document.getElementById('event-bg-color').value,
        textColor: document.getElementById('event-text-color').value,
        isCustom: true,
        entryid: currentlyEditingEventId
    };

    const eventItem = new EventItem(eventDataObject);
    if (!currentlyEditingEventId) currentlyEditingEventId = eventItem.uniqueId;

    eventManager.saveCustomEvent(eventItem);
    renderEvents();
}

/**
 * Opens the "Add/Edit Event" modal, pre-filling it with data.
 * @param {EventItem | object} data - The event data to pre-fill the form with.
 * @param {boolean} isEditing - Whether this is an edit operation.
 */
function openAddEventModal(data = {}, isEditing = false) {
    const modal = document.getElementById('add-event-modal');
    setModalOpenState(true);
    modal.querySelector('.modal-title').textContent = isEditing ? 'Edit Event' : 'Add New Event';

    const now = new Date();
    now.setMinutes(now.getMinutes() + 30 - (now.getMinutes() % 30));
    const defaultStart = new Date(now);
    const defaultEnd = new Date(now.getTime() + 60 * 60 * 1000);

    currentlyEditingEventId = isEditing ? data.uniqueId : null;
    imageUrls = data.images ? [...data.images] : [];
    updateImagePreviewGallery();

    document.getElementById('event-summary').value = data.summary || '';
    document.getElementById('event-start').value = toLocalISOString(data.start ? new Date(data.start) : defaultStart);
    document.getElementById('event-end').value = toLocalISOString(data.end ? new Date(data.end) : defaultEnd);
    document.getElementById('event-description').value = data.description || '';
    document.getElementById('event-bg-color').value = data.bgColor || '#37474f';
    document.getElementById('event-text-color').value = data.textColor || '#eceff1';

    // Dynamically build the toolbox for the edit modal
    const toolbox = document.getElementById('edit-modal-toolbox');
    toolbox.innerHTML = ''; // Clear previous buttons

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => {
        modal.style.display = 'none';
        setModalOpenState(false);
    };
    toolbox.appendChild(closeBtn);

    if (isEditing) {
        const isHidden = eventManager.hiddenEventIds.has(data.uniqueId);
        const hideIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const unhideIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

        const hideBtn = document.createElement('button');
        hideBtn.className = 'toolbox-btn';
        hideBtn.title = isHidden ? 'Unhide Event' : 'Hide Event';
        hideBtn.innerHTML = isHidden ? unhideIcon : hideIcon;
        hideBtn.onclick = () => {
            eventManager.toggleEventVisibility(data.uniqueId);
            renderEvents();
            // Re-open/refresh the modal to show the new state
            openAddEventModal(eventManager.getEventById(data.uniqueId), true);
        };
        toolbox.appendChild(hideBtn);

        if (data.isCustom) {
            const deleteBtn = document.createElement('button');
            deleteBtn.id = 'delete-event-btn'; // Keep ID for styling if needed
            deleteBtn.className = 'toolbox-btn';
            deleteBtn.title = 'Delete Event';
            deleteBtn.innerHTML = deleteIcon;
            deleteBtn.onclick = () => {
                if (confirm('Are you sure you want to delete this event permanently?')) {
                    eventManager.deleteCustomEvent(data.uniqueId);
                    modal.style.display = 'none';
                    setModalOpenState(false);
                    renderEvents();
                }
            };
            toolbox.appendChild(deleteBtn);
        }
    }

    modal.style.display = 'flex';
}


/**
 * Updates the image preview gallery in the "Add/Edit Event" modal.
 */
function updateImagePreviewGallery() {
    const gallery = document.getElementById('image-preview-gallery');
    gallery.innerHTML = '';

    imageUrls.forEach((url, index) => {
        const container = document.createElement('div');
        container.className = 'thumbnail-container';
        const img = document.createElement('img');
        img.src = url;
        img.onclick = () => showImageViewer(url);
        const removeBtn = document.createElement('button');
        removeBtn.className = 'thumbnail-remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            imageUrls.splice(index, 1);
            updateImagePreviewGallery();
            autoSaveEventFromModal();
        };
        container.appendChild(img);
        container.appendChild(removeBtn);
        gallery.appendChild(container);
    });
}

/**
 * Sets up the event listeners for the "Add/Edit Event" modal.
 */
function setupAddEventModal() {
    const addBtn = document.getElementById('add-event-btn');
    const modal = document.getElementById('add-event-modal');
    const dropZone = document.getElementById('image-drop-zone');

    const inputs = modal.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        const eventType = input.type === 'color' || input.type === 'datetime-local' ? 'change' : 'input';
        input.addEventListener(eventType, autoSaveEventFromModal);
    });

    addBtn.onclick = () => openAddEventModal({}, false);

    const closeModal = () => {
        modal.style.display = 'none';
        setModalOpenState(false);
    };

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    dropZone.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
}

/**
 * Handles files dropped or pasted into the "Add/Edit Event" modal.
 * @param {FileList} files - The list of files to handle.
 */
function handleFiles(files) {
    [...files].forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e => {
                imageUrls.push(e.target.result);
                updateImagePreviewGallery();
                autoSaveEventFromModal();
            };
            reader.readAsDataURL(file);
        }
    });
}

/**
 * Sets up global drag and drop listeners for the main event list.
 */
function setupDragAndDrop() {
    const eventsContainer = document.getElementById('events');
    const dropMarker = document.getElementById('drop-marker');
    let lastY = 0;

    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => e.preventDefault());

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
        dropMarker.style.top = isAfter ? `${targetEl.offsetTop + targetEl.offsetHeight}px` : `${targetEl.offsetTop}px`;
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

        if (closestEl) {
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
                    end: new Date(dropTime.getTime() + 60 * 60 * 1000)
                };
                if (file.type.startsWith('image/')) {
                    prefill.images = [readEvent.target.result];
                } else {
                    prefill.description = readEvent.target.result;
                }
                openAddEventModal(prefill, false);
            };
            if (file.type.startsWith('image/')) reader.readAsDataURL(file);
            else reader.readAsText(file);
        } else {
            const text = e.dataTransfer.getData('text/plain');
            if (!text) return;
            openAddEventModal({ summary: text, start: dropTime, end: new Date(dropTime.getTime() + 60 * 60 * 1000) }, false);
        }
    });
}

/**
 * Sets up a global listener for paste events.
 */
function setupClipboardPaste() {
    window.addEventListener('paste', e => {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
        const isModalOpen = document.getElementById('add-event-modal').style.display === 'flex';
        if (isModalOpen && isTyping) return;

        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (isModalOpen) {
                    handleFiles([file]);
                } else {
                    const reader = new FileReader();
                    reader.onload = (event) => openAddEventModal({ images: [event.target.result] }, false);
                    reader.readAsDataURL(file);
                }
                return;
            }
        }

        if (!isTyping && !isModalOpen) {
            const text = e.clipboardData.getData('text/plain');
            if (text) openAddEventModal({ summary: text });
        }
    });
}

/**
 * Shows the image viewer modal with the specified image.
 * @param {string} src - The source URL of the image to display.
 */
function showImageViewer(src) {
    const modal = document.getElementById('image-viewer-modal');
    const viewerImg = modal.querySelector('img');
    setModalOpenState(true);
    document.body.classList.add('viewer-open');
    viewerImg.src = src;
    modal.style.display = 'flex';

    const closeViewer = () => {
        modal.style.display = 'none';
        document.body.classList.remove('viewer-open');
    };

    modal.querySelector('.close-btn').onclick = closeViewer;
    modal.onclick = (event) => {
        if (event.target === modal) {
            closeViewer();
        }
    };
}
