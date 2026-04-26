---
status: resolved
trigger: 调整后重启APP页面点击扇区元素还是没有弹出属性信息
created: 2026-04-26
updated: 2026-04-26
---

# Debug: Sector click shows no property panel (Round 2)

## Symptoms
- Expected: Clicking/tapping a visible sector (green LTE / blue NR polygon) should highlight it red and show SectorInfoPanel
- Actual: No visual feedback, no property panel. Absolutely nothing happens on sector tap.
- Sectors ARE visible on the map (loaded and rendered correctly)
- Coordinate mode tapping WORKS (coordinate hint shows on empty space tap)
- BUT coordinate mode tapping causes the map to go COMPLETELY BLANK (white screen)
- Map stays blank even after switching search modes

## Root Cause

**Three issues were identified and fixed:**

### Issue 1: HTML template re-created on every render (causes blank map)
The `const html = \`...\`` template was defined INSIDE the React component function body. Every time React re-rendered the component (e.g., after `setSelectedLocation` or `setCoordinateHint`), a NEW string was created for the HTML. This could cause react-native-webview to reload the WebView, resetting the AMap instance and causing the map to go blank.

**Fix:** Moved the complete HTML/JS template to a module-level `const HTML_TEMPLATE = \`...\`` constant. This ensures the same string reference is used across all renders, preventing any WebView reload due to source changes.

### Issue 2: Missing getBoundingClientRect() offset correction (prevents sector detection)
The touchend handler used raw `touch.clientX/clientY` for `map.pixelToLngLat()`:
```javascript
// OLD: Wrong — uses viewport-relative coordinates without container offset
var lnglat = map.pixelToLngLat(new AMap.Pixel(touch.clientX, touch.clientY));
```

In React Native WebView, the map container may not start at viewport (0,0) due to safe area insets, system UI chrome, or CSS positioning. Raw client coordinates produce incorrect geographic coordinates, causing `getSectorsAtPoint()` to miss sectors.

**Fix:** Added `getBoundingClientRect()` offset correction:
```javascript
// NEW: Correct — adjusts for container offset from viewport
var rect = container.getBoundingClientRect();
var pixelX = touch.clientX - rect.left;
var pixelY = touch.clientY - rect.top;
var lnglat = map.pixelToLngLat(new AMap.Pixel(pixelX, pixelY));
```

This is the primary fix for why tapping on visible sectors didn't work — the hit-test was checking the wrong map coordinates.

### Issue 3: Uncaught exceptions in JS event handlers
Any exception thrown in `handleTapInternal`, `pointInSector`, or the touchend listener would silently corrupt the JavaScript execution context, potentially breaking AMap rendering or future event handling.

**Fix:** Added `try/catch` blocks around all critical event handlers with `log()` error reporting, preventing any single failure from corrupting the overall JS state.

## Fix Summary

### MapView.tsx changes:
1. **Moved HTML/JS template to module-level `HTML_TEMPLATE`** — prevents WebView reload on re-render
2. **Added `getBoundingClientRect()` offset correction** in touchend handler — fixes pixel→coordinate conversion accuracy  
3. **Added `try/catch` in `handleTapInternal()`** — prevents corruption of JS context
4. **Added `try/catch` in `pointInSector()`** — prevents sector iteration exceptions
5. **Added `try/catch` in touchend event listener** — prevents event handler crashes
6. **Added `log()` calls at each step** — tap coordinates, pixel values, number of sectors found
7. **Increased dedup window from 200ms to 400ms** — better protection against touch→click double-fire

### index.tsx changes:
1. **Coordinate mode no longer calls `setSelectedLocation`** — prevents `initialCenter` effect from triggering `moveCamera`, which was contributing to the blank map issue after tap

## Evidence
- 2026-04-26 — User confirmed coordinate mode tap shows coordinate hint (touch handler works)
- 2026-04-26 — User confirmed map goes blank after coordinate mode tap (re-render/WebView reload issue)
- 2026-04-26 — Identified missing getBoundingClientRect() offset as primary hit-test failure
- 2026-04-26 — Identified inline HTML template re-creation as root cause of blank map

## Eliminated
1. ~~map.on('click') not firing~~ — AMap Canvas mode doesn't dispatch overlay clicks to map click
2. ~~overlay.on('click') unreliable~~ — Canvas mode overlay clicks don't work reliably on mobile WebView
3. ~~getSectorsAtPoint logic error~~ — Iteration logic was correct; it was receiving wrong coordinates
4. ~~pointInSector ray-casting algorithm~~ — Algorithm was correct; it was checking wrong coordinates
5. ~~React Native WebView touch interception~~ — Touch events DO fire in WebView (confirmed by coordinate mode)
6. ~~AMap loading failure~~ — Map renders correctly initially, only breaks after state updates

## Resolution
root_cause: Three interacting issues: (1) inline HTML template caused WebView reload on re-render → blank map, (2) missing getBoundingClientRect() offset correction caused pixel→coordinate conversion errors → sectors not found at tap location, (3) uncaught exceptions in JS handlers corrupted execution context
fix: Moved HTML template to module-level constant, added getBoundingClientRect() offset correction, added try/catch protection in all event handlers, removed setSelectedLocation from coordinate mode tap
