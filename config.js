// This file handles the initial setup, configuration from URL parameters, 
// and management of the application's state.

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

let fakeNow = nowParam ? new Date(nowParam) : null;
let eventsData = [];

// Initial page setup based on config
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
