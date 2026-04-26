---
status: fixed
trigger: 调整后点击APP地图的扇区还是没有显示属性信息
created: 2026-04-26
updated: 2026-04-26
---

# Debug: Sector click shows no property panel

## Symptoms
- Expected: Clicking a sector (green LTE / blue NR polygon on AMap) should highlight it red and show SectorInfoPanel
- Actual: No visual feedback (no red highlight), no property panel. Absolutely nothing happens.
- Sectors ARE visible on the map
- Issue started after recent code modifications (overlay click handler refactor)

## Root Cause
AMap JS API v2.0 renders Polygon/Circle overlays on Canvas2D. When the user taps a sector overlay in a mobile WebView:
1. `map.on('click')` does NOT fire (AMap dispatches overlay clicks separately from map clicks)
2. `overlay.on('click')` is unreliable on mobile touch — Canvas renderer may not synthesize click events for polygon touches
3. The original fix (adding `overlay.on('click')` handlers) didn't work because mobile WebView touch events don't reliably reach overlay-level click handlers

## Fix
Replaced overlay-level click handling with DOM-level touch event listeners on the map container:
1. Added `touchstart` listener to track tap position/timing (for tap-vs-drag detection)
2. Added `touchend` listener that:
   - Detects genuine taps (minimal movement, short duration)
   - Converts screen coords → geographic coords via `map.pixelToLngLat()`
   - Calls `getSectorsAtPoint()` for hit testing
   - Handles single sector (select + postMessage), overlaps, and empty-space clicks
3. Added `handleTapInternal()` shared function with 200ms dedup to prevent duplicate processing
4. Kept `map.on('click')` as fallback for desktop browsers
5. Removed unreliable `overlay.on('click')` handlers from `updateSectors`

## Files Changed
- `mobile-app/src/components/Map/MapView.tsx`:   
  - Added touch tracking variables (`touchStartPos`, `touchStartTime`, `lastTapKey`, `lastTapTime`)  
  - Added `handleTapInternal()` unified handler with dedup  
  - Added DOM `touchstart`/`touchend` listeners on map container in `initMap()`  
  - Simplified `map.on('click')` to call `handleTapInternal()`  
  - Removed `overlay.on('click')` from `updateSectors()` loop
