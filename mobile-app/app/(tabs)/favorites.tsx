import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Clipboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useMapStore, MarkerPoint } from '../../src/store/mapStore';
import { startNaviToCoord } from '../../src/services/navi';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { favorites, removeFavorite, clearFavorites, setFocusLocation, setSearchMarker } = useMapStore();

  const handleDelete = (id: string) => {
    Alert.alert(
      '删除确认',
      '确定要删除这个收藏点吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => removeFavorite(id) },
      ]
    );
  };

  const handleClearAll = () => {
    if (favorites.length === 0) return;
    Alert.alert(
      '清空确认',
      '确定要清空所有收藏点吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '清空', style: 'destructive', onPress: () => clearFavorites() },
      ]
    );
  };

  const handleNavigate = (item: MarkerPoint) => {
    startNaviToCoord(item.lat, item.lng, item.name);
  };

  const handleCopy = (item: MarkerPoint) => {
    const text = `名称: ${item.name || '未命名'}\n坐标: ${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}\n时间: ${new Date(item.createdAt).toLocaleString()}`;
    Clipboard.setString(text);
    Alert.alert('已复制', '标记点信息已复制到剪贴板');
  };

  const handleLocation = (item: MarkerPoint) => {
    setFocusLocation({ lat: item.lat, lng: item.lng });
    setSearchMarker({ lat: item.lat, lng: item.lng, name: item.name || '收藏点' });
    navigation.navigate('map');
  };

  const renderItem = ({ item, index }: { item: MarkerPoint; index: number }) => (
    <View style={styles.item}>
      <View style={styles.itemIndex}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name || '未命名'}</Text>
        <Text style={styles.itemCoord}>
          {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
        </Text>
        <Text style={styles.itemTime}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
        <View style={styles.itemActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLocation(item)}>
            <Text style={styles.actionBtnText}>位置</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleNavigate(item)}>
            <Text style={styles.actionBtnText}>导航</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleCopy(item)}>
            <Text style={styles.actionBtnText}>复制</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteAction]} onPress={() => handleDelete(item.id)}>
            <Text style={[styles.actionBtnText, styles.deleteActionText]}>删除</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>我的收藏 ({favorites.length})</Text>
        {favorites.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearBtn}>清空全部</Text>
          </TouchableOpacity>
        )}
      </View>
      {favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⭐</Text>
          <Text style={styles.emptyText}>暂无收藏</Text>
          <Text style={styles.emptyHint}>在地图打点后，点击星标收藏标记点</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  clearBtn: { fontSize: 14, color: '#E53935' },
  list: { padding: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFB300',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  indexText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  itemCoord: { fontSize: 12, color: '#666', fontFamily: 'monospace', marginBottom: 2 },
  itemTime: { fontSize: 11, color: '#999' },
  itemActions: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionBtnText: { color: '#555', fontSize: 11, fontWeight: '600' },
  deleteAction: {
    backgroundColor: '#FFEBEE',
    borderColor: '#EF9A9A',
  },
  deleteActionText: { color: '#E53935' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: '#999' },
});
