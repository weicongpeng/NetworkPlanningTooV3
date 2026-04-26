import React, { forwardRef, useImperativeHandle, useRef, useEffect, useCallback, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useMapStore } from '../../store/mapStore';

export interface MapViewRef {
  moveCamera: (lat: number, lng: number, zoom?: number) => void;
}

interface Props {
  initialCenter?: [number, number];
  showSatellite?: boolean;
  onMapPress?: (lat: number, lng: number) => void;
  onLongPress?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: any) => void;
  onMeasureFinish?: () => void;
  onMeasureClear?: () => void;
  onSectorOverlap?: (sectors: any[], lat: number, lng: number) => void;
}

const AMAP_KEY = '9fa8b08372c3c764fd14d0bc74862ad1';
const AMAP_SECRET = 'f8929d799c3eca85e0f78d3e6b48be06';

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; }
    .measure-label {
      background: rgba(0,0,0,0.7);
      color: #fff;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
    }
    .search-label {
      background: rgba(255,255,255,0.9);
      color: #333;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .marker-label {
      background: rgba(229,57,53,0.85);
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .measure-panel {
      background: rgba(255,255,255,0.95);
      border-radius: 8px;
      padding: 6px 10px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      font-size: 12px;
      white-space: nowrap;
    }
    .measure-panel .dist {
      color: #E53935;
      font-weight: bold;
      font-size: 13px;
      margin-right: 4px;
    }
    .measure-panel .btn {
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      border: none;
      cursor: pointer;
    }
    .measure-panel .btn-finish {
      background: #007AFF;
      color: #fff;
    }
    .measure-panel .btn-clear {
      background: #FFEBEE;
      color: #E53935;
      border: 1px solid #EF9A9A;
    }
    .amap-logo { display: none !important; }
    .amap-copyright { display: none !important; }
  </style>
  <script id="amap-script"
    src="https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&callback=onAMapLoaded"
    onload="window._amapScriptLoaded=true;"
    onerror="window._amapScriptError=true;">
  </script>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var map = null;
      var sectorOverlayGroup = null;
      var markerOverlayGroup = null;
      var measureOverlayGroup = null;
      var searchMarkerObj = null;
      var currentSectorData = '';
      var currentMarkerData = '';
      var currentMeasureData = '';
      var longPressTimer = null;
      var isLongPress = false;
      var sectorOverlayMap = {};
      var currentSelectedSectorId = null;
      var mapRecentlyMoved = false;
      var mapMoveResetTimer = null;
      var isCurrentlyDragging = false;
      var touchStartPos = null;
      var touchStartTime = 0;
      var lastTapTime = 0;
      var touchHandled = false;

      function log(msg) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
        }
      }

      // WGS84 -> GCJ-02 coordinate conversion (China GPS offset)
      function outOfChina(lat, lng) {
        return (lng < 72.004 || lng > 137.8347) || (lat < 0.8293 || lat > 55.8271);
      }
      function transformLat(lng, lat) {
        var ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
        ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(lat * Math.PI) + 40.0 * Math.sin(lat / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(lat / 12.0 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30.0)) * 2.0 / 3.0;
        return ret;
      }
      function transformLng(lng, lat) {
        var ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
        ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(lng * Math.PI) + 40.0 * Math.sin(lng / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(lng / 12.0 * Math.PI) + 300.0 * Math.sin(lng / 30.0 * Math.PI)) * 2.0 / 3.0;
        return ret;
      }
      function wgs84ToGcj02(lat, lng) {
        if (outOfChina(lat, lng)) {
          return [lat, lng];
        }
        var dlat = transformLat(lng - 105.0, lat - 35.0);
        var dlng = transformLng(lng - 105.0, lat - 35.0);
        var radlat = lat / 180.0 * Math.PI;
        var magic = Math.sin(radlat);
        magic = 1 - 0.00669342162296594323 * magic * magic;
        var sqrtmagic = Math.sqrt(magic);
        dlat = (dlat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtmagic) * Math.PI);
        dlng = (dlng * 180.0) / (6378245.0 / sqrtmagic * Math.cos(radlat) * Math.PI);
        var mglat = lat + dlat;
        var mglng = lng + dlng;
        return [mglat, mglng];
      }

      var measureActionInProgress = false;

      window.handleMeasureFinish = function() {
        measureActionInProgress = true;
        setTimeout(function() { measureActionInProgress = false; }, 300);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'measureFinish' }));
        }
      };
      window.handleMeasureClear = function() {
        measureActionInProgress = true;
        setTimeout(function() { measureActionInProgress = false; }, 300);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'measureClear' }));
        }
      };

      // Unified tap handler: checks sectors first, then falls back to empty-space handling
      // Uses dedup to prevent duplicate processing from overlapping event sources
      function handleTapInternal(lat, lng, source) {
        try {
          var now = Date.now();
          // 去重：300ms 内的同一源点击跳过（touchend 和 click 间隔通常 < 300ms）
          if (now - lastTapTime < 300) {
            log('tap dedup skipped (' + source + '): too soon after last tap');
            return false;
          }
          lastTapTime = now;

          log('tap (' + source + '): ' + lat.toFixed(5) + ',' + lng.toFixed(5));

          var matching = getSectorsAtPoint(lng, lat);
          log('tap sectors: ' + matching.length + (matching.length > 0 ? ' ids=' + matching.map(function(e) { return e.data.id; }).join(',') : ''));

          if (matching.length >= 1) {
            // 即使有多个匹配，getSectorsAtPoint 已经返回最匹配的一个
            window.selectSector(matching[0].data.id);
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'sectorClick', sector: matching[0].data
              }));
            }
            return true;
          } else if (!mapRecentlyMoved) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapClick', lat: lat, lng: lng
              }));
            }
          }
          mapRecentlyMoved = false;
          if (mapMoveResetTimer) { clearTimeout(mapMoveResetTimer); mapMoveResetTimer = null; }
          return false;
        } catch (err) {
          log('tap error: ' + (err.message || err));
          return false;
        }
      }

      function calculateSectorPoints(lat, lng, azimuth, beamwidth, radius) {
        var points = [];
        // 地理方位角：0°=正北，顺时针增加
        // 数学角度：0°=正东，逆时针增加
        // 转换：mathAngle = 90 - azimuth
        var startAngle = 90 - azimuth - beamwidth / 2;
        var endAngle = 90 - azimuth + beamwidth / 2;
        points.push([lng, lat]);
        for (var a = startAngle; a <= endAngle; a += 5) {
          var rad = a * Math.PI / 180;
          var dx = radius * Math.cos(rad);
          var dy = radius * Math.sin(rad);
          var dLng = dx / (111320 * Math.cos(lat * Math.PI / 180));
          var dLat = dy / 110540;
          points.push([lng + dLng, lat + dLat]);
        }
        points.push([lng, lat]);
        return points;
      }

      function initMap() {
        try {
          var mapContainer = document.getElementById('map');
          log('Container size: ' + mapContainer.offsetWidth + 'x' + mapContainer.offsetHeight);

          map = new AMap.Map('map', {
            zoom: 12,
            center: [114.7004, 23.7435],
            viewMode: '2D',
            resizeEnable: true,
          });
          window.map = map;
          log('Map initialized');

          map.on('complete', function() {
            log('Map tiles loaded');
          });

          sectorOverlayGroup = new AMap.OverlayGroup();
          sectorOverlayGroup.setMap(map);
          markerOverlayGroup = new AMap.OverlayGroup();
          markerOverlayGroup.setMap(map);
          measureOverlayGroup = new AMap.OverlayGroup();
          measureOverlayGroup.setMap(map);

          // Resize on window resize
          window.addEventListener('resize', function() {
            if (map) map.resize();
          });

          // Use map's native events - no custom touch handling to avoid interfering with map gestures
          // Track map move/drag to distinguish from click
          map.on('mapmove', function() {
            if (mapMoveResetTimer) {
              clearTimeout(mapMoveResetTimer);
            }
            mapRecentlyMoved = true;
            mapMoveResetTimer = setTimeout(function() {
              mapRecentlyMoved = false;
              mapMoveResetTimer = null;
            }, 500);
          });

          // Long press detection via map
          map.on('longpress', function(e) {
            isLongPress = true;
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapLongPress',
                lat: e.lnglat.getLat(),
                lng: e.lnglat.getLng()
              }));
            }
          });

          // ---- RELIABLE TAP DETECTION ----
          // On mobile WebView, AMap overlay click events are unreliable because the
          // Canvas renderer doesn't dispatch click events for Polygon/Circle touches.
          // We use DOM-level touch events on the map container which ALWAYS fire.
          // Combined with our own hit-testing (getSectorsAtPoint), this works reliably.

          // Touchstart: track position/time for tap-vs-drag distinction
          var container = map.getContainer();
          container.addEventListener('touchstart', function(e) {
            if (e.changedTouches.length === 1) {
              touchStartPos = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
              touchStartTime = Date.now();
            } else {
              touchStartPos = null;
            }
          }, { passive: true });

          // Touchend: detect tap and convert to geographic coordinates
          container.addEventListener('touchend', function(e) {
            try {
              if (!touchStartPos || e.changedTouches.length > 1) {
                touchStartPos = null;
                return;
              }

              // Skip taps on UI overlays (measure panel, etc.)
              var target = e.target;
              while (target) {
                if (target.classList && (
                  target.classList.contains('measure-panel') ||
                  target.classList.contains('measure-label') ||
                  target.classList.contains('btn')
                )) {
                  log('touchend skipped: UI overlay tap');
                  touchStartPos = null;
                  return;
                }
                target = target.parentElement;
              }

              var touch = e.changedTouches[0];
              var dx = touch.clientX - touchStartPos.x;
              var dy = touch.clientY - touchStartPos.y;
              var dt = Date.now() - touchStartTime;
              touchStartPos = null;
              log('touchend dx=' + Math.abs(dx).toFixed(1) + ' dy=' + Math.abs(dy).toFixed(1) + ' dt=' + dt);
              if (Math.abs(dx) > 40 || Math.abs(dy) > 40 || dt > 800) {
                log('touchend rejected: drag or long press');
                return;
              }

              var rect = container.getBoundingClientRect();
              var pixelX = touch.clientX - rect.left;
              var pixelY = touch.clientY - rect.top;
              // Use containerToLngLat (screen pixel relative to map container) instead of pixelToLngLat (world pixel)
              var lnglat;
              if (map.containerToLngLat) {
                lnglat = map.containerToLngLat(new AMap.Pixel(pixelX, pixelY));
              } else {
                log('containerToLngLat not available, falling back to pixelToLngLat');
                lnglat = map.pixelToLngLat(new AMap.Pixel(pixelX, pixelY));
              }
              log('touch: pixel=(' + pixelX.toFixed(0) + ',' + pixelY.toFixed(0) + ') lnglat=(' + lnglat.getLng().toFixed(5) + ',' + lnglat.getLat().toFixed(5) + ')');
              var detected = handleTapInternal(lnglat.getLat(), lnglat.getLng(), 'touchend');
              // 只有在 touchend 检测到扇区时才抑制 map.on('click')，否则让 map.on('click') 兜底
              if (detected) {
                touchHandled = true;
                setTimeout(function() { touchHandled = false; }, 300);
              }
            } catch (err) {
              log('touch error: ' + (err.message || err));
            }
          }, { passive: true });

          // Touchcancel: reset tracking state when system interrupts touch
          container.addEventListener('touchcancel', function(e) {
            touchStartPos = null;
          }, { passive: true });

          // Map click fallback: handles desktop browsers and non-touch scenarios
          // On mobile, touchend handles taps reliably; click may duplicate so we guard it
          map.on('click', function(e) {
            if (touchHandled) {
              log('map.click suppressed (touch handled)');
              return;
            }
            if (measureActionInProgress) {
              log('map.click suppressed (measure action in progress)');
              return;
            }
            log('map.click: ' + e.lnglat.getLat().toFixed(5) + ',' + e.lnglat.getLng().toFixed(5));
            handleTapInternal(e.lnglat.getLat(), e.lnglat.getLng(), 'mapclick');
          });

          // Notify RN that map is ready
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
          }
        } catch (err) {
          log('Init error: ' + err.message);
        }
      }

      var checkCount = 0;
      function checkAMap() {
        checkCount++;
        if (typeof AMap !== 'undefined') {
          log('AMap ready after ' + checkCount + ' checks');
          initMap();
          return;
        }
        if (window._amapScriptError) {
          log('AMap script load error after ' + checkCount + ' checks');
          return;
        }
        if (checkCount > 100) {
          log('AMap check timeout (20s)');
          return;
        }
        log('AMap not ready (' + checkCount + '), retrying...');
        setTimeout(checkAMap, 200);
      }

      window.onAMapLoaded = function() {
        log('onAMapLoaded callback fired');
        checkAMap();
      };

      // Fallback: if callback never fires, start polling
      setTimeout(checkAMap, 2000);

      window.updateSectors = function(sectors) {
        if (!map) { log('updateSectors: map not ready'); return; }
        var jsonStr = JSON.stringify(sectors);
        if (currentSectorData === jsonStr) return;
        currentSectorData = jsonStr;
        log('updateSectors: ' + sectors.length);

        sectorOverlayGroup.clearOverlays();
        sectorOverlayMap = {};
        var overlays = [];
        for (var k = 0; k < sectors.length; k++) {
          var sector = sectors[k];
          var color = sector.networkType === 'LTE' ? '#4CAF50' : '#2196F3';
          var strokeColor = sector.networkType === 'LTE' ? '#2E7D32' : '#1565C0';

          // WGS84 -> GCJ-02 conversion for AMap display and hit-testing
          var gcj = wgs84ToGcj02(sector.latitude, sector.longitude);
          var gcjLat = gcj[0];
          var gcjLng = gcj[1];

          var overlay;
          var path = null;
          var sectorId = sector.id || ('sector-' + k);
          if (sector.cell_cover_type === 4) {
            overlay = new AMap.Circle({
              center: [gcjLng, gcjLat],
              radius: 30,
              fillColor: color,
              fillOpacity: 0.4,
              strokeColor: strokeColor,
              strokeWeight: 1,
              cursor: 'pointer',
              extData: sector
            });
          } else {
            var azimuth = (sector.azimuth === undefined || sector.azimuth === null) ? 0 : Number(sector.azimuth);
            var beamwidth = (sector.beamwidth === undefined || sector.beamwidth === null) ? 65 : Number(sector.beamwidth);
            path = calculateSectorPoints(gcjLat, gcjLng, azimuth, beamwidth, 60);
            overlay = new AMap.Polygon({
              path: path,
              fillColor: color,
              fillOpacity: 0.35,
              strokeColor: strokeColor,
              strokeWeight: 1,
              cursor: 'pointer',
              extData: sector
            });
          }

          // Bind click event directly on overlay (like desktop Leaflet approach)
          (function(currentSector) {
            overlay.on('click', function(e) {
              if (e && e.stopPropagation) e.stopPropagation();
              var now = Date.now();
              if (now - lastTapTime < 300) return;
              lastTapTime = now;
              log('overlay.click: ' + currentSector.id);
              window.selectSector(currentSector.id);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'sectorClick', sector: currentSector
                }));
              }
            });
          })(sector);

          overlays.push(overlay);
          sectorOverlayMap[sectorId] = {
            overlay: overlay,
            data: sector,
            gcjLat: gcjLat,
            gcjLng: gcjLng,
            path: path
          };
        }
        if (overlays.length > 0) {
          sectorOverlayGroup.addOverlays(overlays);
        }
        // Re-apply highlight if the previously selected sector is still in view
        if (currentSelectedSectorId && sectorOverlayMap[currentSelectedSectorId]) {
          var sel = sectorOverlayMap[currentSelectedSectorId];
          if (sel.data.cell_cover_type === 4) {
            sel.overlay.setOptions({ fillColor: '#E53935', fillOpacity: 0.6, strokeColor: '#B71C1C', strokeWeight: 3, radius: 50 });
          } else {
            sel.overlay.setOptions({ fillColor: '#E53935', fillOpacity: 0.55, strokeColor: '#B71C1C', strokeWeight: 3 });
          }
        }
      };

      function pointInSector(lng, lat, entry) {
        try {
          if (!entry || !entry.data) return false;
          var sector = entry.data;
          // Use GCJ-02 coordinates for hit-testing (same coordinate system as map click)
          var gcjLat = entry.gcjLat;
          var gcjLng = entry.gcjLng;
          if (gcjLat === undefined || gcjLng === undefined) {
            // Fallback to raw data if GCJ coords missing (should not happen)
            gcjLat = sector.latitude;
            gcjLng = sector.longitude;
          }
          // Quick bounding box check (~1km) to skip distant sectors
          if (Math.abs(gcjLng - lng) > 0.01 || Math.abs(gcjLat - lat) > 0.01) return false;
          if (sector.cell_cover_type === 4) {
            // Circle (indoor) - check haversine distance <= 30m
            var R = 6371000;
            var dLat = (lat - gcjLat) * Math.PI / 180;
            var dLon = (lng - gcjLng) * Math.PI / 180;
            var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(gcjLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return (R * c) <= 30;
          } else {
            // Polygon (outdoor) - ray casting (path is already in GCJ-02)
            var poly = entry.path;
            if (!poly || !Array.isArray(poly) || poly.length < 3) {
              log('pointInSector: invalid path for ' + (sector.id || 'unknown'));
              return false;
            }
            var inside = false;
            for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
              var xi = poly[i][0], yi = poly[i][1];
              var xj = poly[j][0], yj = poly[j][1];
              // Skip if edge is horizontal (avoid division by zero)
              if (yj === yi) continue;
              if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
                inside = !inside;
              }
            }
            return inside;
          }
        } catch (err) {
          log('pointInSector error: ' + (err.message || err));
          return false;
        }
      }

      function getDistanceMeters(lat1, lon1, lat2, lon2) {
        var R = 6371000;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }

      // 计算从扇区中心到点击点的方位角（度）
      function getBearing(lat1, lon1, lat2, lon2) {
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var lat1r = lat1 * Math.PI / 180;
        var lat2r = lat2 * Math.PI / 180;
        var y = Math.sin(dLon) * Math.cos(lat2r);
        var x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon);
        var bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
      }

      // 计算方位角差异（考虑 360° 环绕）
      function azimuthDiff(a1, a2) {
        var diff = Math.abs(a1 - a2);
        return diff > 180 ? 360 - diff : diff;
      }

      function getSectorsAtPoint(lng, lat) {
        var result = [];
        var minDistance = Infinity;
        var closestEntry = null;

        for (var id in sectorOverlayMap) {
          if (!sectorOverlayMap.hasOwnProperty(id)) continue;
          var entry = sectorOverlayMap[id];
          var sector = entry.data;
          var gcjLat = entry.gcjLat !== undefined ? entry.gcjLat : sector.latitude;
          var gcjLng = entry.gcjLng !== undefined ? entry.gcjLng : sector.longitude;

          // 方法1：精确的射线检测（多边形/圆形内）
          if (pointInSector(lng, lat, entry)) {
            result.push(entry);
            continue;
          }

          // 方法2：容错检测 - 如果点击位置在扇区中心 120 米范围内，也认为是命中
          var dist = getDistanceMeters(gcjLat, gcjLng, lat, lng);
          if (dist < 120 && dist < minDistance) {
            minDistance = dist;
            closestEntry = entry;
          }
        }

        // 如果精确检测没有命中，但容错检测有最近项，返回最近项
        if (result.length === 0 && closestEntry) {
          result.push(closestEntry);
          return result;
        }

        // 如果命中多个扇区，选择"最匹配"的一个（点击方向与扇区方位角最接近）
        if (result.length > 1) {
          var bestMatch = result[0];
          var bestDiff = Infinity;
          for (var i = 0; i < result.length; i++) {
            var sector = result[i].data;
            var gcjLat = result[i].gcjLat !== undefined ? result[i].gcjLat : sector.latitude;
            var gcjLng = result[i].gcjLng !== undefined ? result[i].gcjLng : sector.longitude;
            if (sector.cell_cover_type === 4) {
              // 室内扇区（圆形），选择最近的
              var dist = getDistanceMeters(gcjLat, gcjLng, lat, lng);
              if (dist < bestDiff) {
                bestDiff = dist;
                bestMatch = result[i];
              }
            } else if (sector.azimuth !== undefined && sector.azimuth !== null) {
              // 室外扇区，选择方位角与点击方向最接近的
              var clickBearing = getBearing(gcjLat, gcjLng, lat, lng);
              var diff = azimuthDiff(clickBearing, sector.azimuth);
              if (diff < bestDiff) {
                bestDiff = diff;
                bestMatch = result[i];
              }
            }
          }
          return [bestMatch];
        }

        return result;
      }

      window.selectSector = function(id) {
        // Deselect previous
        if (currentSelectedSectorId && sectorOverlayMap[currentSelectedSectorId]) {
          var prev = sectorOverlayMap[currentSelectedSectorId];
          var ps = prev.data;
          var pc = ps.networkType === 'LTE' ? '#4CAF50' : '#2196F3';
          var psC = ps.networkType === 'LTE' ? '#2E7D32' : '#1565C0';
          if (ps.cell_cover_type === 4) {
            prev.overlay.setOptions({ fillColor: pc, fillOpacity: 0.4, strokeColor: psC, strokeWeight: 1, radius: 30 });
          } else {
            prev.overlay.setOptions({ fillColor: pc, fillOpacity: 0.35, strokeColor: psC, strokeWeight: 1 });
          }
        }
        currentSelectedSectorId = null;

        // Select new
        if (id && sectorOverlayMap[id]) {
          var entry = sectorOverlayMap[id];
          if (entry.data.cell_cover_type === 4) {
            entry.overlay.setOptions({ fillColor: '#E53935', fillOpacity: 0.6, strokeColor: '#B71C1C', strokeWeight: 3, radius: 50 });
          } else {
            entry.overlay.setOptions({ fillColor: '#E53935', fillOpacity: 0.55, strokeColor: '#B71C1C', strokeWeight: 3 });
          }
          currentSelectedSectorId = id;
        }
      };

      window.deselectSector = function() {
        if (currentSelectedSectorId) {
          window.selectSector(null);
        }
      };

      window.updateMarkers = function(markers) {
        if (!map) return;
        var jsonStr = JSON.stringify(markers);
        if (currentMarkerData === jsonStr) return;
        currentMarkerData = jsonStr;

        markerOverlayGroup.clearOverlays();
        for (var i = 0; i < markers.length; i++) {
          var m = markers[i];
          // markers 存储为 WGS84，显示前转换为 GCJ-02
          var gcj = wgs84ToGcj02(m.lat, m.lng);
          var gcjLat = gcj[0];
          var gcjLng = gcj[1];
          var dot = new AMap.CircleMarker({
            center: [gcjLng, gcjLat],
            radius: 8,
            fillColor: '#E53935',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            zIndex: 90,
            extData: m
          });
          (function(dotObj, markerData) {
            dotObj.on('click', function(e) {
              if (e && e.stopPropagation) e.stopPropagation();
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerClick', marker: markerData }));
              }
            });
          })(dot, m);
          markerOverlayGroup.addOverlay(dot);

          var label = new AMap.Marker({
            position: [gcjLng, gcjLat],
            offset: new AMap.Pixel(0, -22),
            content: '<div class="marker-label">' + ((m.name && m.name.length > 0) ? m.name : '标记 ' + (i + 1)) + '</div>',
            clickable: false,
            zIndex: 91
          });
          markerOverlayGroup.addOverlay(label);
        }
      };

      function formatDist(meters) {
        if (meters === null || meters === undefined) return '0m';
        return meters >= 1000 ? (meters / 1000).toFixed(2) + 'km' : Math.round(meters) + 'm';
      }

      window.updateMeasurePoints = function(points, mode, finished) {
        if (!map) return;
        var jsonStr = JSON.stringify(points);
        if (currentMeasureData === jsonStr && !mode && !finished) return;
        currentMeasureData = jsonStr;

        measureOverlayGroup.clearOverlays();
        if (points.length === 0) return;

        var path = points.map(function(p) { return [p.lng, p.lat]; });
        var polyline = new AMap.Polyline({
          path: path,
          strokeColor: '#E53935',
          strokeWeight: 3,
          strokeStyle: 'dashed',
          strokeDash: [5, 5],
          lineJoin: 'round'
        });
        measureOverlayGroup.addOverlay(polyline);

        for (var i = 0; i < points.length; i++) {
          var pt = points[i];
          var dot = new AMap.CircleMarker({
            center: [pt.lng, pt.lat],
            radius: 6,
            fillColor: '#E53935',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2
          });
          measureOverlayGroup.addOverlay(dot);
        }

        if (points.length >= 1) {
          var startLabel = new AMap.Marker({
            position: [points[0].lng, points[0].lat],
            offset: new AMap.Pixel(-15, -30),
            content: '<div class="measure-label" style="background:rgba(76,175,80,0.85);">起点</div>',
            clickable: false
          });
          measureOverlayGroup.addOverlay(startLabel);
        }

        if (points.length >= 2) {
          var lastPt = points[points.length - 1];
          var totalDist = 0;
          for (var k = 1; k < points.length; k++) {
            totalDist += getHaversineDistance(points[k-1].lat, points[k-1].lng, points[k].lat, points[k].lng);
          }
          var distStr = formatDist(totalDist);
          var panelHtml = '<div class="measure-panel">';
          panelHtml += '<span class="dist">' + distStr + '</span>';
          if (mode) {
            panelHtml += '<button class="btn btn-finish" onclick="event.stopPropagation(); window.handleMeasureFinish()">完成</button>';
          }
          panelHtml += '<button class="btn btn-clear" onclick="event.stopPropagation(); window.handleMeasureClear()">清除</button>';
          panelHtml += '</div>';

          var panelMarker = new AMap.Marker({
            position: [lastPt.lng, lastPt.lat],
            offset: new AMap.Pixel(-80, -45),
            content: panelHtml
          });
          measureOverlayGroup.addOverlay(panelMarker);
        }
      };

      function getHaversineDistance(lat1, lon1, lat2, lon2) {
        var R = 6371000;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }

      window.updateSearchMarker = function(marker) {
        if (!map) return;
        if (searchMarkerObj) {
          map.remove(searchMarkerObj);
          if (searchMarkerObj.label) {
            map.remove(searchMarkerObj.label);
          }
          searchMarkerObj = null;
        }
        if (!marker) return;
        searchMarkerObj = new AMap.CircleMarker({
          center: [marker.lng, marker.lat],
          radius: 8,
          fillColor: '#E53935',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          zIndex: 100,
        });
        map.add(searchMarkerObj);

        var label = new AMap.Marker({
          position: [marker.lng, marker.lat],
          offset: new AMap.Pixel(0, -22),
          content: '<div class="marker-label">' + (marker.name || '搜索结果') + '</div>',
          clickable: false,
          zIndex: 101
        });
        map.add(label);
        searchMarkerObj.label = label;
      };

      var satelliteLayer = null;
      var roadNetLayer = null;

      window.setMapType = function(type) {
        if (!map) return;
        try {
          if (type === 1) {
            if (!satelliteLayer) {
              satelliteLayer = new AMap.TileLayer.Satellite({ zIndex: 1 });
            }
            if (!roadNetLayer) {
              roadNetLayer = new AMap.TileLayer.RoadNet({ zIndex: 2 });
            }
            map.add(satelliteLayer);
            map.add(roadNetLayer);
            map.setFeatures(['road', 'building', 'point']);
          } else {
            if (satelliteLayer) {
              map.remove(satelliteLayer);
              satelliteLayer = null;
            }
            if (roadNetLayer) {
              map.remove(roadNetLayer);
              roadNetLayer = null;
            }
            map.setFeatures(['bg', 'road', 'building', 'point']);
          }
        } catch(e) {
          console.log('setMapType error:', e.message || e);
        }
      };

      window.moveCamera = function(lat, lng, zoom) {
        if (!map) return;
        map.setZoomAndCenter(zoom || 16, [lng, lat]);
      };
    })();
  </script>
</body>
</html>
`;

export default forwardRef<MapViewRef, Props>(function MapView(props, ref) {
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const prevCenterRef = useRef<string | null>(null);

  const {
    lteSectors,
    nrSectors,
    markers,
    measurePoints,
    measureMode,
    measureFinished,
    searchMarker,
    mapType,
    layers,
    setSelectedSector,
    selectedSector,
  } = useMapStore();
  const { onMapPress, onLongPress, onMarkerClick, onMeasureFinish, onMeasureClear, onSectorOverlap } = props;
  const showSatellite = props.showSatellite;

  const injectJS = useCallback((code: string) => {
    webViewRef.current?.injectJavaScript(code);
  }, []);

  // Inject all current data when map becomes ready
  const syncAllData = useCallback(() => {
    const visibleLte = layers.lte.visible ? lteSectors : [];
    const visibleNr = layers.nr.visible ? nrSectors : [];
    const allSectors = [...visibleLte, ...visibleNr];
    const searchMarkerJson = searchMarker ? JSON.stringify(searchMarker) : 'null';
    injectJS(`window.updateSectors(${JSON.stringify(allSectors)});`);
    injectJS(`window.updateMarkers(${JSON.stringify(markers)});`);
    injectJS(`window.updateMeasurePoints(${JSON.stringify(measurePoints)}, ${measureMode}, ${measureFinished});`);
    injectJS(`window.updateSearchMarker(${searchMarkerJson});`);
    if (showSatellite) {
      injectJS('window.setMapType(1);');
    }
    if (props.initialCenter) {
      injectJS(`window.moveCamera(${props.initialCenter[0]}, ${props.initialCenter[1]}, 16);`);
    }
  }, [lteSectors, nrSectors, markers, measurePoints, measureMode, measureFinished, searchMarker, showSatellite]);

  // Initial center - skip if coordinates haven't changed
  useEffect(() => {
    if (!mapReady) return;
    if (!props.initialCenter) {
      prevCenterRef.current = null;
      return;
    }
    const key = `${props.initialCenter[0]},${props.initialCenter[1]}`;
    if (prevCenterRef.current === key) return;
    prevCenterRef.current = key;
    injectJS(`window.moveCamera(${props.initialCenter[0]}, ${props.initialCenter[1]}, 16);`);
  }, [props.initialCenter, mapReady]);

  // Update sectors
  useEffect(() => {
    if (!mapReady) return;
    const visibleLte = layers.lte.visible ? lteSectors : [];
    const visibleNr = layers.nr.visible ? nrSectors : [];
    const allSectors = [...visibleLte, ...visibleNr];
    injectJS(`window.updateSectors(${JSON.stringify(allSectors)});`);
  }, [lteSectors, nrSectors, layers.lte.visible, layers.nr.visible, mapReady]);

  // Update markers
  useEffect(() => {
    if (!mapReady) return;
    injectJS(`window.updateMarkers(${JSON.stringify(markers)});`);
  }, [markers, mapReady]);

  // Update measure points
  useEffect(() => {
    if (!mapReady) return;
    injectJS(`window.updateMeasurePoints(${JSON.stringify(measurePoints)}, ${measureMode}, ${measureFinished});`);
  }, [measurePoints, measureMode, measureFinished, mapReady]);

  // Update search marker
  useEffect(() => {
    if (!mapReady) return;
    if (searchMarker) {
      injectJS(`window.updateSearchMarker(${JSON.stringify(searchMarker)});`);
    } else {
      injectJS('window.updateSearchMarker(null);');
    }
  }, [searchMarker, mapReady]);

  // Update map type
  useEffect(() => {
    if (!mapReady) return;
    injectJS(`window.setMapType(${showSatellite ? 1 : 0});`);
  }, [showSatellite, mapReady]);

  // Sector selection highlight (direct overlay manipulation, no full re-render)
  useEffect(() => {
    if (!mapReady) return;
    const id = selectedSector?.id;
    if (id) {
      injectJS(`window.selectSector('${id}');`);
    } else {
      injectJS('window.deselectSector();');
    }
  }, [selectedSector, mapReady]);

  // Handle messages from WebView
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'mapReady':
          setMapReady(true);
          syncAllData();
          break;
        case 'mapClick':
          console.log('[MapView] mapClick:', data.lat, data.lng);
          onMapPress?.(data.lat, data.lng);
          break;
        case 'mapLongPress':
          onLongPress?.(data.lat, data.lng);
          break;
        case 'markerClick':
          if (data.marker) {
            onMarkerClick?.(data.marker);
          }
          break;
        case 'sectorClick':
          console.log('[MapView] sectorClick:', data.sector?.id, data.sector?.name, 'lat:', data.sector?.latitude, 'lng:', data.sector?.longitude);
          setSelectedSector(data.sector);
          break;
        case 'sectorOverlap':
          onSectorOverlap?.(data.sectors, data.lat, data.lng);
          break;
        case 'log':
          console.log('[MapView Web]', data.message);
          break;
        case 'measureClear':
          onMeasureClear?.();
          break;
        case 'measureFinish':
          onMeasureFinish?.();
          break;
      }
    } catch (err) {
      console.error('[MapView] message error:', err);
    }
  }, [onMapPress, onLongPress, onMarkerClick, onMeasureFinish, onMeasureClear, onSectorOverlap, setSelectedSector, syncAllData]);

  useImperativeHandle(ref, () => ({
    moveCamera: (lat: number, lng: number, zoom?: number) => {
      injectJS(`window.moveCamera(${lat}, ${lng}, ${zoom || 16});`);
    },
  }));

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: HTML_TEMPLATE }}
        style={styles.map}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowFileAccess={true}
        mixedContentMode="compatibility"
        originWhitelist={['*']}
      />
      {!mapReady && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>地图加载中...</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
});
