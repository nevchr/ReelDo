# ReelDo

A local browser extension that organizes saved Instagram captions and TikTok favourites from page scans or local imports into topic lists. Movies get a watchlist, AI models and software go to Tech, and useful ideas populate Food, Fitness, Learn, Home, Travel, Money and Other. Entries use concise source labels with hover actions to modify the saved reel or open Instagram. Checklists, dates, stars, search and backups remain available.


## Page sync — version 0.5.0

The quickest workflow is now **open your saved page → click ReelDo → Sync saved**. Keep the existing installation folder in place, reload ReelDo on chrome://extensions or edge://extensions, and refresh the page and workspace.

- For Instagram, open Saved → a collection (or an individual reel). The toolbar recognises Instagram and offers **Sync Instagram saves**.
- For TikTok, open your profile's **Favourites / Favorites** tab (or an individual video). The toolbar offers **Sync TikTok favourites**. A recognisable selected Favourites tab or explicit favourites route scopes collection capture. If the layout does not identify the selected tab, ReelDo asks you to confirm the current profile view is Favourites before collecting. Posted, liked and reposted tabs, feeds, sign-in dialogs and verification challenges are blocked. Complete sign-in or verification yourself; ReelDo does not operate those controls.
- Leave **Sort readable captions with local rules** enabled to place grounded useful topics directly into your lists. Memes go to Filtered out and missing/ambiguous captions stay in Needs context. This uses local rules even if a model is configured; you can re-sort with your chosen workspace engine later. Turn the option off if you prefer to collect first and review/sort separately.
- Each sync is bounded to 25, 50 or 100 newly captured or repairable videos. Previously readable captures are skipped; missing captions remain eligible for retry. Repeated scans deduplicate by source ID and preserve tasks, manual context, notes, stars and checklist progress. **Revisit previously captured favourites** repairs earlier captures. The page progress panel has **Stop sync** and reports partial results; cancellation keeps captured data.
- TikTok capture reads only the selected page's rendered descriptions, caption-bearing attributes, or an individual video's already-loaded metadata. It scrolls the chosen grid to discover lazy-loaded items. It does not fetch individual video pages, call TikTok private APIs, download videos, transcribe audio, or infer tasks from links alone. Visible thumbnail images can be cropped into small local JPEGs through the existing activeTab capture path; full viewport screenshots are transient and never saved.
- Local JSON/TXT import remains available under **Import reels**, including when the browser does not expose your favourites or captions.

Production extension permissions and CSP are unchanged. Temporary access comes from the user invoking the toolbar action, using [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab). No always-on TikTok host access, account polling, persistent sign-in integration, or cross-device sync was added.

**Verification limit:** the TikTok scanner has been exercised on deterministic page fixtures in an isolated Edge profile, including the actual popup handler, scripting injection, worker messaging/storage, local thumbnail capture, lazy loading, incremental retries, bounded scans, confirmation, cancellation, immediate sorting, concurrent workspace edits and offline reload. Fixture tests use a separate copied extension with a test-only all-URLs grant to simulate a toolbar activeTab gesture; that grant is not in dist or the production ZIP. This is not proof that TikTok's current authenticated DOM or every favourites collection works. The user's signed-in Chrome could not be inspected: this delegated runtime exposes no trusted Node REPL browser service, IAB/Chrome control, or native screenshot/mouse tool; Chrome is running without a debugging connection. No browser access setup or security settings were changed.

An opt-in observer could watch save/favourite UI changes in a browser tab the user explicitly enables, then classify the currently visible video's caption. That is a possible follow-up, not an implemented or reliability-tested feature: it would need live DOM validation, save-success confirmation, source grounding, deduplication, and a visible start/stop control. It would not observe phone-app actions or other devices. A mobile share-to-ReelDo flow would require a separately supported receiving app or endpoint; this extension does not currently provide one.

Run **npm run test:tiktok-scan** for the scanner workflows; results and screenshots are saved under artifacts/tiktok-scan-*. The pre-scanner source safety copy is artifacts/pre-tiktok-scan-0.4.0.


## TikTok favourites — version 0.4.0

Reload the existing ReelDo extension on chrome://extensions or edge://extensions, then refresh its workspace. Keep the installed folder in place so its extension identity and local data remain available.

1. In TikTok, request **Download your data** in JSON format. See [TikTok's export instructions](https://support.tiktok.com/en/account-and-privacy/personalized-ads-and-data/requesting-your-data). Export availability and included fields can vary; this build cannot verify account access.
2. Download and extract the export ZIP yourself. Open ReelDo's workspace, choose **Import reels → Choose a file**, and select the JSON export. You can instead choose the export's **Favorite Videos.txt**, containing only favourite-video entries.
3. Review the unique-video, duplicate, invalid-record and missing-context counts, then choose **Import & review**. JSON parsing selects only explicitly named Favorite Videos / Favourite Videos / FavoriteVideoList sections. Other activity, liked videos, profile information, and watch history are not saved. TXT imports cannot infer whether a Date/Link list describes favourites; choose the favourites file specifically.
4. Choose **Sort my reels**. Links and saved dates alone do not describe a video: those entries go to **Needs context**. Open a saved entry, paste its actual caption or transcript, then choose **Save context & sort with local rules** to create a grounded topic-list entry.

You can also paste full TikTok video links followed by captions, mix them with Instagram links, or supply the existing array-of-reels JSON format. Accepted video paths include /@creator/video/ID, /video/ID, /v/ID.html and legacy tiktokv.com/share/video/ID links. Tracking parameters are removed. Video numbers are treated as strings and deduplicate across URL variants. TikTok IDs use a platform prefix; existing Instagram IDs remain stable.

Imports merge into the current workspace. Repeated exports preserve manually entered captions, decisions, dismissed entries, tasks, notes, completion, stars and checklist progress. Favourite dates survive backup/export restore. The preview combines duplicate records and reports skipped invalid export entries. Empty, malformed, unsupported, history-only, all-invalid, ZIP and oversized inputs have explicit errors. A file is limited to 10 MB and 2,000 records before deduplication; split larger favourites lists into smaller files.

This feature is **local export import fallback**, with no live account sync, official favourites API integration, background TikTok access, sign-in automation, video downloading, automatic captions, thumbnails or transcription. Short vm.tiktok.com / vt.tiktok.com / tiktok.com/t/ share links need to be opened by the user and replaced with the complete video URL. No new extension permissions or network origins were added. TikTok entries display source labels and use the existing category image fallback.

Development additions: **npm run test:tiktok** runs the production extension in a fresh, isolated headless Edge profile using synthetic favourites files under tests/fixtures. It exercises the actual file picker, preview, import, sorting, manual context, task edits, error states, mixed backup download/restore, mobile layout and offline reload. Evidence is written to artifacts/tiktok-test-results.json and associated screenshots. No everyday browser data is used.

The original modified files are preserved under artifacts/pre-tiktok-0.3.2. This directory is a source-file safety copy, not a backup of the user's browser workspace. Export a ReelDo workspace backup before changing its installation.


## Install without a terminal

### Updating an existing installation to 0.3.2

Open `chrome://extensions` (or `edge://extensions`), find ReelDo, and click its Reload button. Refresh the open Instagram Saved collection and any open ReelDo workspace. Previously sorted captions are reorganized once on opening the updated workspace, recovering movie clips filtered by older rules. New captures need just **Sort my reels** to fill lists automatically. Rescan with a limit of 100 only if captions are missing. The updated scanner fills the existing records and preserves tasks. Reloading the existing extension keeps its local data.

The 0.1.0 collector ignored Saved thumbnails' caption-bearing `img.alt` fields, leaving most links empty. Version 0.1.1 reads those fields, rejects generated photo descriptions, strips author/date wrappers from metadata, and retries earlier captures automatically. A scan with zero readable captions now reports incomplete caption access instead of implying useful content was collected. Missing-caption warnings include recovery steps.

Version 0.3.2 applies the midnight + mint brand to the workspace, popup, and browser-toolbar icons. Reload the extension and refresh the workspace to see the new look.

Version 0.3.1 fixed thumbnail reliability: it retries missing images even when captions are present, scrolls the grid in overlapping viewport steps, and saves small local copies of visible images. Keep Instagram selected during scanning. Refresh starts at the top and is still bounded by the selected link limit.

Version 0.3.0 adds thumbnails beside tasks and on Saved reel cards, removes the promotional banner, and adds an immediate, persistent Dark mode switch in Preferences. Scan again to add images to earlier captures. Use **Refresh thumbnails on existing saves** in the popup to replace stale image links. Thumbnail-only updates preserve classification and tasks.

The production extension is already built in **dist**. You can also extract **artifacts/ReelDo-extension.zip** into a folder you will keep.

1. Open Chrome and type `chrome://extensions` in the address bar, or use `edge://extensions` in Edge.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the **dist** folder (or the extracted ZIP folder containing manifest.json).
4. Pin **ReelDo** using the browser's Extensions menu.
5. Open Instagram, log in normally, and open **Profile → Saved → a collection**.
6. Click ReelDo in the browser toolbar and choose **Scan this Instagram page**. Keep that tab open. The progress panel has a Stop button.
7. Click **Open my workspace**, then **Sort my reels**. Review useful suggestions and choose **Add to my list**.

If you rebuild the extension, click **Reload** on its Extensions page and reload any open workspace tabs. Keep the installed folder in place.

## What is implemented

- User-initiated scanning of the open Instagram page. The collector scrolls loaded collection content, captures canonical reel/post links, reads captions from Saved thumbnail alt text or visible articles, and tries same-origin HTML description metadata only for missing captions. Generated "Photo by ... May be ..." alt descriptions are kept separate from actual creator captions.
- Scan limits of 25, 50, or 100 links, deduplication, incremental persistence, progress, and cancellation. Collection scans skip previously collected links so subsequent scans can reach more items. A limit bounds each scan; it is not a guarantee that all saves have been reached. An individual reel can be scanned again to recover its caption. You can also scroll to a later part of a collection before scanning.
- Local caption rules distinguish useful instructions, entertainment, and missing/ambiguous context. Emoji-numbered instructions, named tutorials, concrete career leads, and specific home ideas are supported. Suggestions without detailed instructions keep an empty checklist. The default rules are intended for English captions and do not provide semantic video understanding.
- Humour with useful practical instructions can pass Balanced mode. Strict mode sends mixed entertainment/instructions for review. Filtered reels can be restored.
- Useful reels automatically become list entries after sorting; no per-reel acceptance is required. Movie clips and recommendations are retained, including comedy films. Generic memes remain filtered. Names come from the caption; unnamed movies retain a short caption label. Tech announcements do not need imperative instructions. Steps are created only from source text.
- List entries reveal Modify in Saved reels and Open original reel actions on hover or keyboard focus; touch layouts show these controls directly. Saved-reel edits update the linked list entry. User task edits, completion, notes, stars and matching checklist progress survive re-sorting. Deleted entries stay dismissed until explicitly added again. Old backups migrate without changing manually edited task fields.
- Optional on-device Ollama integration. Install and run Ollama with an instruction-following text model first, then connect in Preferences. Permission is requested only for `http://127.0.0.1:11434/*`. Network/model errors fall back to local rules. Suggested steps that cannot be matched to the source are held for review.
- Durable browser-local storage; offline dashboard/task management after installation; import and backup export/restore. The normal web preview has separate browser localStorage and cannot scan another browser tab.
- Example workspace is opt-in, clearly labelled, and removable. Its source links are illustrative and aren't real videos.

## Limits and verification

**This build reads captions and pasted transcripts. It also captures the thumbnail or supplied poster frame exposed by Instagram. It does not transcribe reel audio, choose a meaningful moment from the video, or analyze video frames.** Visible grid thumbnails are cropped from a transient capture of the selected Instagram viewport, using the existing activeTab permission. Only small JPEG crops are stored; full viewport captures are discarded. Cached images display offline and are included in backups. The local-image cache is bounded to approximately 4 MB; older copies can fall back to their image link when the cache fills. Link-only fallbacks request Instagram's CDN with no referrer and may expire or fail offline. A category icon replaces unavailable images. A bare link is not enough to infer a task. Instagram may render no caption in its Saved grid or return a login/generic page to metadata requests. These links remain in **Needs context**, where you can paste the caption/transcript or add a task yourself. No internal Instagram APIs, login cookies, account passwords, or automated login flows are used. Instagram is contacted by its own open page when reading reel metadata.

Confirmed in this workspace:

- 33 Node checks for classification, Saved thumbnail extraction, metadata cleanup, generated-description rejection, emoji-numbered steps, repair/deduplication, preserved manual captions, canonical URLs, imports, source grounding, AI response validation, and backup round trips.
- 7 browser workflow checks in installed Edge: empty/demo states, persistence, importing/sorting/automatic placement, recovery/context editing, task editing/backups, search/mobile/preferences, and the actual scanner script on controlled Instagram-style fixtures.
- 5 production-extension runtime checks in a fresh, isolated Edge profile: MV3 worker load, extension CSP, real messaging/storage, sorting/automatic placement, and offline reload with saved tasks.
- 5 additional automatic-list browser checks cover legacy movie recovery, Tech announcements, hover/keyboard source controls, saved-reel edits, category moves, completion, personal data preservation and mobile layout on controlled fixtures.
- 5 appearance/thumbnail checks in the production extension cover image rendering under CSP, removal of the banner, immediate/persistent dark mode, shared Saved reel covers, failed-image fallback, mobile layout and offline task/theme persistence. Image responses are intercepted fixtures, not real Instagram availability.
- 9 capture/thumbnail runtime checks additionally cover the actual captureVisibleTab path, image crops stored locally, caption-present/image-missing metadata recovery, retry eligibility and offline image rendering. The controlled test uses a test-only all-URLs grant to simulate the screenshot access normally provided by a real toolbar action; production permissions remain unchanged.
- The earlier capture-repair checks covered: the actual reader/scanner injected together through chrome.scripting, captions extracted from an article-free Saved grid, earlier empty records repaired without duplicates, an existing starred task preserved, metadata requests limited to genuinely missing captions, retry eligibility, useful/meme/missing classification, and a five-step emoji checklist. This uses intercepted Instagram fixtures and a test-only host grant in an isolated Edge profile; production permissions remain unchanged.
- The user's live Chrome Saved grid was inspected read-only. Of 51 currently loaded links, 48 exposed creator captions in thumbnails and three had generated image descriptions. This confirms the source of the reported extraction failure; it is not proof that the patched scanner has run against the user's installed Chrome extension.
- Production build and ZIP packaging completed. Desktop/mobile screenshots and machine-readable test results are in **artifacts**.

**Not yet verified:** running the patched extension through the Chrome toolbar on the user's authenticated account, or actual Ollama model inference. DOM layouts and caption accessibility vary; fixture evidence and read-only inspection do not prove complete collection access. The extension has not been submitted to a browser store or published.

## Privacy

No accounts, analytics, cloud AI or telemetry. Link-only thumbnail display can contact Instagram's image CDN; locally cached thumbnails make no network request. During a user-initiated scan, a transient capture of the selected Instagram viewport is cropped locally; the full viewport is never saved or transmitted off the device. Only the small thumbnails enter local storage and backups. other runtime requests are limited to Instagram's own caption requests and optional local Ollama. Captions, source links, transcripts, tasks, and preferences stay in `chrome.storage.local`. Ollama receives text only when you enable its local engine. The extension needs `activeTab`, `scripting`, and `storage`; it has no always-on Instagram host permission. It scans only after a toolbar action. The local store and exported backups are not encrypted by ReelDo. Uninstalling the extension clears its stored workspace, so export a backup first.

## Development

Requires Node.js. Install dependencies with `npm install` and run `npm run dev`. `npm run build` produces **dist** and the installable ZIP. The ZIP packaging script uses PowerShell on Windows. The checked-in package metadata does not choose an application license.

- `npm test` — core and local-AI contract checks.
- `npm start` — production preview on `http://127.0.0.1:5173` (build first).
- `npm run test:ui` — browser workflows; preview must be running.
- `npm run test:appearance` — production extension thumbnails, dark mode and failed-image/mobile checks.
- `npm run test:lists` — automatic topic-list migration, source actions and edits in a separate browser.
- `npm run test:extension` — real production extension in an isolated Edge profile.
- `npm run test:capture` — injected caption collector and recovery flow on controlled Instagram fixtures in an isolated Edge profile.

Browser tests use the installed Windows Edge executable; adjust its path in the test scripts for another environment. Extension tests create isolated profiles under artifacts and do not modify your everyday browser profile.

Implementation references: [Chrome scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [Chrome local storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [Ollama chat API](https://docs.ollama.com/api/chat).
