# Backend Requirements: Box Selection Bug Fixes

## Context
We have a web-based network planning tool with a map interface that supports box selection (circle and polygon modes) to select LTE/NR sectors and geographic data layers. Users need to visually identify which sectors/features are selected after completing a box selection operation.

**Current Issues:**
1. LTE/NR sector layers don't show highlight after box selection completes (geographic data layers work correctly)
2. After completing a box selection, the cursor remains crosshair and tooltips stay disabled (affects UX)
3. Multiple layers can be selected during box selection mode, violating the "only one layer at a time" rule

**Users:** Network planning engineers
**Goal:** Intuitive box selection with clear visual feedback

---

## Issue 1: Sector Highlight Not Showing

### What's Happening
- User activates box selection mode (circle or polygon)
- User completes box selection on the map
- Selected sectors should show with cyan (#00ffff) highlight border, weight 4-6
- Geographic data layers show highlight correctly
- LTE/NR sector layers don't show highlight

### Data I Need

**Current state (what I have):**
- `selectionHighlightIds`: Set<string> - IDs of selected features
- `sectorPolygons`: Map<string, {polygon, lastUsed, zoom}> - Currently rendered sector polygons
- `sectors`: RenderSectorData[] - All sector data (including those outside viewport)

**The Problem:**
`_updateSectorStyles()` only iterates over `sectorPolygons` (currently rendered sectors). If selected sectors are outside the viewport, they won't be in `sectorPolygons` and can't be highlighted.

**What I need to work:**
- When `setSelectionHighlight(ids)` is called, I need to ensure all selected sectors are rendered first, then apply highlight
- The rendering process filters by viewport, frequency visibility, and whitelist - this prevents selected sectors outside viewport from being rendered

**Questions for Backend:**
- Is there a more efficient way to handle this than force-rendering selected sectors outside the viewport?
- Should we cache the selection state and apply highlights when sectors come into view (lazy approach)?
- Or should we force-render all selected sectors immediately (current approach)?

---

## Issue 2: Cursor and Interaction State After Selection

### What's Happening
- User activates box selection mode
- Cursor changes to crosshair ✓
- Tooltips and click-to-show-properties are disabled ✓
- User completes box selection (second click for circle, close polygon for polygon)
- **BUG:** Cursor stays crosshair, tooltips stay disabled, even though selection is complete
- Expected: Cursor should return to normal, tooltips should work again

### State Management I Need

**Current state flow:**
```typescript
selectionMode: 'none' | 'circle' | 'polygon'  // Controls whether box selection is active
```

**The Problem:**
`selectionMode` stays active after completing a box selection. The mousemove handler (line 2242-2244 in OnlineMap.tsx) checks:
```typescript
if (measureModeRef.current || selectionModeRef.current !== 'none') {
  map.getContainer().style.cursor = 'crosshair'
}
```

Since `selectionModeRef.current !== 'none'` is still true after selection completes, the cursor stays crosshair.

**What I need:**
- After box selection completes, cursor should return to 'default'
- Tooltips and click interactions should work again
- BUT: The selection highlight should remain visible
- AND: The user should be able to do another box selection (cursor should become crosshair again when starting a new selection)

**Questions for Backend:**
- Should we auto-exit selection mode after completing a box selection? Or keep it active for multiple selections?
- If we keep it active, how do we distinguish "ready for next selection" from "currently selecting"?
- Should there be a visual indicator showing "selection mode active, ready to select" vs "currently drawing selection"?

---

## Issue 3: Multiple Layers Selected During Box Selection

### What's Happening
- User activates box selection mode
- User has one layer visible (e.g., LTE)
- User checks a second layer in layer control panel (e.g., NR)
- Now both LTE and NR layers are visible during box selection
- **BUG:** Box selection now operates on both layers, violating "only one layer at a time" rule
- Expected: Show warning message, prevent second layer from being enabled

### Business Rules Affecting UI

**Rule:** Only one sector layer should be selectable during box selection mode
- User can select LTE OR NR sector layers, not both simultaneously
- Geographic data layers should be excluded from this rule (can be selected alongside sector layers)
- If user tries to enable a second sector layer during box selection mode:
  - Show warning: "框选模式下只能圈选一个图层"
  - Prevent the second layer from being enabled

**State I Need to Track:**
```typescript
// Current layer visibility state
layerVisibility: {
  lte: boolean
  nr: boolean
}

// Box selection mode state
selectionMode: 'none' | 'circle' | 'polygon'
```

**Validation Logic I Need:**
When user tries to enable a layer:
1. Check if `selectionMode !== 'none'` (box selection is active)
2. Check if enabling would result in multiple sector layers being visible
3. If yes: Show warning, block the action
4. If no: Allow the layer to be enabled

**Questions for Backend:**
- Should this validation be enforced on the frontend only, or should the backend also validate?
- Should the warning be a toast notification, alert, or inline message?
- What should happen if user has both LTE and NR visible BEFORE entering box selection mode?
  - Option A: Auto-disable one layer when entering selection mode
  - Option B: Prevent entering selection mode until only one layer is visible
  - Option C: Allow it but show warning (current broken behavior)

---

## States I Need to Handle

### Box Selection States
1. **Inactive** (`selectionMode = 'none'`):
   - Cursor: default
   - Tooltips: enabled
   - Click-to-show-properties: enabled
   - Can enable multiple layers

2. **Active, drawing** (`selectionMode = 'circle' | 'polygon'`, user is drawing):
   - Cursor: crosshair
   - Tooltips: disabled
   - Click-to-show-properties: disabled
   - Cannot enable additional sector layers

3. **Active, ready** (after completing one selection, mode still active):
   - Cursor: should be default (BUG: currently crosshair)
   - Tooltips: should be enabled (BUG: currently disabled)
   - Click-to-show-properties: should be enabled (BUG: currently disabled)
   - Selection highlight: visible
   - Ready to start next selection
   - Cannot enable additional sector layers

### Edge Cases
- User right-clicks during selection → should clear selection, keep mode active
- User presses Esc → should exit selection mode
- User zooms/pans map → selection highlights should persist
- User switches map type → selection highlights should persist
- User enables second layer during selection → should show warning, block action

---

## Uncertainties

- [ ] Should we auto-exit selection mode after completing one selection, or keep it active for multiple selections?
- [ ] If user has multiple layers visible before entering selection mode, what should happen?
- [ ] Should the cursor be crosshair when "ready for next selection" or only when "currently drawing"?
- [ ] How should we indicate the difference between "drawing" and "ready" states to the user?

---

## Questions for Backend

1. **Issue 1 - Sector Highlight:**
   - Is force-rendering selected sectors outside viewport the right approach?
   - Or should we lazy-apply highlights when sectors come into view?
   - Performance implications of force-rendering?

2. **Issue 2 - Cursor State:**
   - Should `selectionMode` be reset to 'none' after each selection completes?
   - Or add a separate state to track "drawing" vs "ready"?
   - What's the expected user workflow - single selection or multiple selections?

3. **Issue 3 - Multiple Layers:**
   - Should we prevent entering selection mode if multiple layers are already visible?
   - Or auto-disable layers when selection mode is activated?
   - Where should the validation live - frontend only or both ends?

---

## Discussion Log

*Waiting for backend responses*
