// Google Apps Script - Deploy as Web App
// Set: Execute as = Me, Who has access = Anyone

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

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
      case 'getWorkoutProgram':
        result = getSheetData('workout_program');
        break;
      case 'getYogaLog':
        result = getSheetData('yoga_log');
        break;
      case 'getYogaPresets':
        result = getYogaPresets();
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
      case 'logYoga':
        result = appendRow('yoga_log', [
          params.date,
          params.preset_name,
          params.completed === 'true',
          parseFloat(params.duration_minutes)
        ]);
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
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });

  return rows;
}

// Reads yoga_presets sheet and groups rows into preset objects.
// Sheet columns: preset_id | preset_name | preset_description | pose_index
//                | emoji | name | name_en | duration | guidance | voice_text
function getYogaPresets() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('yoga_presets');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });

  // Group by preset_id, preserving order by pose_index
  const map = {};
  const order = [];
  rows.forEach(r => {
    const id = String(r.preset_id);
    if (!map[id]) {
      map[id] = {
        id,
        name: r.preset_name,
        description: r.preset_description,
        poses: [],
      };
      order.push(id);
    }
    map[id].poses.push({
      emoji: r.emoji,
      name: r.name,
      nameEn: r.name_en,
      duration: Number(r.duration),
      guidance: r.guidance,
      voiceText: r.voice_text,
    });
  });

  return order.map(id => map[id]);
}

function appendRow(sheetName, values) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  sheet.appendRow(values);
  return { success: true };
}
