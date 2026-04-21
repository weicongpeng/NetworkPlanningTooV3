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
      return sites.filter((s: any) => {
        const nameMatch = s.name && s.name.toLowerCase().includes(lowerKeyword);
        const siteIdMatch = s.siteId && s.siteId.toLowerCase().includes(lowerKeyword);
        const sectorIdMatch = s.sectorId && s.sectorId.toLowerCase().includes(lowerKeyword);
        return nameMatch || siteIdMatch || sectorIdMatch;
      }).slice(0, 20);
    }
    return [];
  }

  async searchPlace(keyword: string) {
    const apiKey = '5299af602f4ee3cd7351c1bc7f32b1cb';
    const url = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(keyword)}&output=json`;
    const response = await fetch(url);
    return response.json();
  }
}

export const apiService = new ApiService();
