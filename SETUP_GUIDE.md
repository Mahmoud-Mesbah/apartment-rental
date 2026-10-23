# Apartment Rental System: Setup, Deployment and Testing Guide

Status: the code was written and checked for JavaScript syntax only (`node --check` on Code.gs and both script blocks, and every `include()` matches the whitelist). It has **not** been deployed, connected to your Google account, or tested against a real spreadsheet. Run the test checklist below before going live.

## 1. Architecture (short)

- **Google Sheets** = storage. Three sheets: `Apartments`, `Bookings`, `Settings`.
- **Code.gs** = all backend logic. Every public function returns `{success, message, ...}`; raw errors are only logged.
- **Index.html + Styles.html + JavaScript.html** = public site (single page: list, details, success screens).
- **Admin.html + AdminStyles.html + AdminJavaScript.html** = owner dashboard, opened with `?page=admin`.
- **appsscript.json** = manifest (timezone Africa/Cairo, minimal OAuth scopes).

Booking flow (all server-side in `createBooking`): validate input → check apartment exists → take script lock → re-read apartment + bookings → reject if UNAVAILABLE or an active CONFIRMED booking exists → price from the apartment record → append booking row → set apartment UNAVAILABLE + `activeBookingId` → release lock (in `finally`). The frontend only then builds the WhatsApp link.

Booking policy (intentional): the first accepted booking blocks the whole apartment until it is completed or cancelled.

Deviation from your function list: `generateUniqueBookingId` and the lock helpers are named `generateUniqueBookingId_` and `withLock_` (trailing underscore). In Apps Script, any function without a trailing underscore can be called from a visitor's browser, so internal helpers are hidden this way. `getPriceQuote` was added so the price shown in the form comes from the same server code that prices the booking.

## 2. Setup: what YOU must do manually

### Step 1: Create the spreadsheet
1. Go to sheets.google.com → Blank spreadsheet. Name it e.g. "Apartment Rental DB".
2. You do **not** need to create the sheets by hand: `setupProject()` creates them with headers. (If you prefer manual creation, use the exact names `Apartments`, `Bookings`, `Settings` and the exact column headers from your spec in row 1, plus `key | value | description` for Settings.)

### Step 2: Create the Apps Script project
1. In the spreadsheet: **Extensions → Apps Script** (this creates a container-bound project).
2. Project Settings (gear icon) → tick **Show "appsscript.json" manifest file in editor**.
3. Create/rename files so the names match **exactly** (case-sensitive):
   - `Code.gs` (rename the default `Code.gs`, paste the whole file)
   - `appsscript.json` (replace its content with the provided file)
   - HTML files via **+ → HTML**, typing the name without `.html`: `Index`, `Styles`, `JavaScript`, `Admin`, `AdminStyles`, `AdminJavaScript`. Paste each file's full contents.
4. Save (Ctrl+S).

### Step 3: Run the setup and authorize
1. In the editor, choose `setupProject` in the function dropdown → **Run**.
2. Review permissions and allow. (Scopes requested: Spreadsheets, script triggers, and your email. The email scope is needed to identify the owner.)
3. Open **Execution log**. It should report the sheets created, `OWNER_EMAIL`, and the trigger.
4. Optional: run `addSampleData` to insert 3 demo apartments (demo images come from picsum.photos; replace them with yours).

`setupProject` is safe to re-run: it never overwrites existing data and it does not create duplicate triggers.

### Step 4: Configure Settings (in the sheet)
Open the `Settings` sheet and fill column B:
- `ownerWhatsApp`: international digits only, no `+`, no leading zeros. Example format: `201000000000`.
- `websiteName`, `currency`, `contactPhone`, `contactEmail`, `contactAddress`.
- Pricing: `monthlyThresholdNights` (default 30) and `daysPerMonth` (default 30). Under the threshold: nights × daily price. At or above: full months × monthly price + remaining nights × daily price (remaining nights never cost more than one month).
- `defaultCountryCode` (default 20) converts local numbers such as `010...` to `2010...` for the admin WhatsApp button.

Do not put secrets in this sheet. None are needed.

### Step 5: Script Properties (Project Settings → Script Properties)
Created automatically by `setupProject`; check them:
- `OWNER_EMAIL`: your Google account email. Several owners can be separated by commas.
- `SPREADSHEET_ID`: set automatically. Never shown to visitors.

### Step 6: Expiry trigger
`setupProject` already calls `setupExpiryTrigger()`. To verify: left sidebar → **Triggers** → one entry for `expireBookings`, time-driven, every hour. You can also run `setupExpiryTrigger` yourself at any time; it never duplicates.

Note: Google time-driven triggers are not exact. An hourly trigger may fire at any point inside the hour, so a finished booking can keep the apartment UNAVAILABLE for up to roughly an hour or more after checkout (checkout date is treated as ended from 00:00 Cairo time on that date). You can also complete or cancel a booking immediately from the admin dashboard.

### Step 7: Deploy (two deployments of the same project)
Apps Script can only identify the signed-in owner when the app runs **as the visiting user**. The public site must run **as you** so visitors can book without access to your spreadsheet. Therefore use two deployments:

**Deployment A: public website**
1. **Deploy → New deployment → type: Web app**.
2. Description: "Public site". **Execute as: Me**. **Who has access: Anyone**.
3. Deploy, authorize, and copy the Web app URL. This is the link you share.

**Deployment B: owner dashboard**
1. **Deploy → New deployment → Web app**.
2. Description: "Admin". **Execute as: User accessing the web app**. **Who has access: Anyone with Google account**.
3. Copy this deployment's URL and add `?page=admin` at the end. Open it, sign in with the owner account, and approve the permissions.

Why this is secure: every `admin*` function calls `requireOwner_()`, which compares `Session.getActiveUser().getEmail()` with `OWNER_EMAIL`. On Deployment A the active user email is empty for visitors, so admin calls always fail (closed by default), even if someone calls the functions from the browser console. On Deployment B anyone with a Google account can open the URL, but non-owners only see a "not authorized" page and every admin call is rejected. They may see a Google permission prompt first; they still get no data.

Limitations to know:
- Do not use the admin URL from Deployment A: the owner cannot be identified there, so it will deny you.
- After editing code, update **both** deployments (Deploy → Manage deployments → pencil → New version).
- If your Google Workspace policy blocks "Anyone" access, contact your Workspace admin.
- `setupProject`, `setupExpiryTrigger` and `expireBookings` are callable by visitors too (Apps Script limitation) but are idempotent and harmless.

## 3. What is implemented in code vs manual

| Done by the code | Done by you |
|---|---|
| Sheets, headers, dropdowns, text formats, default settings, trigger | Create the spreadsheet and Apps Script project, paste files |
| Server validation, pricing, locking, duplicate-submit protection | Authorize scopes, create the two deployments |
| Booking/expiry/cancel logic, availability restoration | Fill `ownerWhatsApp` and contact settings |
| Owner authorization on every admin action | Make sure `OWNER_EMAIL` is correct |
| WhatsApp link generation | Press **Send** in WhatsApp (nothing is sent automatically) |

## 4. WhatsApp behavior
After the server confirms the booking, the success screen shows a button linking to `https://wa.me/<owner number>?text=<encodeURIComponent message>`. The message contains booking ID, apartment ID and title, customer name and phone, dates, duration, total price, and status. Opening it does **not** send anything; the customer must press Send, and the site never claims it was sent. If WhatsApp fails to open or is closed, the booking stays registered. The admin dashboard has a per-booking "Sent manually" marker (`notificationStatus`) that you set yourself.

## 5. Reliability and recovery
- **Duplicate submits:** the form sends a random `requestId`; the server caches the successful result for 6 hours, so a retry after a timeout returns the same booking instead of creating a second one.
- **Partial write:** the booking row is written first, then the apartment. If the apartment update fails, the booking row is deleted (rollback) and the customer gets an error.
- **If rollback also fails:** a CONFIRMED booking would exist while the apartment still shows AVAILABLE. This cannot cause a double booking, because `createBooking` also rejects when an active CONFIRMED booking exists. The hourly `expireBookings` run then re-syncs the apartment to UNAVAILABLE with the right `activeBookingId`. The same reconciliation clears an apartment left UNAVAILABLE with no active booking.
- **Manual unavailability:** an apartment you set UNAVAILABLE with no booking (e.g. maintenance) is left alone by the sync.
- Dates are stored as `yyyy-MM-dd` text and parsed with UTC math, avoiding timezone shifts. Nov 1 → Nov 5 = 4 nights.

## 6. Quotas and limits that matter
- Consumer Google accounts have daily limits on script runtime, triggers (about 90 min/day of trigger runtime), and spreadsheet reads/writes; Workspace accounts have higher limits.
- Each web request that reads sheets takes time; the app reads whole sheets, so it is meant for tens of apartments and thousands (not hundreds of thousands) of bookings.
- LockService waits up to 20 seconds; under heavy simultaneous load some visitors get "system is busy, try again".
- Web app responses can be slow on first load (cold start of a few seconds).
- Apps Script web apps show the page inside a Google sandbox iframe; the browser URL bar will not change between views.

## 7. Testing checklist

Do these on Deployment A (public) in a private window or another device, and on Deployment B for admin.

**Listing and details**
- [ ] Homepage lists apartments with image, title, location, price, rooms, status badge.
- [ ] Filters: location text, min/max price, rooms (4 = 4+), "available only"; empty state when nothing matches.
- [ ] Details page shows description, facilities, daily/monthly prices, gallery.

**Validation (the server should also reject these; to test server-side, temporarily skip client checks via a console call to `google.script.run.createBooking({...})`)**
- [ ] Missing name → Arabic error under the field.
- [ ] Invalid phone (`123`, letters) → error; `01012345678` and `+201012345678` accepted.
- [ ] Missing dates → errors.
- [ ] Check-out ≤ check-in → error.
- [ ] Past check-in → error.

**Booking**
- [ ] Price shown equals the formula (e.g. 4 nights × daily; 31 nights uses 1 month + 1 night).
- [ ] Successful booking: new `BK-1001` row in Bookings (CONFIRMED, `notificationStatus` NOT_SENT); apartment row UNAVAILABLE with `activeBookingId` = `BK-1001`.
- [ ] Reload the site: the apartment shows "غير متاحة" and the form is hidden.
- [ ] Second booking attempt (different dates, other browser) → "الشقة غير متاحة للحجز حاليًا", no new row.
- [ ] Simultaneous attempts: open the same available apartment in two browsers/devices, fill both forms, press submit on both within a second. Exactly one booking row must exist; the other gets the unavailable message.
- [ ] Double-click the submit button: only one booking (button disables; `requestId` also protects server-side).

**WhatsApp**
- [ ] Success screen shows booking details and the WhatsApp button only after success.
- [ ] Message text contains all required fields with the real data.
- [ ] WhatsApp opens with the message pre-filled but **not sent**; closing it leaves the booking intact.
- [ ] With `ownerWhatsApp` empty, the page shows the fallback note instead of a broken link.

**Admin (Deployment B)**
- [ ] Owner sees stats (total, available, unavailable, current bookings).
- [ ] Add an apartment (ID auto-generated `APT-004`); edit price, images, status; invalid image URL is rejected.
- [ ] Cannot set an apartment AVAILABLE while it has an active confirmed booking.
- [ ] Search bookings by booking ID, name, phone; filter by status and check-in range.
- [ ] Cancel a booking → booking CANCELLED and apartment AVAILABLE with empty `activeBookingId`.
- [ ] Complete a booking (only once it has started) → same restoration.
- [ ] Authorization: open the admin URL with a different Google account → denied page; open `?page=admin` on Deployment A → denied; in the browser console on the public site run `google.script.run.withSuccessHandler(console.log).adminGetDashboard()` → returns `FORBIDDEN` and no data.

**Expiry**
- [ ] Create a booking, then in the sheet change its `endDate` to today (text `yyyy-MM-dd`) and run `expireBookings` from the editor: booking becomes COMPLETED, apartment AVAILABLE, `activeBookingId` cleared. Run it again: no further changes (idempotent).
- [ ] Confirm only one `expireBookings` trigger exists after running `setupExpiryTrigger` twice.

**Failures**
- [ ] Temporarily rename the `Bookings` sheet: the site shows a friendly Arabic error, no stack trace. Rename it back.
- [ ] Remove the owner's edit access (or test with a viewer-only account on Deployment B): admin actions fail with a generic error.
- [ ] Go offline while submitting: the form shows the network message; pressing submit again after reconnecting does not create a duplicate if the first request had succeeded.

## 8. Troubleshooting
- **"Sorry, unable to open the file at this time"**: you are signed into multiple Google accounts; open the URL in a private window or add `/u/0/`-style account handling, or sign in with only one account.
- **Blank page / "include not allowed"**: file names in the editor don't match exactly (`Styles`, `JavaScript`, `AdminStyles`, `AdminJavaScript`).
- **"قاعدة البيانات غير مهيّأة بعد"**: run `setupProject`; check sheet names.
- **"بنية قاعدة البيانات غير صحيحة"**: a required header is missing or renamed in row 1 (see Execution log for the name).
- **Admin shows "غير مصرح" for you**: you are on Deployment A, or `OWNER_EMAIL` doesn't match the signed-in account, or the deployment's execution setting isn't "User accessing the web app".
- **Code changes don't appear**: create a **new version** on each deployment.
- **Authorization popup loops**: run any function once from the editor and accept scopes; if you changed `oauthScopes`, re-authorize.
- **Images don't show**: use direct image URLs or a Google Drive share link set to "Anyone with the link".
- **Apartment stuck UNAVAILABLE**: wait for the hourly trigger, run `expireBookings` manually, or cancel/complete the booking from the dashboard.
