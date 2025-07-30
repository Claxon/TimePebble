// This file contains the EventItem class and general-purpose helper functions.

/**
 * Represents a single event item, handling its data and unique ID.
 */
class EventItem {
    constructor({
        subject,
        start,
        end,
        description = "",
        rsvp = "none",
        private: isPrivate = "no",
        ooo = "no",
        entryid = null,
        isCustom = false,
        bgColor = null,
        textColor = null,
        images = []
    }) {
        this.summary = subject || "No Subject";
        this.start = start;
        this.end = end;
        this.description = description;
        this.rsvp = (rsvp || "none").toLowerCase();
        this.private = (isPrivate || "no").toLowerCase();
        this.ooo = (ooo || "no").toLowerCase();
        this.entryid = entryid; // The original ID from the source (e.g., CSV)
        this.isCustom = isCustom;
        this.bgColor = bgColor;
        this.textColor = textColor;
        this.images = images;
    }

    /**
     * Generates a deterministic unique ID for the event.
     * If an entryid from the source exists, it's used.
     * Otherwise, one is created from the start time and summary.
     * @returns {string} The unique ID for the event.
     */
    get uniqueId() {
        if (this.entryid) {
            return this.entryid;
        }
        // Fallback for events without a source-provided unique ID
        return `${this.start}_${this.summary}`;
    }

    /**
     * Creates an EventItem instance from a raw CSV object.
     * @param {object} csvRow - A raw object parsed from a CSV row.
     * @returns {EventItem} A new EventItem instance.
     */
    static fromCsv(csvRow) {
        return new EventItem({
            subject: csvRow.subject,
            start: csvRow.start,
            end: csvRow.end,
            description: csvRow.description,
            rsvp: csvRow.rsvp,
            private: csvRow.private,
            ooo: csvRow.ooo,
            entryid: csvRow.entryid
        });
    }

    /**
     * Creates an EventItem instance from a generic object (e.g., from localStorage).
     * @param {object} obj - The object to convert.
     * @returns {EventItem} A new EventItem instance.
     */
    static fromObject(obj) {
        return new EventItem({
            subject: obj.summary,
            start: obj.start,
            end: obj.end,
            description: obj.description,
            rsvp: obj.rsvp,
            private: obj.private,
            ooo: obj.ooo,
            entryid: obj.uniqueId || obj.entryid, // Carry over the ID
            isCustom: obj.isCustom,
            bgColor: obj.bgColor,
            textColor: obj.textColor,
            images: obj.images || []
        });
    }
}


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
 * Checks if an event is an all-day event.
 * @param {EventItem} e - The event object.
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
 * Parses CSV data into an array of event objects, handling quoted fields and newlines.
 * @param {string} text - The CSV string.
 * @returns {Array<object>} An array of event objects.
 */
function parseCSV(text) {
    //console.log("--- Starting CSV Parse ---");
    //console.log("Raw CSV Input:", text);
    if (!text) return [];

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuote = false;

    // Normalize line endings and add a newline at the end to ensure the last row is processed.
    text = text.trim().replace(/\r\n/g, '\n') + '\n';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuote) {
            if (char === '"' && nextChar === '"') {
                // This is an escaped quote (""), so add a single quote to the field
                currentField += '"';
                i++; // and skip the next character
            } else if (char === '"') {
                // This is the closing quote for a field
                inQuote = false;
            } else {
                // This is a regular character inside a quoted field
                currentField += char;
            }
        } else {
            if (char === '"') {
                // This is the opening quote for a field
                inQuote = true;
            } else if (char === ',') {
                // A comma separates fields
                currentRow.push(currentField);
                currentField = '';
            } else if (char === '\n') {
                // A newline separates rows
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            } else {
                // This is a regular character in an unquoted field
                currentField += char;
            }
        }
    }

    if (rows.length < 2) {
        console.warn("CSV parsing resulted in less than 2 rows. No data will be processed.");
        return [];
    }

    const headers = rows.shift().map(h => h.trim().toLowerCase().replace(/"/g, ''));
    //console.log("Detected Headers:", headers);

    const parsedData = rows.map(row => {
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = row[i] || undefined;
        });

        return {
            subject: obj["subject"],
            start: obj["start"],
            end: obj["end"],
            description: obj["description"],
            rsvp: obj["rsvp"],
            ooo: obj["ooo"],
            private: obj["private"],
            entryid: obj["entryid"]
        };
    }).filter(e => e.subject && e.start && e.end); // Filter out empty or invalid rows

    //console.log("Parsed Event Objects:", parsedData);
    //console.log("--- Finished CSV Parse ---");
    return parsedData;
}
