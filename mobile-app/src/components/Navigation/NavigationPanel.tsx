/**
 * NavigationPanel - 全功能导航面板
 *
 * 三种状态：
 * 1. 设置模式：选择出行方式，确认起点/终点，点击"开始导航"
 * 2. 导航中：显示实时导航信息（剩余距离、时间、下一指令）
 * 3. 结束：导航完成摘要
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';

// Android 需要启用 LayoutAnimation
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { MapViewRef } from '../Map/MapView';
import {
  requestLocationPermission, getCurrentPosition, planRoute,
  startNavigation, stopNavigation, isNavigating,
  onNaviStateChange, NaviStateSnapshot, NaviMode,
} from '../../services/navigationService';
import { wgs84ToGcj02 } from '../../utils/coordinate';

interface Props {
  visible: boolean;
  destLat: number;   // WGS84
  destLng: number;   // WGS84
  destName: string;
  onClose: () => void;
  mapRef?: React.RefObject<MapViewRef>;
  // 可指定起点（null = 使用GPS自动获取）
  originLat?: number;
  originLng?: number;
}

/** 格式化距离 */
function formatDist(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

/** 格式化时长（秒） */
function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}时${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

const MODE_OPTIONS: { key: NaviMode; label: string; icon: string }[] = [
  { key: 'drive', label: '驾车', icon: '🚗' },
  { key: 'walk', label: '步行', icon: '🚶' },
  { key: 'bicycling', label: '骑行', icon: '🚲' },
];

export default function NavigationPanel({
  visible, destLat, destLng, destName, onClose, mapRef, originLat, originLng,
}: Props) {
  // 设置阶段
  const [setupMode, setSetupMode] = useState(true);
  const [naviMode, setNaviMode] = useState<NaviMode>('drive');
  const [startPos, setStartPos] = useState<{ lat: number; lng: number } | null>(null);
  const [routePreview, setRoutePreview] = useState<{
    distance: number; duration: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 导航中
  const [navState, setNavState] = useState<NaviStateSnapshot | null>(null);
  const [statusText, setStatusText] = useState('准备导航...');
  const [panelExpanded, setPanelExpanded] = useState(true);
  // 用于在导航模式下重新绘制路线（解决setupMode cleanup时序问题）
  const [naviRouteKey, setNaviRouteKey] = useState(0);

  // 切换展开/折叠
  const togglePanel = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPanelExpanded(prev => !prev);
  }, []);

  // 重置状态
  const resetState = useCallback(() => {
    setSetupMode(true);
    setRoutePreview(null);
    setNavState(null);
    setErrorMsg('');
    setStatusText('准备导航...');
    setIsLoading(false);
  }, []);

  // 可见性变化 - 重置状态
  useEffect(() => {
    if (visible) {
      resetState();
    }
  }, [visible]);

  // 监听导航状态
  useEffect(() => {
    const unsub = onNaviStateChange((state) => {
      setNavState(state);
      if (state.isNavigating && state.routeData) {
        const step = state.routeData.steps[state.currentStepIndex];
        if (step) {
          setStatusText(step.instruction || '导航中...');
        }
      }
      // 导航中更新地图上的用户位置（含方向角）
      if (state.isNavigating && state.currentPosition && mapRef?.current) {
        const [gcjLat, gcjLng] = wgs84ToGcj02(
          state.currentPosition[0],
          state.currentPosition[1],
        );
        const heading = state.heading !== null && state.heading !== undefined ? state.heading : undefined;
        mapRef.current.updateUserLocation(gcjLat, gcjLng, heading);
        // 启动 auto-fit：用户 5 秒无操作后自动恢复定位视图
        mapRef.current.startAutoFit();
      }
    });
    return unsub;
  }, []);

  // 进入导航模式后重新绘制路线（解决setupMode cleanup时序导致路线消失的问题）
  useEffect(() => {
    if (setupMode || !startPos || !mapRef?.current || naviRouteKey === 0) return;
    let cancelled = false;
    (async () => {
      const route = await planRoute(
        [startPos.lat, startPos.lng],
        [destLat, destLng],
        naviMode,
      );
      if (cancelled || !route || !mapRef?.current) return;
      mapRef.current.clearRoute();
      mapRef.current.addRoute(route.flatPolyline);
      mapRef.current.fitRouteBounds(route.flatPolyline);
      const [gcjLat, gcjLng] = wgs84ToGcj02(startPos.lat, startPos.lng);
      mapRef.current.updateUserLocation(gcjLat, gcjLng);
      mapRef.current.moveCamera(gcjLat, gcjLng, 15);
      // 启用 auto-fit: 用户5秒无操作自动恢复路线全局视野
      mapRef.current.startAutoFit();
    })();
    return () => { cancelled = true; };
  }, [naviRouteKey]);

  // 获取起点
  const getOrigin = useCallback(async () => {
    if (originLat !== undefined && originLng !== undefined) {
      return { lat: originLat, lng: originLng };
    }
    const pos = await getCurrentPosition();
    return pos;
  }, [originLat, originLng]);

  // 加载路线预览
  useEffect(() => {
    if (!visible || !setupMode) return;
    (async () => {
      setIsLoading(true);
      setErrorMsg('');
      const origin = await getOrigin();
      if (!origin) {
        setErrorMsg('无法获取当前位置，请检查GPS权限');
        setIsLoading(false);
        return;
      }
      setStartPos(origin);
      // 预览路线
      try {
        const route = await planRoute(
          [origin.lat, origin.lng],
          [destLat, destLng],
          naviMode,
        );
        if (route) {
          setRoutePreview({ distance: route.totalDistance, duration: route.totalDuration });
          // 在地图上绘制路线预览
          if (mapRef?.current) {
            mapRef.current.clearRoute();
            mapRef.current.addRoute(route.flatPolyline);
            mapRef.current.fitRouteBounds(route.flatPolyline);
            // 如果有起点坐标，也移动视野到起点附近作为兜底
            if (origin) {
              const [gcjLat, gcjLng] = wgs84ToGcj02(origin.lat, origin.lng);
              mapRef.current.updateUserLocation(gcjLat, gcjLng);
            }
          }
        } else {
          setErrorMsg('未找到可用的导航路线');
        }
      } catch (e: any) {
        setErrorMsg(e?.message || '路线规划失败，请检查网络');
      }
      setIsLoading(false);
    })();
    return () => {
      // 关闭时清除路线
      if (mapRef?.current && !isNavigating()) {
        mapRef.current.clearRoute();
      }
    };
  }, [visible, setupMode, naviMode]);

  // 模式切换时重新加载预览
  const handleModeChange = (mode: NaviMode) => {
    setNaviMode(mode);
    setRoutePreview(null);
    setErrorMsg('');
  };

  // 开始导航
  const handleStartNavi = async () => {
    setIsLoading(true);
    const success = await startNavigation(
      { lat: destLat, lng: destLng },
      destName,
      naviMode,
      startPos || undefined,
    );
    setIsLoading(false);
    if (success) {
      setSetupMode(false);
      // 在地图上显示目的地标记（带小区名称标签）
      if (mapRef?.current) {
        const [gcjLat, gcjLng] = wgs84ToGcj02(destLat, destLng);
        mapRef.current.showDestinationMarker(gcjLat, gcjLng, destName);
      }
      // 启动 auto-fit：用户5秒无操作自动恢复定位视图
      if (mapRef?.current) {
        mapRef.current.startAutoFit();
      }
      // 触发 naviRouteKey 变化，让 useEffect 绘制路线（延迟确保 setupMode cleanup 先运行）
      setTimeout(() => setNaviRouteKey(k => k + 1), 50);
    } else {
      setErrorMsg('导航启动失败，请检查GPS和网络连接');
    }
  };

  // 结束导航
  const handleStopNavi = () => {
    stopNavigation();
    if (mapRef?.current) {
      mapRef.current.clearRoute();
      mapRef.current.hideDestinationMarker();
      mapRef.current.clearUserLocation();
      mapRef.current.stopAutoFit();
    }
    onClose();
  };

  // 关闭（非导航状态）
  const handleClose = () => {
    if (isNavigating()) return; // 导航中不能关闭
    if (mapRef?.current) {
      mapRef.current.clearRoute();
      mapRef.current.hideDestinationMarker();
      mapRef.current.clearUserLocation();
    }
    onClose();
  };

  if (!visible) return null;

  // === 导航设置界面 ===
  const renderSetup = () => (
    <View style={styles.panel}>
      {/* 标题 */}
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{destName || '目的地'}</Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* 起点/终点信息 */}
      <View style={styles.routeInfo}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, styles.startDot]} />
          <Text style={styles.routeText} numberOfLines={1}>
            {startPos ? `${startPos.lat.toFixed(5)}, ${startPos.lng.toFixed(5)}` : '获取位置中...'}
          </Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeRow}>
          <View style={[styles.dot, styles.endDot]} />
          <Text style={styles.routeText} numberOfLines={1}>
            {destName || `${destLat.toFixed(5)}, ${destLng.toFixed(5)}`}
          </Text>
        </View>
      </View>

      {/* 模式选择 */}
      <View style={styles.modeRow}>
        {MODE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.modeBtn, naviMode === opt.key && styles.modeBtnActive]}
            onPress={() => handleModeChange(opt.key)}
          >
            <Text style={styles.modeIcon}>{opt.icon}</Text>
            <Text style={[styles.modeLabel, naviMode === opt.key && styles.modeLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 路线预览 */}
      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>正在规划路线...</Text>
        </View>
      )}
      {errorMsg ? (
        <Text style={styles.errorMsg}>{errorMsg}</Text>
      ) : null}
      {routePreview && !isLoading && (
        <View style={styles.previewRow}>
          <Text style={styles.previewText}>
            距离: {formatDist(routePreview.distance)} | 预计: {formatDuration(routePreview.duration)}
          </Text>
        </View>
      )}

      {/* 开始导航按钮 */}
      <TouchableOpacity
        style={[styles.startBtn, isLoading && styles.startBtnDisabled]}
        onPress={handleStartNavi}
        disabled={isLoading || !!errorMsg}
      >
        <Text style={styles.startBtnText}>
          {isLoading ? '规划中...' : '开始导航'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // === 导航中界面 ===
  const renderNavigating = () => {
    const state = navState;

    return (
      <View style={styles.panel}>
        {/* 折叠/展开手柄 */}
        <TouchableOpacity
          style={styles.collapseHandle}
          onPress={togglePanel}
          activeOpacity={0.6}
        >
          <View style={styles.handleBar} />
          <Text style={styles.handleArrow}>{panelExpanded ? '﹀' : '︿'}</Text>
        </TouchableOpacity>

        {/* 精简信息条（折叠时始终显示） */}
        <View style={styles.collapsedBar}>
          <Text style={styles.collapsedDest} numberOfLines={1}>
            → {destName || '目的地'}
          </Text>
          <Text style={styles.collapsedStats}>
            {state ? formatDist(state.remainingDistance) : '--'}
            {' | '}
            {state ? formatDuration(state.elapsedSec) : '--'}
          </Text>
          <TouchableOpacity onPress={handleStopNavi} style={styles.exitBtnSmall}>
            <Text style={styles.exitBtnSmallText}>结束</Text>
          </TouchableOpacity>
        </View>

        {/* 展开内容 */}
        {panelExpanded && (
          <>
            {/* 下一路口指示 */}
            <View style={styles.instructionRow}>
              <Text style={styles.instructionText} numberOfLines={2}>
                {statusText}
              </Text>
            </View>

            {/* 距离/时间信息 */}
            <View style={styles.naviStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {state ? formatDist(state.remainingDistance) : '--'}
                </Text>
                <Text style={styles.statLabel}>剩余距离</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {state ? formatDuration(state.elapsedSec) : '--'}
                </Text>
                <Text style={styles.statLabel}>已用时间</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {state && state.routeData
                    ? formatDuration(Math.max(0, state.routeData.totalDuration - state.elapsedSec))
                    : '--'}
                </Text>
                <Text style={styles.statLabel}>预计剩余</Text>
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      {visible && (
        <>
          {/* 遮罩层：阻止点击地图区域（不可关闭面板，仅阻挡触摸穿透） */}
          {setupMode && (
            <View style={styles.overlayBackdrop} pointerEvents="auto" />
          )}
          {/* 底部面板 */}
          <View style={styles.container}>
            {setupMode ? renderSetup() : renderNavigating()}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    zIndex: 1000,
  },
  overlayBackdrop: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
  },
  container: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },

  // 通用面板
  panel: {
    padding: 16,
  },

  // 头部
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },

  // 路线信息
  routeInfo: {
    paddingLeft: 8,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  startDot: {
    backgroundColor: '#4CAF50',
  },
  endDot: {
    backgroundColor: '#E53935',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#ddd',
    marginLeft: 12,
  },
  routeText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },

  // 模式选择
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  modeBtnActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  modeIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  modeLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  modeLabelActive: {
    color: '#007AFF',
  },

  // 加载/错误
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#888',
  },
  errorMsg: {
    fontSize: 13,
    color: '#E53935',
    textAlign: 'center',
    paddingVertical: 8,
  },
  previewRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 13,
    color: '#555',
  },

  // 开始按钮
  startBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  startBtnDisabled: {
    opacity: 0.6,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },

  // === 导航中 ===
  // 折叠手柄
  collapseHandle: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: -8,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginBottom: 2,
  },
  handleArrow: {
    fontSize: 10,
    color: '#aaa',
    lineHeight: 12,
  },
  collapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
  collapsedDest: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  collapsedStats: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8,
  },
  exitBtnSmall: {
    backgroundColor: '#E53935',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 5,
  },
  exitBtnSmallText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  instructionRow: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },

  naviStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e0e0e0',
  },
});
