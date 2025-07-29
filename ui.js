// This file manages all user interface elements and interactions.

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
    window.location.href = window.location.pathname;
}

/**
 * Sets up the event listeners for the settings modal.
 */
function setupSettingsModal() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('settings-close-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const countRadios = document.querySelectorAll('input[name="count-type"]');
    const customCountInput = document.getElementById('custom-count-input');

    settingsBtn.onclick = () => {
        updateSettingsForm();
        setModalOpenState(true);
        settingsModal.style.display = 'flex';
    };
    closeBtn.onclick = () => {
        setModalOpenState(false);
        settingsModal.style.display = 'none';
    }
    saveBtn.onclick = saveSettings;
    settingsModal.onclick = (e) => {
        if (e.target === settingsModal) {
            setModalOpenState(false);
            settingsModal.style.display = 'none';
        }
    };
    countRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            customCountInput.disabled = (radio.value !== 'custom');
        });
    });
}

/**
 * Shows the details for a specific event in a fullscreen modal.
 * @param {string} id - The ID of the event to show.
 * @param {object} options - Display options, e.g., { glow: true }.
 */
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

    if (options.glow && !isAllDayEvent(e)) {
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

/**
 * Toggles a class on the body to indicate if a modal is open.
 * @param {boolean} isOpen - Whether a modal is open.
 */
function setModalOpenState(isOpen) {
    document.body.classList.toggle('modal-open', isOpen);
}

/**
 * Opens the "Add/Edit Event" modal, pre-filling it with data if provided.
 * @param {object} data - The event data to pre-fill the form with.
 * @param {boolean} isEditing - Whether this is an edit operation.
 */
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
    } catch (e) {
        // Not a JSON description, treat as plain text
    }

    updateImagePreviewGallery();

    document.getElementById('event-summary').value = data.summary + " -- " + data.uniqueId || '';
    document.getElementById('event-start').value = toLocalISOString(data.start ? new Date(data.start) : defaultStart);
    document.getElementById('event-end').value = toLocalISOString(data.end ? new Date(data.end) : defaultEnd);
    document.getElementById('event-description').value = descriptionText;
    document.getElementById('event-bg-color').value = data.bgColor || '#37474f';
    document.getElementById('event-text-color').value = data.textColor || '#eceff1';

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

/**
 * Sets up the event listeners for the "Add/Edit Event" modal.
 */
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

/**
 * Handles files dropped or pasted into the application.
 * @param {FileList} files - The list of files to handle.
 */
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

/**
 * Sets up global drag and drop listeners.
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
                    prefill.image = readEvent.target.result;
                } else {
                    prefill.description = readEvent.target.result;
                }
                openAddEventModal(prefill, false);
            };

            if (file.type.startsWith('image/')) reader.readAsDataURL(file);
            else reader.readAsText(file);
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

/**
 * Sets up a global listener for paste events.
 */
function setupClipboardPaste() {
    window.addEventListener('paste', e => {
        const isModalOpen = document.getElementById('add-event-modal').style.display === 'flex';
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
    setModalOpenState(true);
    modal.querySelector('img').src = src;
    modal.style.display = 'flex';
    modal.querySelector('.close-btn').onclick = () => {
        modal.style.display = 'none';
        setModalOpenState(false);
    }
}
