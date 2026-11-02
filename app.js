/**
 * Zyklus- und Perioden-Kalender
 * Schriftart: Helvetica / System Sans-Serif
 */

// Anwendungsstatus
const state = {
  currentDate: new Date(),
  selectedDate: new Date(),
  settings: {
    cycleLength: 28,     // Durchschnittliche Zykluslänge in Tagen
    periodLength: 5,     // Dauer der Blutung in Tagen
    lutealPhase: 14      // Lutealphase bis Eisprung vor nächster Periode
  },
  periodStarts: [],      // Array mit ISO-Strings 'YYYY-MM-DD'
  notes: {}              // Format: { 'YYYY-MM-DD': 'Notiztext' }
};

// Lokale Daten laden
function loadStoredData() {
  const savedStarts = localStorage.getItem('cycle_period_starts');
  if (savedStarts) {
    try {
      state.periodStarts = JSON.parse(savedStarts);
    } catch (e) {
      state.periodStarts = [];
    }
  }

  const savedNotes = localStorage.getItem('cycle_notes');
  if (savedNotes) {
    try {
      state.notes = JSON.parse(savedNotes);
    } catch (e) {
      state.notes = {};
    }
  }

  const savedSettings = localStorage.getItem('cycle_settings');
  if (savedSettings) {
    try {
      state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
    } catch (e) {
      // Standardwerte beibehalten
    }
  }
}

// Daten speichern
function persistData() {
  localStorage.setItem('cycle_period_starts', JSON.stringify(state.periodStarts));
  localStorage.setItem('cycle_notes', JSON.stringify(state.notes));
  localStorage.setItem('cycle_settings', JSON.stringify(state.settings));
}

// Datumshilfsfunktionen (Format YYYY-MM-DD)
function toDateKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Zyklus- und Fruchtbarkeitsberechnung
function getDayStatus(dateKey) {
  const targetDate = parseDateKey(dateKey);
  const targetTime = targetDate.getTime();

  // Sortierte Liste aller Perioden-Starttage
  const sortedStarts = [...state.periodStarts]
    .map(parseDateKey)
    .sort((a, b) => a - b);

  let isPeriod = false;
  let isFertile = false;
  let isOvulation = false;

  // 1. Zyklen aus den eingegebenen Startterminen + Prognosen für die nächsten 12 Zyklen
  const cyclesToEvaluate = [];

  sortedStarts.forEach((start) => {
    // Tatsächlich eingetragene Zyklen
    cyclesToEvaluate.push(start);
  });

  // Falls mindestens ein Start existiert: Zukünftige Zyklen hochrechnen
  if (sortedStarts.length > 0) {
    const lastKnown = sortedStarts[sortedStarts.length - 1];
    for (let i = 1; i <= 12; i++) {
      cyclesToEvaluate.push(addDays(lastKnown, i * state.settings.cycleLength));
    }
  }

  // Für jeden Zyklus Periode, Eisprung und fruchtbare Tage berechnen
  for (const cycleStart of cyclesToEvaluate) {
    const periodEnd = addDays(cycleStart, state.settings.periodLength - 1);
    
    // Nächster Zyklusbeginn (für Rückrechnung des Eisprungs)
    const nextCycleStart = addDays(cycleStart, state.settings.cycleLength);
    const ovulationDate = addDays(nextCycleStart, -state.settings.lutealPhase);
    
    // Fruchtbares Fenster: 5 Tage vor Eisprung bis 1 Tag danach
    const fertileStart = addDays(ovulationDate, -5);
    const fertileEnd = addDays(ovulationDate, 1);

    // Prüfen, ob das Datum in eine der Phasen fällt
    if (targetTime >= cycleStart.getTime() && targetTime <= periodEnd.getTime()) {
      isPeriod = true;
    }
    if (toDateKey(ovulationDate) === dateKey) {
      isOvulation = true;
    }
    if (targetTime >= fertileStart.getTime() && targetTime <= fertileEnd.getTime()) {
      isFertile = true;
    }
  }

  return { isPeriod, isFertile, isOvulation };
}

// Kalender-Rendering
const monthNames = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

function renderCalendar() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();

  // Titel aktualisieren
  const monthTitle = document.getElementById('monthYearTitle');
  if (monthTitle) {
    monthTitle.textContent = `${monthNames[month]} ${year}`;
  }

  const calendarDaysContainer = document.getElementById('calendarDays');
  if (!calendarDaysContainer) return;
  calendarDaysContainer.innerHTML = '';

  // Erster Tag des Monats (Montag als 1. Tag ausrichten: 0 = Mo, 6 = So)
  const firstDay = new Date(year, month, 1);
  let startingDayOfWeek = firstDay.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  // Letzter Tag des aktuellen Monats
  const lastDateOfMonth = new Date(year, month + 1, 0).getDate();

  // Letzter Tag des Vormonats (für Auffüll-Tage)
  const lastDateOfPrevMonth = new Date(year, month, 0).getDate();

  const todayKey = toDateKey(new Date());
  const selectedKey = toDateKey(state.selectedDate);

  // 1. Tage des Vormonats auffüllen
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayNum = lastDateOfPrevMonth - i;
    const date = new Date(year, month - 1, dayNum);
    calendarDaysContainer.appendChild(createDayElement(date, true));
  }

  // 2. Tage des aktuellen Monats
  for (let day = 1; day <= lastDateOfMonth; day++) {
    const date = new Date(year, month, day);
    calendarDaysContainer.appendChild(createDayElement(date, false, todayKey, selectedKey));
  }

  // 3. Tage des Folgemonats auffüllen (auf 35 bzw. 42 Zellen)
  const totalRendered = startingDayOfWeek + lastDateOfMonth;
  const remainingCells = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
  for (let i = 1; i <= remainingCells; i++) {
    const date = new Date(year, month + 1, i);
    calendarDaysContainer.appendChild(createDayElement(date, true));
  }

  updateDetailsPanel();
}

function createDayElement(date, isOutsideMonth, todayKey = null, selectedKey = null) {
  const dateKey = toDateKey(date);
  const status = getDayStatus(dateKey);

  const dayCell = document.createElement('div');
  dayCell.className = 'day-cell';
  if (isOutsideMonth) dayCell.classList.add('outside-month');

  // Markierungen für Periode, Fruchtbarkeit & Eisprung
  if (status.isPeriod) dayCell.classList.add('is-period');
  if (status.isFertile) dayCell.classList.add('is-fertile');
  if (status.isOvulation) dayCell.classList.add('is-ovulation');

  if (dateKey === todayKey) dayCell.classList.add('is-today');
  if (dateKey === selectedKey) dayCell.classList.add('is-selected');

  // Punkt bei hinterlegten Notizen
  if (state.notes[dateKey]) {
    const noteBadge = document.createElement('span');
    noteBadge.className = 'note-dot';
    dayCell.appendChild(noteBadge);
  }

  const numberSpan = document.createElement('span');
  numberSpan.className = 'day-number';
  numberSpan.textContent = date.getDate();
  dayCell.appendChild(numberSpan);

  // Klick: Tag auswählen
  dayCell.addEventListener('click', () => {
    state.selectedDate = new Date(date);
    renderCalendar();
  });

  return dayCell;
}

// Detailanzeige & Bearbeitung für den ausgewählten Tag
function updateDetailsPanel() {
  const selectedKey = toDateKey(state.selectedDate);
  const status = getDayStatus(selectedKey);

  const selectedDateLabel = document.getElementById('selectedDateLabel');
  if (selectedDateLabel) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    selectedDateLabel.textContent = state.selectedDate.toLocaleDateString('de-DE', options);
  }

  // Phasenstatus
  const phaseStatusEl = document.getElementById('phaseStatus');
  if (phaseStatusEl) {
    if (status.isOvulation) {
      phaseStatusEl.textContent = 'Geschätzter Eisprung';
      phaseStatusEl.className = 'status-ovulation';
    } else if (status.isPeriod) {
      phaseStatusEl.textContent = 'Menstruation / Periode';
      phaseStatusEl.className = 'status-period';
    } else if (status.isFertile) {
      phaseStatusEl.textContent = 'Fruchtbares Fenster';
      phaseStatusEl.className = 'status-fertile';
    } else {
      phaseStatusEl.textContent = 'Geringe Fruchtbarkeit';
      phaseStatusEl.className = 'status-default';
    }
  }

  // Toggle-Button: Periodenstart setzen oder entfernen
  const periodToggleButton = document.getElementById('togglePeriodStartBtn');
  if (periodToggleButton) {
    const isStart = state.periodStarts.includes(selectedKey);
    periodToggleButton.textContent = isStart 
      ? 'Periodenstart an diesem Tag entfernen' 
      : 'Als Periodenbeginn festlegen';
  }

  // Notizfeld laden
  const notesTextarea = document.getElementById('dayNotesInput');
  if (notesTextarea) {
    notesTextarea.value = state.notes[selectedKey] || '';
  }
}

// Event-Listener & Steuerung initialisieren
function initListeners() {
  // Navigation: Vor / Zurück / Heute
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar();
  });

  document.getElementById('todayBtn')?.addEventListener('click', () => {
    state.currentDate = new Date();
    state.selectedDate = new Date();
    renderCalendar();
  });

  // Periodenbeginn an-/abwählen
  document.getElementById('togglePeriodStartBtn')?.addEventListener('click', () => {
    const key = toDateKey(state.selectedDate);
    const index = state.periodStarts.indexOf(key);

    if (index > -1) {
      state.periodStarts.splice(index, 1);
    } else {
      state.periodStarts.push(key);
      state.periodStarts.sort();
    }

    persistData();
    renderCalendar();
  });

  // Notizen speichern
  document.getElementById('saveNoteBtn')?.addEventListener('click', () => {
    const key = toDateKey(state.selectedDate);
    const textarea = document.getElementById('dayNotesInput');
    if (!textarea) return;

    const text = textarea.value.trim();
    if (text) {
      state.notes[key] = text;
    } else {
      delete state.notes[key];
    }

    persistData();
    renderCalendar();
  });

  document.getElementById('btnExportBackup')?.addEventListener('click', exportBackup);
  document.getElementById('importFileInput')?.addEventListener('change', importBackup);

  // Zyklus-Einstellungen ändern
  const cycleInput = document.getElementById('cycleLengthInput');
  const periodInput = document.getElementById('periodLengthInput');

  if (cycleInput) {
    cycleInput.value = state.settings.cycleLength;
    cycleInput.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val >= 20 && val <= 45) {
        state.settings.cycleLength = val;
        persistData();
        renderCalendar();
      }
    });
  }

  if (periodInput) {
    periodInput.value = state.settings.periodLength;
    periodInput.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val >= 2 && val <= 10) {
        state.settings.periodLength = val;
        persistData();
        renderCalendar();
      }
    });
  }
}

// Start der Anwendung
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  initListeners();
  renderCalendar();
});

// 1. Daten exportieren und als JSON-Datei herunterladen
function exportBackup() {
  const backupData = {
    version: 1,
    exportDate: new Date().toISOString(),
    periodStarts: state.periodStarts,
    notes: state.notes,
    settings: state.settings
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Erzeugt einen virtuellen Klick zum Herunterladen
  const a = document.createElement('a');
  const today = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `zyklus_backup_${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 2. Daten aus einer ausgewählten JSON-Datei einlesen
function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      // Prüfen, ob die Datei gültige Daten enthält
      if (Array.isArray(data.periodStarts) && typeof data.notes === 'object') {
        state.periodStarts = data.periodStarts;
        state.notes = data.notes;
        if (data.settings) {
          state.settings = { ...state.settings, ...data.settings };
        }

        // Im localStorage sichern und Kalender neu zeichnen
        persistData();
        renderCalendar();

        alert('Backup erfolgreich wiederhergestellt!');
      } else {
        alert('Die ausgewählte Datei enthält kein gültiges Backup-Format.');
      }
    } catch (err) {
      alert('Fehler beim Lesen der Datei. Bitte prüfe die JSON-Datei.');
    }
  };

  reader.readAsText(file);
  // Zurücksetzen, damit dieselbe Datei erneut ausgewählt werden kann
  event.target.value = '';
}