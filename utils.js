// This file contains all the general-purpose helper functions.

/**
 * Formats the duration between two dates into a string like "1 hour 30 mins".
 * @param {Date} start - The start date.
 * @param {Date} end - The end date.
 * @returns {string} The formatted duration.
 */
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

/**
 * Generates a unique ID for an event based on its start time and summary.
 * @param {object} e - The event object.
 * @returns {string} The unique event ID.
 */
function generateId(e) {
  const startTime = e.start || new Date().toISOString();
  return `${startTime}_${e.summary}`;
}

/**
 * Checks if an event is an all-day event.
 * @param {object} e - The event object.
 * @returns {boolean} True if the event is all-day.
 */
function isAllDayEvent(e) {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const durationHours = (end - start) / (1000 * 60 * 60);
    const startsAtMidnight = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0;
    // Use >= 23 hours to account for daylight saving changes
    return durationHours >= 23 && startsAtMidnight;
}

/**
 * Checks if two dates are on the same day.
 * @param {Date} d1 - The first date.
 * @param {Date} d2 - The second date.
 * @returns {boolean} True if the dates are on the same day.
 */
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 * @param {number} ms - The duration in milliseconds.
 * @returns {string} The formatted duration string.
 */
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

/**
 * Formats a date object to a time-only string (e.g., "5:30 PM").
 * @param {Date} date - The date to format.
 * @returns {string} The formatted time string.
 */
function formatTimeOnly(date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Converts a date object to a local ISO string for datetime-local input fields.
 * @param {Date} date - The date to convert.
 * @returns {string} The formatted string.
 */
function toLocalISOString(date) {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, -1);
    return localISOTime.substring(0, 16);
}

/**
 * Parses CSV data into an array of event objects, handling quoted fields.
 * @param {string} text - The CSV string.
 * @returns {Array<object>} An array of event objects.
 */
function parseCSV(text) {
    if (!text) return [];
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines.shift().split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    
    return lines.map(line => {
        const values = [];
        let inQuote = false;
        let currentField = '';
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuote && line[i+1] === '"') {
                    currentField += '"';
                    i++; // Skip next quote
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                values.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        values.push(currentField);

        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = values[i] || undefined;
        });

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
