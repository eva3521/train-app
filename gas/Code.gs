// Google Apps Script - Deploy as Web App
// Set: Execute as = Me, Who has access = Anyone
//
// Sheets used:
//   workout_log   date | day_number | completed | duration_minutes | notes
//   yoga_log      date | preset_name | completed | duration_minutes
//   exercise_log  date | day_number | exercise | set_number | side | weight | reps
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
      // than timed by the app.
      case 'logActivity':
        result = appendRow('activity_log', [
          params.date,
          params.activity,
          parseFloat(params.duration_hours)
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
