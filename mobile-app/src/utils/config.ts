import Constants from 'expo-constants';

const AMAP_CONFIG = {
  androidKey: 'YOUR_ANDROID_SDK_KEY',
  webJsKey: '9fa8b08372c3c764fd14d0bc74862ad1',
};

function getBackendBaseUrl(): string {
  // 1. 环境变量优先（可用于生产或自定义配置）
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

  // 2. 从 Expo 调试主机推导电脑的局域网 IP
  // Expo Go 开发模式下 hostUri 类似 "192.168.x.x:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:8000`;
  }

  // 3. 回退到 localhost（仅适用于模拟器或本机调试）
  return 'http://localhost:8000';
}

const BACKEND_CONFIG = {
  baseUrl: getBackendBaseUrl(),
  apiPrefix: '/api/v1',
};

export { AMAP_CONFIG, BACKEND_CONFIG };
