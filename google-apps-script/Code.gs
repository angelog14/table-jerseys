const TJ = {
  VERSION: '8.0',
  SHEET_NAME: 'Jobs',
  ROOT_FOLDER_NAME: 'Table Jerseys Production Files',

  // PRIVATE PRODUCTION GEOMETRY. Browser values never override this.
  TABLE: { length: 72, width: 30, height: 29 },
  PANELS: {
    top:   { width: 72, height: 30 },
    front: { width: 72, height: 29 },
    back:  { width: 72, height: 29 },
    left:  { width: 30, height: 29 },
    right: { width: 30, height: 29 }
  },
  SEAM_ALLOWANCE: 0.5,
  BOTTOM_HEM: 1.5,
  HEADERS: [
    'Timestamp','Job ID','Status','Client Approved','Revision','Customer / Project','Email',
    'Table L (in)','Table W (in)','Table H (in)','Design Prompt',
    'Front Artwork JPG','Top Artwork JPG','Wrap Artwork JPG','Production SVG','Job JSON','Job Folder','Source','Version'
  ]
};

function setupTableJerseys() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  let sheet = ss.getSheetByName(TJ.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(TJ.SHEET_NAME);
  sheet.clear();
  sheet.getRange(1,1,1,TJ.HEADERS.length).setValues([TJ.HEADERS]);
  sheet.getRange(1,1,1,TJ.HEADERS.length).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1,TJ.HEADERS.length,145);
  sheet.setColumnWidth(6,220);
  sheet.setColumnWidth(11,420);

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['APPROVED','PRINTED','CUT','SEWING','QC','SHIPPED','HOLD'], true)
    .build();
  sheet.getRange('C2:C').setDataValidation(statusRule);

  getOrCreateRootFolder_();
  SpreadsheetApp.flush();
}

function doGet() {
  return json_({ ok:true, service:'Table Jerseys Production API', version:TJ.VERSION });
}

function doPost(e) {
  try {
    if (!e || !e.parameter || !e.parameter.payload) throw new Error('Missing payload.');
    const input = JSON.parse(e.parameter.payload);
    if (input.approved !== true) throw new Error('Client approval is required.');
    if (!input.frontBase64 || !input.topBase64 || !input.wrapBase64) throw new Error('Complete approved artwork state is required.');

    const jobId = createJobId_();
    const root = getOrCreateRootFolder_();
    const folder = root.createFolder(jobId);
    const mime = input.mimeType || 'image/jpeg';

    const frontFile = saveImage_(folder, input.frontBase64, mime, jobId + '-front.jpg');
    const topFile = saveImage_(folder, input.topBase64, mime, jobId + '-top.jpg');
    const wrapFile = saveImage_(folder, input.wrapBase64, mime, jobId + '-wrap.jpg');

    // The downloadable layout is generated from the same 2D panel state that the 3D viewer displayed.
    const svg = buildProductionSvg_(jobId, input, mime, input.project || 'Untitled Project');
    const svgFile = folder.createFile(Utilities.newBlob(svg, 'image/svg+xml', jobId + '-production.svg'));

    const manifest = {
      jobId: jobId,
      createdAt: new Date().toISOString(),
      approved: true,
      revision: Number(input.revision) || 1,
      project: input.project || 'Untitled Project',
      email: input.email || '',
      prompt: input.prompt || '',
      source: input.source || 'table-jerseys-v8',
      version: TJ.VERSION,
      sourceOfTruth: '2D sew-pattern panel state',
      productionGeometry: {
        tableInches: TJ.TABLE,
        panels: TJ.PANELS,
        seamAllowanceInches: TJ.SEAM_ALLOWANCE,
        bottomHemInches: TJ.BOTTOM_HEM
      },
      assetMapping: {
        front: 'front artwork',
        top: 'top artwork',
        back: 'wrap artwork',
        left: 'wrap artwork',
        right: 'wrap artwork'
      },
      note: 'The 3D mockup is a courtesy visualization only. The 2D panel state is authoritative.'
    };
    const jsonFile = folder.createFile(Utilities.newBlob(JSON.stringify(manifest,null,2), 'application/json', jobId + '-job.json'));

    appendRow_([
      new Date(), jobId, 'APPROVED', 'YES', Number(input.revision)||1,
      input.project || 'Untitled Project', input.email || '',
      TJ.TABLE.length, TJ.TABLE.width, TJ.TABLE.height, input.prompt || '',
      frontFile.getUrl(), topFile.getUrl(), wrapFile.getUrl(), svgFile.getUrl(), jsonFile.getUrl(), folder.getUrl(),
      input.source || 'table-jerseys-v8', TJ.VERSION
    ]);

    return json_({ ok:true, jobId:jobId, revision:Number(input.revision)||1 });
  } catch (err) {
    return json_({ ok:false, error:err.message || String(err) });
  }
}

function saveImage_(folder, b64, mime, name) {
  return folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, name));
}

function buildProductionSvg_(jobId, input, mime, project) {
  const sa = TJ.SEAM_ALLOWANCE;
  const frontW=72, frontH=29, sideW=30, sideH=29, topW=72, topH=30, gap=2;
  const totalW = sa + sideW + gap + frontW + gap + sideW + sa;
  const totalH = sa + topH + gap + frontH + gap + frontH + sa;
  const xFront = sa + sideW + gap;
  const xLeft = sa;
  const xRight = xFront + frontW + gap;
  const yTop = sa;
  const yFront = yTop + topH + gap;
  const yBack = yFront + frontH + gap;

  const frontHref = 'data:' + mime + ';base64,' + input.frontBase64;
  const topHref = 'data:' + mime + ';base64,' + input.topBase64;
  const wrapHref = 'data:' + mime + ';base64,' + input.wrapBase64;

  function panel(x,y,w,h,label,href) {
    return '<g>' +
      '<image href="' + href + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="#111" stroke-width="0.12"/>' +
      '<text x="' + (x+.7) + '" y="' + (y+1.3) + '" font-family="Arial" font-size="0.8" fill="#fff" stroke="#000" stroke-width="0.03">' + label + '</text>' +
      '</g>';
  }

  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + totalW + 'in" height="' + totalH + 'in" viewBox="0 0 ' + totalW + ' ' + totalH + '">' +
    '<rect width="100%" height="100%" fill="#fff"/>' +
    panel(xFront,yTop,topW,topH,'TOP 72×30',topHref) +
    panel(xFront,yFront,frontW,frontH,'FRONT 72×29',frontHref) +
    panel(xFront,yBack,frontW,frontH,'BACK 72×29',wrapHref) +
    panel(xLeft,yFront,sideW,sideH,'LEFT 30×29',wrapHref) +
    panel(xRight,yFront,sideW,sideH,'RIGHT 30×29',wrapHref) +
    '<text x="1" y="' + (totalH-.5) + '" font-family="Arial" font-size="0.55" fill="#333">' +
      escapeXml_(jobId + ' · rev ' + (Number(input.revision)||1) + ' · ' + project + ' · seam ' + sa + ' in · bottom hem ' + TJ.BOTTOM_HEM + ' in') +
    '</text></svg>';
}

function appendRow_(row) {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Run setupTableJerseys() from the production spreadsheet first.');
  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheetByName(TJ.SHEET_NAME);
  if (!sheet) throw new Error('Jobs sheet not found. Run setupTableJerseys().');
  sheet.appendRow(row);
}

function getOrCreateRootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('ROOT_FOLDER_ID');
  if (existingId) {
    try { return DriveApp.getFolderById(existingId); } catch (_) {}
  }
  const it = DriveApp.getFoldersByName(TJ.ROOT_FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(TJ.ROOT_FOLDER_NAME);
  props.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function createJobId_() {
  const tz = Session.getScriptTimeZone() || 'Asia/Manila';
  const stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');
  const rand = Math.random().toString(36).substring(2,7).toUpperCase();
  return 'TJ-' + stamp + '-' + rand;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function escapeXml_(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
