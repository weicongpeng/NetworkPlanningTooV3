import axios, { AxiosInstance } from 'axios';
import { BACKEND_CONFIG } from '../utils/config';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BACKEND_CONFIG.baseUrl + BACKEND_CONFIG.apiPrefix,
      timeout: 30000,
    });
  }

  async getSystemInfo() {
    const response = await this.client.get('/system/info');
    return response.data;
  }

  async getMapData() {
    const response = await this.client.get('/map/data');
    return response.data;
  }

  async getLayers(dataId: string) {
    const response = await this.client.get(`/geo-data/layers/${dataId}`);
    return response.data;
  }

  async getDataList() {
    const response = await this.client.get('/data/list');
    return response.data;
  }

  async searchParameter(keyword: string) {
    const response = await this.client.get('/map/data', { params: { limit: 10000 } });
    if (response.data.success && response.data.data) {
      const sites = response.data.data.sites || [];
      const lowerKeyword = keyword.toLowerCase();
      const results: any[] = [];

      sites.forEach((site: any) => {
        if (!site.sectors || !Array.isArray(site.sectors)) return;
        site.sectors.forEach((sector: any) => {
          const sectorName = sector.name || '';
          const siteId = site.id || site.siteId || '';
          const sectorId = sector.id || sector.cellId || '';
          if (
            sectorName.toLowerCase().includes(lowerKeyword) ||
            siteId.toLowerCase().includes(lowerKeyword) ||
            sectorId.toLowerCase().includes(lowerKeyword)
          ) {
            results.push({
              name: sectorName,
              siteId: siteId,
              sectorId: sectorId,
              latitude: sector.latitude ?? site.latitude,
              longitude: sector.longitude ?? site.longitude,
              networkType: site.networkType,
              pci: sector.pci,
              azimuth: sector.azimuth,
            });
          }
        });
      });

      return results.slice(0, 20);
    }
    return [];
  }

  async searchPlace(keyword: string) {
    const apiKey = '9fa8b08372c3c764fd14d0bc74862ad1';
    const url = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(keyword)}&output=json`;
    const response = await fetch(url);
    return response.json();
  }

  async downloadData(dataId: string, filename: string) {
    const url = `${BACKEND_CONFIG.baseUrl}${BACKEND_CONFIG.apiPrefix}/data/${dataId}/download`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    // React Native 中无法直接下载文件到本地，返回 blob 和文件名供上层处理
    return { blob, filename };
  }

  async deleteData(dataId: string, force = false) {
    const response = await this.client.delete(`/data/${dataId}`, { params: { force } });
    return response.data;
  }

  async getDataPreview(dataId: string) {
    const response = await this.client.get(`/data/${dataId}`);
    return response.data;
  }
}

export const apiService = new ApiService();
