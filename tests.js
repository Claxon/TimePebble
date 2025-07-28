// This file contains the automated tests for the application logic.

QUnit.module('Utility Functions', function() {
  QUnit.test('isAllDayEvent should correctly identify all-day events', function(assert) {
    const allDayEvent = {
      start: '2025-07-28 00:00:00',
      end: '2025-07-29 00:00:00'
    };
    const regularEvent = {
      start: '2025-07-28 09:00:00',
      end: '2025-07-28 10:00:00'
    };
    const longRegularEvent = {
        start: '2025-07-28 09:00:00',
        end: '2025-07-29 09:00:00' // 24 hours but not starting at midnight
    }
    assert.ok(isAllDayEvent(allDayEvent), 'Correctly identifies a standard all-day event.');
    assert.notOk(isAllDayEvent(regularEvent), 'Correctly identifies a short regular event.');
    assert.notOk(isAllDayEvent(longRegularEvent), 'Correctly identifies a 24-hour event not starting at midnight as not all-day.');
  });

  QUnit.test('parseCSV should correctly parse CSV data', function(assert) {
    const csvData = `"subject","start","end","description","rsvp","private","ooo"
"Event 1","2025-07-28 09:00:00","2025-07-28 10:00:00","Desc 1","accepted","no","no"
"Event 2, with comma","2025-07-29 11:00:00","2025-07-29 12:00:00","Description with ""quotes""","tentative","yes","yes"`;
    const parsed = parseCSV(csvData);
    assert.equal(parsed.length, 2, 'Correctly parses the number of events.');
    assert.equal(parsed[0].summary, 'Event 1', 'Correctly parses the subject.');
    assert.equal(parsed[1].summary, 'Event 2, with comma', 'Correctly handles commas within quoted fields.');
    assert.equal(parsed[1].description, 'Description with "quotes"', 'Correctly handles escaped quotes within quoted fields.');
    assert.equal(parsed[1].private, 'yes', 'Correctly parses the private status.');
  });

  QUnit.test('parseCSV should handle edge cases', function(assert) {
    assert.deepEqual(parseCSV(""), [], "Returns an empty array for empty input.");
    assert.deepEqual(parseCSV('"header1","header2"'), [], "Returns an empty array for header-only input.");
    const malformed = `"subject","start"\n"Event1"`;
    assert.equal(parseCSV(malformed)[0].start, undefined, "Handles lines with missing fields gracefully.");
  });

  QUnit.test('formatDurationMinutes should format durations correctly', function(assert) {
      const start = new Date('2025-01-01T10:00:00');
      const end30min = new Date('2025-01-01T10:30:00');
      const end90min = new Date('2025-01-01T11:30:00');
      const end2hours = new Date('2025-01-01T12:00:00');
      assert.equal(formatDurationMinutes(start, end30min), "30 mins", "Correctly formats a 30-minute duration.");
      assert.equal(formatDurationMinutes(start, end90min), "1 hour 30 mins", "Correctly formats a 90-minute duration.");
      assert.equal(formatDurationMinutes(start, end2hours), "2 hours", "Correctly formats a 2-hour duration.");
  });

  QUnit.test('generateId should create consistent IDs', function(assert) {
    const event1 = { start: '2025-07-28T09:00:00Z', summary: 'My Event' };
    const event2 = { start: '2025-07-28T09:00:00Z', summary: 'My Event' };
    const event3 = { start: '2025-07-28T10:00:00Z', summary: 'My Event' };
    assert.equal(generateId(event1), generateId(event2), "Generates identical IDs for identical events.");
    assert.notEqual(generateId(event1), generateId(event3), "Generates different IDs for events with different times.");
  });
});

QUnit.module('Application Logic', {
  beforeEach: function() {
    // Reset state before each test
    eventsData = [];
    customEvents = [];
    hiddenEvents.clear();
    localStorage.clear();
    urlParams.delete('count');
    document.getElementById('qunit-fixture').innerHTML = `
        <div id="current-time"></div>
        <div id="all-day-container" style="display: none;"></div>
        <div id="events"><div id="drop-marker"></div></div>
    `;
  }
});

QUnit.test('cleanupHiddenEvents should remove expired hidden events', function(assert) {
  const now = new Date('2025-07-28T12:00:00Z');
  fakeNow = now; // Use the mocked time

  const expiredEvent = { summary: 'Expired', start: '2025-07-28T09:00:00Z', end: '2025-07-28T10:00:00Z' };
  const futureEvent = { summary: 'Future', start: '2025-07-29T09:00:00Z', end: '2025-07-29T10:00:00Z' };
  
  eventsData = [expiredEvent, futureEvent];
  hiddenEvents.add(generateId(expiredEvent));
  hiddenEvents.add(generateId(futureEvent));
  
  cleanupHiddenEvents();
  
  assert.notOk(hiddenEvents.has(generateId(expiredEvent)), 'Expired hidden event should be removed.');
  assert.ok(hiddenEvents.has(generateId(futureEvent)), 'Future hidden event should remain.');
  
  fakeNow = null; // Reset mock
});

QUnit.test('renderTodaysAllDayEvents should hide container if no all-day events', function(assert) {
    const now = new Date();
    renderTodaysAllDayEvents([], now);
    assert.equal(document.getElementById('all-day-container').style.display, 'none', 'Container is hidden when there are no all-day events.');
});

QUnit.test('renderTodaysAllDayEvents should show container with all-day events', function(assert) {
    const now = new Date('2025-07-28T12:00:00Z');
    const allDayEvents = [{
        summary: 'All Day Test',
        start: '2025-07-28 00:00:00',
        end: '2025-07-29 00:00:00'
    }];
    renderTodaysAllDayEvents(allDayEvents, now);
    assert.equal(document.getElementById('all-day-container').style.display, '', 'Container is visible.');
    assert.ok(document.querySelector('.all-day-event'), 'All-day event element is rendered.');
});

QUnit.test('renderEvents should filter events correctly based on countParam', function(assert) {
    const now = new Date('2025-07-28T08:00:00Z');
    fakeNow = now;
    
    eventsData = [
        { summary: 'Event 1 Today', start: '2025-07-28T09:00:00Z', end: '2025-07-28T10:00:00Z', rsvp: 'accepted', ooo: 'no' },
        { summary: 'Event 2 Today', start: '2025-07-28T11:00:00Z', end: '2025-07-28T12:00:00Z', rsvp: 'accepted', ooo: 'no' },
        { summary: 'Event Tomorrow', start: '2025-07-29T09:00:00Z', end: '2025-07-29T10:00:00Z', rsvp: 'accepted', ooo: 'no' }
    ];

    // Since rendering is now synchronous, we can assert immediately.
    urlParams.set('count', '1');
    renderEvents(now);
    assert.equal(document.querySelectorAll('#events .event').length, 1, "Correctly filters to the next 1 event.");

    urlParams.set('count', 'today');
    renderEvents(now);
    assert.equal(document.querySelectorAll('#events .event').length, 2, "Correctly filters to today's events.");

    urlParams.set('count', 'tomorrow');
    renderEvents(now);
    assert.equal(document.querySelectorAll('#events .event').length, 3, "Correctly filters to today's and tomorrow's events.");
    
    fakeNow = null;
    urlParams.delete('count');
});

QUnit.test('renderEvents should filter out declined and OOO events', function(assert) {
    const now = new Date('2025-07-28T08:00:00Z');
    fakeNow = now;

    eventsData = [
        { summary: 'Accepted Event', start: '2025-07-28T09:00:00Z', end: '2025-07-28T10:00:00Z', rsvp: 'accepted', ooo: 'no' },
        { summary: 'Declined Event', start: '2025-07-28T11:00:00Z', end: '2025-07-28T12:00:00Z', rsvp: 'declined', ooo: 'no' },
        { summary: 'OOO Event', start: '2025-07-29T09:00:00Z', end: '2025-07-29T10:00:00Z', rsvp: 'accepted', ooo: 'yes' }
    ];

    renderEvents(now);

    const rendered = document.querySelectorAll('#events .event');
    assert.equal(rendered.length, 1, "Only the accepted, non-OOO event should be rendered.");
    assert.equal(rendered[0].querySelector('strong').textContent, 'Accepted Event', "The correct event is rendered.");
    fakeNow = null;
});


QUnit.test('renderEvents should correctly merge and override with customEvents', function(assert) {
    const now = new Date('2025-07-28T08:00:00Z');
    fakeNow = now;

    const originalEvent = { summary: 'Team Meeting', start: '2025-07-28T09:00:00Z', end: '2025-07-28T10:00:00Z', rsvp: 'accepted', ooo: 'no' };
    eventsData = [originalEvent];
    
    // **FIX**: The overridden event must have a 'replacesId' property 
    // that points to the original event's ID to simulate the UI's behavior.
    const originalId = generateId(originalEvent);
    const overriddenEvent = { 
        ...originalEvent, 
        summary: 'UPDATED Team Meeting', 
        bgColor: '#ff0000', 
        replacesId: originalId // This is the crucial part that was missing
    };
    const newCustomEvent = { summary: 'My Custom Event', start: '2025-07-28T11:00:00Z', end: '2025-07-28T12:00:00Z', isCustom: true, rsvp: 'accepted', ooo: 'no' };
    customEvents = [overriddenEvent, newCustomEvent];

    renderEvents(now);

    const rendered = document.querySelectorAll('#events .event');
    assert.equal(rendered.length, 2, "Renders both the overridden and new custom event.");
    
    const renderedSummaries = Array.from(rendered).map(el => el.querySelector('strong').textContent);
    assert.ok(renderedSummaries.includes('UPDATED Team Meeting'), "Overridden event summary is displayed.");
    assert.ok(renderedSummaries.includes('My Custom Event'), "New custom event is displayed.");
    
    const updatedEl = Array.from(rendered).find(el => el.querySelector('strong').textContent === 'UPDATED Team Meeting');
    assert.ok(updatedEl, "The updated element should be found.");
    assert.equal(updatedEl.style.backgroundColor, 'rgb(255, 0, 0)', "Overridden event has custom background color.");

    fakeNow = null;
});
