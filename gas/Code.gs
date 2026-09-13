// Google Apps Script - Deploy as Web App
// Set: Execute as = Me, Who has access = Anyone
//
// Sheets used:
//   workout_log   date | day_number | completed | duration_minutes | notes
//   yoga_log      date | preset_name | completed | duration_minutes
//   exercise_log  date | day_number | exercise | set_number | side | weight | reps
//   activity_log  date | activity | duration_hours | emoji
//   exercise_notes exercise | note | updated_at   (one row per exercise; created on demand)
//
// The `emoji` header on activity_log must exist for the app to read it back
// (rows are keyed by the header row); add it as column D if the sheet
// predates it. Older rows leave it blank and the app falls back to its
// built-in emoji for that activity.
//
// Note: workout_program and yoga_presets are no longer read by the app.
// Those menus now live in the source code.

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e.parameter;
  const action = params.action;

  let result;
  try {
    switch (action) {
      case 'getWorkoutLog':
        result = getSheetData('workout_log');
        break;
      case 'getYogaLog':
        result = getSheetData('yoga_log');
        break;
      case 'getExerciseLog':
        result = getSheetData('exercise_log');
        break;
      case 'getActivityLog':
        result = getSheetData('activity_log');
        break;
      // Per-exercise form cues, keyed by exercise name. Not a log: the same
      // exercise on Day 3 and Day 40 shares one note.
      case 'getExerciseNotes':
        result = getSheetData(getNotesSheet().getName());
        break;
      case 'saveExerciseNote':
        result = upsertExerciseNote(
          params.exercise,
          params.note || '',
          params.updated_at || new Date().toISOString()
        );
        break;
      case 'logWorkout':
        result = appendRow('workout_log', [
          params.date,
          parseInt(params.day_number),
          params.completed === 'true',
          parseFloat(params.duration_minutes),
          params.notes || ''
        ]);
        break;
      // Anything outside the program: skiing, a pole class, whatever.
      // Recorded in hours, since these are logged after the fact rather
      // than timed by the app. `emoji` is what the user picked for a
      // free-typed 其他 activity; blank for the quick-pick types.
      case 'logActivity':
        result = appendRow('activity_log', [
          params.date,
          params.activity,
          parseFloat(params.duration_hours),
          params.emoji || ''
        ]);
        break;
      case 'logYoga':
        result = appendRow('yoga_log', [
          params.date,
          params.preset_name,
          params.completed === 'true',
          parseFloat(params.duration_minutes)
        ]);
        break;
      // Bulk write: the whole session's sets in one request.
      // params.rows = JSON array of
      //   { date, day_number, exercise, set_number, side, weight, reps }
      case 'logExercises':
        result = appendRows('exercise_log', JSON.parse(params.rows).map(function (r) {
          return [
            r.date,
            parseInt(r.day_number),
            r.exercise,
            parseInt(r.set_number),
            r.side || '',
            parseFloat(r.weight) || 0,
            r.reps || ''
          ];
        }));
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  return data.slice(1).map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function appendRow(sheetName, values) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  sheet.appendRow(values);
  return { success: true };
}

function appendRows(sheetName, rows) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };
  if (!rows || rows.length === 0) return { success: true, count: 0 };

  sheet
    .getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
    .setValues(rows);
  return { success: true, count: rows.length };
}

// ─── Exercise notes ────────────────────────────────────────────
// The notes tab is created the first time it's needed, so adding this
// feature doesn't require touching the spreadsheet by hand.
var NOTES_SHEET = 'exercise_notes';
var NOTES_HEADERS = ['exercise', 'note', 'updated_at'];

function getNotesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NOTES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(NOTES_SHEET);
    sheet.appendRow(NOTES_HEADERS);
  }
  return sheet;
}

// One row per exercise: overwrite if the name already exists, else append.
function upsertExerciseNote(exercise, note, updatedAt) {
  if (!exercise) return { error: 'exercise is required' };
  var sheet = getNotesSheet();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(exercise)) {
      sheet.getRange(i + 1, 1, 1, 3).setValues([[exercise, note, updatedAt]]);
      return { success: true, updated: true };
    }
  }
  sheet.appendRow([exercise, note, updatedAt]);
  return { success: true, updated: false };
}
