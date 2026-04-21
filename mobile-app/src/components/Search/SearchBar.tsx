import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, FlatList } from 'react-native';

export interface SearchResult {
  name: string;
  address: string;
  location: string;
}

interface SearchBarProps {
  onSearch: (keyword: string) => void;
  onResultSelect: (result: SearchResult) => void;
  placeholder?: string;
}

export default function SearchBar({
  onSearch,
  onResultSelect,
  placeholder = '搜索地点...',
}: SearchBarProps) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setIsSearching(true);
    onSearch(keyword);

    // 调用高德搜索API
    const searchResults = await searchPlace(keyword);
    setResults(searchResults);
    setShowResults(true);
    setIsSearching(false);
  };

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
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={keyword}
          onChangeText={setKeyword}
          placeholder={placeholder}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={isSearching}
        >
          <Text style={styles.searchButtonText}>
            {isSearching ? '...' : '搜索'}
          </Text>
        </TouchableOpacity>
        {keyword.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
          >
            <Text style={styles.clearButtonText}>×</Text>
          </TouchableOpacity>
        )}
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
                  }}
                >
                  <Text style={styles.resultName}>{item.name}</Text>
                  {item.address ? (
                    <Text style={styles.resultAddress}>{item.address}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
              style={styles.resultsList}
            />
          ) : (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>未找到相关地点</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  searchButton: {
    marginLeft: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    marginLeft: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  clearButtonText: {
    fontSize: 20,
    color: '#999',
  },
  resultsContainer: {
    marginTop: 10,
    maxHeight: 250,
  },
  resultsList: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  resultItem: {
    padding: 12,
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
    color: '#666',
    marginTop: 2,
  },
  noResults: {
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
  },
});