import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';

export interface SearchResult {
  name: string;
  address: string;
  location: string;
}

type SearchMode = 'place' | 'parameter' | 'coordinate';

interface SearchBarProps {
  onSearch: (keyword: string) => void;
  onResultSelect: (result: SearchResult) => void;
  placeholder?: string;
  onModeChange?: (mode: SearchMode) => void;
  onClear?: () => void;
}

export default function SearchBar({
  onSearch,
  onResultSelect,
  placeholder = '搜索地点...',
  onModeChange,
  onClear,
}: SearchBarProps) {
  const insets = useSafeAreaInsets();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('place');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(async (kw: string, mode: SearchMode) => {
    if (!kw.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);

    if (mode === 'place') {
      const searchResults = await searchPlace(kw);
      setResults(searchResults);
      setShowResults(true);
    } else if (mode === 'parameter') {
      const paramResults = await apiService.searchParameter(kw);
      setResults(paramResults.map((s: any) => ({
        name: s.name || '未命名小区',
        address: `${s.networkType || ''} | 基站: ${s.siteId || 'N/A'} | PCI: ${s.pci || 'N/A'}`,
        location: `${s.longitude},${s.latitude}`,
      })));
      setShowResults(true);
    } else if (mode === 'coordinate') {
      const coordMatch = kw.match(/^\s*(-?\d+\.?\d*)\s*[,，\s]\s*(-?\d+\.?\d*)\s*$/);
      if (coordMatch) {
        setResults([{
          name: `坐标定位 (${coordMatch[1].trim()}, ${coordMatch[2].trim()})`,
          address: '点击定位到该坐标',
          location: `${coordMatch[1].trim()},${coordMatch[2].trim()}`,
        }]);
        setShowResults(true);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }

    setIsSearching(false);
  }, []);

  // 实时搜索：输入变化时触发（debounce 300ms）
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      performSearch(keyword, searchMode);
      onSearch(keyword);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [keyword, searchMode, performSearch, onSearch]);

  const searchPlace = async (kw: string): Promise<SearchResult[]> => {
    const apiKey = '5299af602f4ee3cd7351c1bc7f32b1cb';
    const url = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(kw)}&output=json`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === '1' && data.pois) {
        return data.pois.map((poi: any) => ({
          name: poi.name,
          address: poi.address || '',
          location: poi.location,
        }));
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
    return [];
  };

  const handleClear = () => {
    setKeyword('');
    setResults([]);
    setShowResults(false);
    onClear?.();
  };

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    onModeChange?.(mode);
    setKeyword('');
    setResults([]);
    setShowResults(false);
  };

  const renderModeToggle = () => (
    <View style={styles.modeToggle}>
      <TouchableOpacity
        style={[styles.modeBtn, searchMode === 'place' && styles.modeBtnActive]}
        onPress={() => handleModeChange('place')}
      >
        <Text style={[styles.modeBtnText, searchMode === 'place' && styles.modeBtnTextActive]}>地点</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.modeBtn, searchMode === 'parameter' && styles.modeBtnActive]}
        onPress={() => handleModeChange('parameter')}
      >
        <Text style={[styles.modeBtnText, searchMode === 'parameter' && styles.modeBtnTextActive]}>小区</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.modeBtn, searchMode === 'coordinate' && styles.modeBtnActive]}
        onPress={() => handleModeChange('coordinate')}
      >
        <Text style={[styles.modeBtnText, searchMode === 'coordinate' && styles.modeBtnTextActive]}>坐标</Text>
      </TouchableOpacity>
    </View>
  );

  const getPlaceholder = () => {
    switch (searchMode) {
      case 'place': return '搜索地点...';
      case 'parameter': return '搜索小区名/基站ID...';
      case 'coordinate': return '输入经纬度，如: 113.123,23.456';
      default: return placeholder;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(12, insets.top) }]}>
      {renderModeToggle()}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={keyword}
          onChangeText={setKeyword}
          placeholder={getPlaceholder()}
          onSubmitEditing={() => performSearch(keyword, searchMode)}
          returnKeyType="search"
        />
        {keyword.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>×</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => performSearch(keyword, searchMode)}
          disabled={isSearching}
        >
          <Text style={styles.searchButtonText}>
            {isSearching ? '...' : '搜索'}
          </Text>
        </TouchableOpacity>
      </View>
      {showResults && (
        <View style={styles.resultsContainer}>
          {results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => {
                    onResultSelect(item);
                    setShowResults(false);
                    setKeyword('');
                    setResults([]);
                  }}
                >
                  <Text style={styles.resultName}>{item.name}</Text>
                  {item.address ? (
                    <Text style={styles.resultAddress}>{item.address}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
              style={styles.resultsList}
              keyboardShouldPersistTaps="always"
            />
          ) : (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>
                {searchMode === 'coordinate' ? '请输入正确格式，如: 113.123,23.456' : '未找到相关结果'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 6,
    backgroundColor: '#fff',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  topPadding: {
    paddingTop: 16,
  },
  modeToggle: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: '#007AFF' },
  modeBtnText: { fontSize: 12, color: '#555', fontWeight: '500' },
  modeBtnTextActive: { color: '#fff' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingRight: 40,
    paddingVertical: 0,
    fontSize: 14,
    backgroundColor: '#fafafa',
    textAlignVertical: 'center',
  },
  searchButton: {
    marginLeft: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    minWidth: 52,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    position: 'absolute',
    right: 68,
    top: 4,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  clearButtonText: {
    fontSize: 24,
    color: '#999',
    fontWeight: '300',
  },
  resultsContainer: {
    marginTop: 10,
    maxHeight: 280,
    borderRadius: 8,
    overflow: 'hidden',
  },
  resultsList: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  resultItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  resultAddress: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },
  noResults: {
    padding: 24,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
  },
});