# Table Jerseys v8

Public mobile-first Table Jerseys demo with a true orbiting Three.js finished-cover visualizer, OpenAI image generation through private Netlify Functions, and private Google Apps Script handoff to Google Drive + Google Sheets.

## v8 change
The public interface is deliberately cleaner for demo use. The two implementation notes requested for removal are gone:

- no “Courtesy visual proof” label inside the 3D display
- no artwork-mapping/API explanation under CREATE DESIGN

The proof controls remain explicit and complete:

- Front
- 3/4
- Left
- Right
- Back
- Top

The model can still be freely orbited vertically/horizontally and zoomed by touch or mouse. The 2D panel state remains the source of truth; the 3D object reads that state live.

## Architecture

1. User types a design prompt on the public Netlify site.
2. `/.netlify/functions/generate-design` calls OpenAI server-side.
3. The returned FRONT / TOP / WRAP artwork becomes the private current 2D panel state.
4. The Three.js fitted-cover model reads that state as live textures. Orbiting does not generate new images.
5. Client approves the current revision and presses DO IT.
6. `/.netlify/functions/approve-design` sends the frozen approved state to Google Apps Script.
7. Apps Script creates a private Drive job folder, saves artwork assets, creates the production SVG, writes a manifest JSON, and adds a row to the Jobs sheet.

The 2D panel state is authoritative. The 3D model is only a visual proof.

# A. Google Sheet setup

1. Create a blank Google Sheet named **Table Jerseys Production**.
2. Open **Extensions → Apps Script**.
3. Delete the default code and paste the full contents of `google-apps-script/Code.gs`.
4. Save.
5. In the function selector choose `setupTableJerseys` and click **Run**.
6. Authorize Google Sheets + Drive access using the Google account that will own production files.
7. Return to the spreadsheet. A `Jobs` tab will now exist.

The script creates these columns automatically:

A Timestamp
B Job ID
C Status
D Client Approved
E Revision
F Customer / Project
G Email
H Table L (in)
I Table W (in)
J Table H (in)
K Design Prompt
L Front Artwork JPG
M Top Artwork JPG
N Wrap Artwork JPG
O Production SVG
P Job JSON
Q Job Folder
R Source
S Version

Status values: APPROVED, PRINTED, CUT, SEWING, QC, SHIPPED, HOLD.

# B. Deploy Google Apps Script

1. Apps Script → **Deploy → New deployment**.
2. Type: **Web app**.
3. Description: `Table Jerseys Production API v8`.
4. Execute as: **Me**.
5. Who has access: **Anyone**.
6. Deploy and copy the URL ending in `/exec`.
7. Open that URL in a browser. It should return JSON containing `"ok":true` and `"version":"8.0"`.

Keep this URL. It becomes the Netlify environment variable `GOOGLE_SCRIPT_URL`.

# C. OpenAI image generation API

1. Sign in at the OpenAI API platform.
2. Create/select a project for Table Jerseys.
3. Add API billing/credits.
4. Create an API key.
5. Do not put the key into React/Vite code and do not commit it to GitHub.

v8 expects the secret in Netlify as:

`OPENAI_API_KEY`

The server-side generator uses `gpt-image-2` and calls the OpenAI image-generation endpoint. The default image quality is `medium`; you can override it with `OPENAI_IMAGE_QUALITY`.

# D. Local prerequisites

Install:

- Node.js 18.14+ (current LTS recommended)
- Git

From the project folder:

```powershell
npm install
npm run build
```

A successful build creates `dist/`.

For a basic local UI preview:

```powershell
npm run dev
```

The AI/Google Functions are intended to run on Netlify. For full local function emulation, use Netlify Dev if desired.

# E. GitHub

Create a private GitHub repository, for example `table-jerseys`.

In PowerShell from this project folder:

```powershell
git init
git add .
git commit -m "Table Jerseys v8"
git branch -M main
git remote add origin https://github.com/YOURNAME/table-jerseys.git
git push -u origin main
```

Use your real GitHub repository URL.

# F. Netlify deployment

1. Sign in to Netlify.
2. **Add new project → Import an existing project**.
3. Choose GitHub and select the Table Jerseys repository.
4. v8 includes `netlify.toml`; expected settings are:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Deploy.

# G. Netlify environment variables

Netlify project → **Project configuration → Environment variables**.

Add:

`OPENAI_API_KEY` = your OpenAI API secret

`GOOGLE_SCRIPT_URL` = your Google Apps Script `/exec` URL

Optional:

`OPENAI_IMAGE_QUALITY` = `medium`

After adding/changing environment variables, trigger a new deploy.

# H. Test the live demo

Open the Netlify URL on a phone.

1. Enter project name.
2. Enter prompt, e.g.:
   `Make a Smoking Aces BBQ fitted table jersey that looks like a brick smoker. Use weathered red brick on the front, back and sides. Make the top look like glowing charcoal under a black grill grate. Put a large distressed wood Smoking Aces BBQ sign on the front only.`
3. Press **CREATE DESIGN**.
4. Use the six proof buttons: Front, 3/4, Left, Right, Back, Top.
5. Drag the table to orbit in any direction; pinch/scroll to zoom.
6. Revise if required. Revising invalidates prior approval.
7. Check the approval box.
8. Press **DO IT**.
9. Open `Table Jerseys Production → Jobs`.
10. Click `Production SVG` or `Job Folder` to access/download the production assets.

# I. Source of truth

Private production geometry remains locked in Apps Script:

- Table: 72 × 30 × 29 in
- Top: 72 × 30 in
- Front: 72 × 29 in
- Back: 72 × 29 in
- Left: 30 × 29 in
- Right: 30 × 29 in
- Seam allowance: 0.5 in
- Bottom hem: 1.5 in

The browser does not control these dimensions.

# J. Current demo limitation

The production SVG is built at full physical dimensions, but the generated raster artwork is not yet guaranteed to be true 150-DPI artwork at full 72-inch size. For final production, add a high-resolution reconstruction/upscale + DPI validation stage before printing. This does not affect the v8 demo architecture.
