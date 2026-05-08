/**
 * 应用内导航核心服务
 * 功能：GPS定位 → 高德路径规划API → 路线跟踪 → TTS语音播报
 */
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import axios from 'axios';
import { Platform } from 'react-native';
import { wgs84ToGcj02 } from '../utils/coordinate';
import { getEffectiveApiUrl } from '../utils/config';
import { useMapStore } from '../store/mapStore';

/** 获取方向代理地址（动态，每次调用时读取当前 API 地址） */
async function getDirectionProxyUrl(): Promise<string> {
  const apiUrl = await getEffectiveApiUrl();
  return `${apiUrl}/map/direction`;
}

export type NaviMode = 'drive' | 'walk' | 'bicycling';

/** 导航步骤（单个转向指令） */
export interface RouteStep {
  instruction: string;
  polyline: [number, number][];  // [lng, lat][] GCJ-02
  distance: number;
  duration: number;
  road: string;
}

/** 完整路线数据 */
export interface RouteData {
  steps: RouteStep[];
  totalDistance: number;
  totalDuration: number;
  flatPolyline: [number, number][];  // 合并后的路线点 [lng, lat] GCJ-02
  origin: [number, number];
  destination: [number, number];
}

/** 导航状态快照 */
export interface NaviStateSnapshot {
  isNavigating: boolean;
  currentStepIndex: number;
  currentPosition: [number, number] | null;  // WGS84
  heading: number | null;  // 设备朝向角度
  prevStepEndIndex: number;  // flatPolyline 中当前步结束点索引
  remainingDistance: number;
  elapsedSec: number;
  destLat: number;
  destLng: number;
  destName: string;
  mode: NaviMode;
  routeData: RouteData | null;
}

type NaviCallback = (state: NaviStateSnapshot) => void;

// === 单例服务 ===
let _isNavigating = false;
let _routeData: RouteData | null = null;
let _currentStepIndex = 0;
let _currentPosition: [number, number] | null = null;   // WGS84
let _currentPositionGcj: [number, number] | null = null; // GCJ-02
let _currentHeading: number | null = null;              // 设备朝向（度）
let _destLat = 0;
let _destLng = 0;
let _destName = '';
let _mode: NaviMode = 'drive';
let _elapsedSec = 0;
let _timerInterval: ReturnType<typeof setInterval> | null = null;
let _locationSub: Location.LocationSubscription | null = null;
let _lastSpokenStepIndex = -1;
let _callbacks: NaviCallback[] = [];
let _arrivalCallback: (() => void) | null = null;
let _elapsedTimer: ReturnType<typeof setInterval> | null = null;
let _startTime = 0;
let _autoHideTimer: ReturnType<typeof setTimeout> | null = null;

// 已说过的靠近提醒（防止重复）
let _approachingSpoken: Set<number> = new Set();

/** 注册状态回调 */
export function onNaviStateChange(cb: NaviCallback): () => void {
  _callbacks.push(cb);
  return () => { _callbacks = _callbacks.filter(c => c !== cb); };
}

/** 设置到达回调 */
export function onArrival(cb: () => void): void {
  _arrivalCallback = cb;
}

/** 用户操作地图时重置自动隐藏计时器，恢复UI显示并重新计时3秒 */
export function resetNavUiAutoHide(): void {
  if (!_isNavigating) return;
  useMapStore.getState().setNavUiHidden(false);
  if (_autoHideTimer) {
    clearTimeout(_autoHideTimer);
  }
  _autoHideTimer = setTimeout(() => {
    if (_isNavigating) {
      useMapStore.getState().setNavUiHidden(true);
    }
  }, 3000);
}

function notify() {
  const snapshot: NaviStateSnapshot = {
    isNavigating: _isNavigating,
    currentStepIndex: _currentStepIndex,
    currentPosition: _currentPosition,
    heading: _currentHeading,
    prevStepEndIndex: _routeData
      ? _routeData.steps.slice(0, _currentStepIndex + 1).reduce((sum, s) => sum + s.polyline.length, 0) - 1
      : 0,
    remainingDistance: calcRemainingDistance(),
    elapsedSec: _elapsedSec,
    destLat: _destLat,
    destLng: _destLng,
    destName: _destName,
    mode: _mode,
    routeData: _routeData,
  };
  _callbacks.forEach(cb => cb(snapshot));
}

// ========== GPS 定位 ==========

/** 请求位置权限（仅触发一次） */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/** 获取当前位置（WGS84），自动处理权限请求 */
export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  const ok = await requestLocationPermission();
  if (!ok) return null;
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (e) {
    console.error('[NaviService] getCurrentPosition error:', e);
    return null;
  }
}

// ========== 路径规划（高德 REST API）==========

function parseAmapPolyline(polylineStr: string): [number, number][] {
  return polylineStr.split(';').filter(Boolean).map(seg => {
    const [lng, lat] = seg.split(',').map(Number);
    return [lng, lat] as [number, number];
  });
}

/** 通过后端代理调用高德路径规划API */
export async function planRoute(
  originWgs: [number, number],
  destWgs: [number, number],
  mode: NaviMode = 'drive',
): Promise<RouteData | null> {
  const [oLat, oLng] = wgs84ToGcj02(originWgs[0], originWgs[1]);
  const [dLat, dLng] = wgs84ToGcj02(destWgs[0], destWgs[1]);
  const originStr = `${oLng},${oLat}`;
  const destStr = `${dLng},${dLat}`;

  try {
    const directionUrl = await getDirectionProxyUrl();
    console.log('[NaviService] planRoute via proxy:', directionUrl, { origin: originStr, destination: destStr, mode });

    const res = await axios.get(directionUrl, {
      params: { origin: originStr, destination: destStr, mode },
      timeout: 20000,
    });
    const result = res.data;

    if (!result.success || !result.data) {
      const errMsg = result.error || '请求失败';
      console.error('[NaviService] proxy error:', errMsg);
      throw new Error(`路线规划失败: ${errMsg}`);
    }

    const routeData = result.data;
    if (!routeData.paths || routeData.paths.length === 0) {
      throw new Error('未找到可用的导航路线，请更换出行方式或检查起终点');
    }

    const path = routeData.paths[0];
    const steps: RouteStep[] = (path.steps || []).map((step: any) => ({
      instruction: step.instruction || '',
      polyline: parseAmapPolyline(step.polyline || ''),
      distance: parseFloat(step.distance) || 0,
      duration: parseFloat(step.duration) || 0,
      road: step.road || '',
    }));

    const flatPolyline: [number, number][] = [];
    for (const s of steps) {
      flatPolyline.push(...s.polyline);
    }

    return {
      steps,
      totalDistance: parseFloat(path.distance) || 0,
      totalDuration: parseFloat(path.duration) || 0,
      flatPolyline,
      origin: [oLat, oLng],
      destination: [dLat, dLng],
    };
  } catch (e: any) {
    console.error('[NaviService] planRoute error:', e.message || e);
    return null;
  }
}

// ========== 导航生命周期 ==========

/** 启动导航 */
export async function startNavigation(
  destWgs: { lat: number; lng: number },
  name: string,
  mode: NaviMode = 'drive',
  originWgs?: { lat: number; lng: number },
): Promise<boolean> {
  // 1. 权限检查
  const ok = await requestLocationPermission();
  if (!ok) return false;

  // 2. 获取起点
  let origin = originWgs;
  if (!origin) {
    const pos = await getCurrentPosition();
    if (!pos) return false;
    origin = pos;
  }

  _currentPosition = [origin.lat, origin.lng];
  _destLat = destWgs.lat;
  _destLng = destWgs.lng;
  _destName = name;
  _mode = mode;

  // 3. 规划路线
  let route: RouteData | null = null;
  try {
    route = await planRoute(
      [origin.lat, origin.lng],
      [destWgs.lat, destWgs.lng],
      mode,
    );
  } catch (e: any) {
    console.error('[NaviService] startNavigation planRoute error:', e?.message || e);
    return false;
  }
  if (!route) return false;

  _routeData = route;
  _currentStepIndex = 0;
  _lastSpokenStepIndex = -1;
  _approachingSpoken = new Set();
  _elapsedSec = 0;
  _startTime = Date.now();
  _isNavigating = true;
  useMapStore.getState().setIsNavigating(true);
  useMapStore.getState().setNavUiHidden(false);

  notify();

  // 4. 开始GPS跟踪
  startLocationTracking();

  // 5. 开始计时
  _elapsedTimer = setInterval(() => {
    _elapsedSec = Math.floor((Date.now() - _startTime) / 1000);
    notify();
  }, 1000);

  // 6. 播报首条指令
  speakStep(0);

  // 7. 3秒后自动隐藏不相关UI
  _autoHideTimer = setTimeout(() => {
    if (_isNavigating) {
      useMapStore.getState().setNavUiHidden(true);
    }
  }, 3000);

  return true;
}

/** 停止导航 */
export function stopNavigation(): void {
  _isNavigating = false;
  useMapStore.getState().setIsNavigating(false);
  useMapStore.getState().setNavUiHidden(false);
  stopLocationTracking();
  if (_elapsedTimer) { clearInterval(_elapsedTimer); _elapsedTimer = null; }
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  if (_autoHideTimer) { clearTimeout(_autoHideTimer); _autoHideTimer = null; }
  _routeData = null;
  _currentStepIndex = 0;
  _currentPosition = null;
  _currentPositionGcj = null;
  Speech.stop();
  notify();
}

function startLocationTracking() {
  stopLocationTracking();
  Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 1,
      timeInterval: 500,
    },
    (loc) => {
      if (!_isNavigating) return;
      const { latitude, longitude, heading } = loc.coords;
      _currentPosition = [latitude, longitude];
      _currentPositionGcj = wgs84ToGcj02(latitude, longitude);
      _currentHeading = (heading !== null && heading !== undefined && !isNaN(heading)) ? heading : _currentHeading;

      updateStepProgress();
      notify();

      if (checkArrival()) {
        handleArrival();
      }
    },
  ).then(sub => { _locationSub = sub; });
}

function stopLocationTracking() {
  if (_locationSub) {
    _locationSub.remove();
    _locationSub = null;
  }
}

// ========== 路线跟踪 ==========

/** 计算两点距离（米）Haversine */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcRemainingDistance(): number {
  if (!_routeData || !_currentPositionGcj) return 0;
  const flat = _routeData.flatPolyline;
  if (flat.length === 0) return 0;
  // 从当前位置到路线末端沿路线剩余距离
  const [gcjLat, gcjLng] = _currentPositionGcj;
  // 找到路线上的最近点索引
  const nearestIdx = findNearestPointOnPolyline(gcjLat, gcjLng, flat);
  // 从最近点到终点的距离
  let remaining = 0;
  // 到 nearestIdx 点的直线距离
  const [nlng, nlat] = flat[nearestIdx];
  remaining += haversine(gcjLat, gcjLng, nlat, nlng);
  // 从 nearestIdx 沿路线到终点的累积距离
  for (let i = nearestIdx; i < flat.length - 1; i++) {
    remaining += haversine(flat[i][1], flat[i][0], flat[i + 1][1], flat[i + 1][0]);
  }
  return remaining;
}

function findNearestPointOnPolyline(lat: number, lng: number, polyline: [number, number][]): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < polyline.length; i++) {
    const d = haversine(lat, lng, polyline[i][1], polyline[i][0]);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return minIdx;
}

function updateStepProgress() {
  if (!_routeData || !_currentPositionGcj) return;
  const [gcjLat, gcjLng] = _currentPositionGcj;
  const flat = _routeData.flatPolyline;
  if (flat.length === 0) return;

  // 找到路线上最近点
  const nearestIdx = findNearestPointOnPolyline(gcjLat, gcjLng, flat);

  // 确定当前处于哪个步骤
  let cumulativeLen = 0;
  for (let i = 0; i < _routeData.steps.length; i++) {
    cumulativeLen += _routeData.steps[i].polyline.length;
    if (nearestIdx < cumulativeLen) {
      if (i !== _currentStepIndex) {
        _currentStepIndex = i;
        speakStep(i);
      }
      break;
    }
  }

  // 接近下一个转向点时播报（50米内）
  if (_currentStepIndex < _routeData.steps.length - 1) {
    const nextStepEndIdx = _routeData.steps.slice(0, _currentStepIndex + 1)
      .reduce((sum, s) => sum + s.polyline.length, 0) - 1;
    if (nextStepEndIdx < flat.length) {
      const endPoint = flat[nextStepEndIdx];
      const distToTurn = haversine(gcjLat, gcjLng, endPoint[1], endPoint[0]);
      if (distToTurn < 80 && !_approachingSpoken.has(_currentStepIndex)) {
        _approachingSpoken.add(_currentStepIndex);
        const nextInstruction = _routeData.steps[_currentStepIndex + 1]?.instruction;
        if (nextInstruction) {
          Speech.speak(`前方${Math.round(distToTurn)}米，${nextInstruction}`, { language: 'zh-CN' });
        }
      }
    }
  }
}

function checkArrival(): boolean {
  if (!_routeData || !_currentPositionGcj) return false;
  const [gcjLat, gcjLng] = _currentPositionGcj;
  const destGcj = _routeData.destination;
  const dist = haversine(gcjLat, gcjLng, destGcj[1], destGcj[0]);
  return dist < 50; // 50米内认为到达
}

function handleArrival() {
  Speech.speak('您已到达目的地，导航结束', { language: 'zh-CN' });
  _arrivalCallback?.();
  // 自动结束
  setTimeout(() => stopNavigation(), 3000);
}

// ========== TTS 语音 ==========
function speakStep(stepIndex: number) {
  if (!_routeData || stepIndex >= _routeData.steps.length) return;
  if (stepIndex === _lastSpokenStepIndex) return;
  _lastSpokenStepIndex = stepIndex;

  const step = _routeData.steps[stepIndex];
  if (!step || !step.instruction) return;

  // 当前步骤的预计距离
  const distText = step.distance >= 1000
    ? `约${(step.distance / 1000).toFixed(1)}公里`
    : `约${Math.round(step.distance)}米`;

  let text = step.instruction;
  if (stepIndex === 0) {
    text = `导航开始，${text}`;
  }
  Speech.speak(text, { language: 'zh-CN', rate: 0.85 });
}

// ========== 状态查询 ==========
export function getNaviState(): NaviStateSnapshot {
  return {
    isNavigating: _isNavigating,
    currentStepIndex: _currentStepIndex,
    currentPosition: _currentPosition,
    prevStepEndIndex: _routeData
      ? _routeData.steps.slice(0, _currentStepIndex + 1).reduce((sum, s) => sum + s.polyline.length, 0) - 1
      : 0,
    remainingDistance: calcRemainingDistance(),
    elapsedSec: _elapsedSec,
    destLat: _destLat,
    destLng: _destLng,
    destName: _destName,
    mode: _mode,
    routeData: _routeData,
  };
}

export function isNavigating(): boolean {
  return _isNavigating;
}

/** 获取用户当前位置（GCJ-02），用于地图显示 */
export function getCurrentPositionGcj(): [number, number] | null {
  return _currentPositionGcj;
}

/** 获取当前位置 heading（角度） */
export function getCurrentHeading(): number | null {
  return null; // 简单实现，可通过 Location.watchPositionAsync 的 heading 返回
}
