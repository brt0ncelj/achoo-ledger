// Achoo Ledger → Google Sheet sync
// Paste this into Extensions → Apps Script of your Sheet, then deploy as a Web app.

const SHEET = 'Log';
const HEAD = ['Time', 'Event', 'Phone local time', 'Unix ms', 'ID', 'Location'];

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
  // Older sheets: add the Location header if it's missing
  if (sh.getRange(1, 6).getValue() !== 'Location') sh.getRange(1, 6).setValue('Location');
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ops = (JSON.parse(e.postData.contents).ops) || [];
    const sh = sheet_();
    const last = sh.getLastRow();
    const ids = last > 1 ? sh.getRange(2, 5, last - 1, 1).getValues().map(r => String(r[0])) : [];
    const idx = new Map(ids.map((id, i) => [id, i + 2]));
    const newRows = new Map();
    const dels = [];

    for (const op of ops) {
      const id = String(op.id);
      if (op.op === 'add') {
        if (!idx.has(id) && !newRows.has(id)) {
          newRows.set(id, [new Date(op.t), op.k === 'p' ? 'antihistamine' : 'sneeze', op.iso, op.t, id, op.l || '']);
        }
      } else if (op.op === 'del') {
        if (newRows.has(id)) newRows.delete(id);
        else if (idx.has(id)) { dels.push(idx.get(id)); idx.delete(id); }
      }
    }

    dels.sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
    if (newRows.size) {
      const rows = [...newRows.values()];
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEAD.length).setValues(rows);
    }
    return json_({ ok: true, added: newRows.size, removed: dels.length, total: sh.getLastRow() - 1 });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Open the web app URL in a browser to test: it should show {"ok":true,...}
function doGet() {
  return json_({ ok: true, total: sheet_().getLastRow() - 1 });
}
