# 应用打包指南

本文档介绍如何将网络规划工具打包为桌面应用程序。

## 打包前准备

### 1. 环境要求

- **Node.js**: 18.0 或更高版本
- **Python**: 3.10 或更高版本
- **操作系统**: Windows 10/11、macOS 10.15+、Linux (Ubuntu 20.04+)

### 2. 安装前端依赖

```bash
cd frontend
npm install
```

### 3. 准备后端环境

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 4. 准备应用图标

图标文件应放置在 `frontend/build/` 目录下：

| 平台 | 图标文件 | 尺寸要求 |
|------|----------|----------|
| Windows | `icon.ico` | 256x256 像素及以上 |
| macOS | `icon.icns` | 512x512 像素及以上 |
| Linux | `icons/` 目录 | PNG 格式，多种尺寸 |

**图标制作工具推荐**：
- Windows: 使用 ImageMagick 或在线工具生成 `.ico` 文件
- macOS: 使用 `iconutil` 或 `icns-builder` 生成 `.icns` 文件
- Linux: 准备 16x16、32x32、48x48、64x64、128x128、256x256 像素的 PNG 图标

## 打包命令

### Windows 打包

```bash
cd frontend

# 完整打包（生成安装包和便携版）
npm run build
npx electron-builder --win

# 仅生成 NSIS 安装包
npx electron-builder --win nsis

# 仅生成便携版
npx electron-builder --win portable
```

### macOS 打包

```bash
cd frontend

# 完整打包（生成 DMG 和 ZIP）
npm run build
npx electron-builder --mac

# 仅生成 DMG
npx electron-builder --mac dmg

# 仅生成 ZIP
npx electron-builder --mac zip
```

### Linux 打包

```bash
cd frontend

# 完整打包（生成 AppImage 和 deb）
npm run build
npx electron-builder --linux

# 仅生成 AppImage
npx electron-builder --linux AppImage

# 仅生成 deb 包
npx electron-builder --linux deb
```

## 输出文件位置

打包完成后，输出文件位于 `frontend/release/` 目录：

```
frontend/release/
├── 网络规划工具-2.0.0-setup.exe      # Windows NSIS 安装包
├── 网络规划工具-2.0.0-便携版.exe      # Windows 便携版
├── 网络规划工具-2.0.0.dmg             # macOS DMG 安装包
├── 网络规划工具-2.0.0-mac.zip         # macOS ZIP 压缩包
├── 网络规划工具-2.0.0.AppImage        # Linux AppImage
└── 网络规划工具_2.0.0_amd64.deb       # Linux deb 包
```

## 测试打包

### 本地测试（不生成安装包）

```bash
cd frontend

# 构建应用
npm run build

# 使用 electron-builder 打包但不压缩（快速测试）
npx electron-builder --dir
```

测试包位于 `frontend/release/win-unpacked/` 目录，可直接运行 `网络规划工具.exe` 进行测试。

### 手动测试流程

1. 运行打包后的应用程序
2. 检查应用是否正常启动
3. 验证后端服务是否正常运行
4. 测试核心功能（数据导入、地图显示、规划功能等）
5. 检查日志输出是否正常

## 打包配置说明

打包配置位于 `frontend/electron-builder.json`，主要配置项：

| 配置项 | 说明 |
|--------|------|
| `appId` | 应用唯一标识符 |
| `productName` | 应用显示名称 |
| `directories.output` | 输出目录 |
| `extraResources` | 额外资源（后端代码） |
| `win.target` | Windows 输出格式 |
| `mac.target` | macOS 输出格式 |
| `linux.target` | Linux 输出格式 |

## 常见问题排查

### 1. 图标不显示

**原因**：图标文件缺失或格式不正确

**解决方案**：
```bash
# 检查图标文件是否存在
ls frontend/build/icon.ico     # Windows
ls frontend/build/icon.icns    # macOS
ls frontend/build/icons/       # Linux

# 使用 ImageMagick 生成 ico 文件
convert logo.png -resize 256x256 icon.ico

# macOS 生成 icns 文件
mkdir icon.iconset
sips -z 16 16 logo.png --out icon.iconset/icon_16x16.png
sips -z 32 32 logo.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 logo.png --out icon.iconset/icon_32x32.png
sips -z 64 64 logo.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 logo.png --out icon.iconset/icon_128x128.png
sips -z 256 256 logo.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 logo.png --out icon.iconset/icon_256x256.png
sips -z 512 512 logo.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 logo.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 logo.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o frontend/build/icon.icns
```

### 2. 后端服务无法启动

**原因**：Python 虚拟环境未正确打包或依赖缺失

**解决方案**：
```bash
# 确保后端虚拟环境已创建并安装所有依赖
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# 检查虚拟环境是否完整
pip list

# 确认 electron-builder.json 中的 extraResources 配置正确
```

**检查后端路径配置**：
确保 Electron 主进程中后端路径配置正确：
```javascript
// 开发环境
const backendPath = path.join(__dirname, '../../backend')

// 生产环境
const backendPath = path.join(process.resourcesPath, 'app.asar.unpacked/backend')
```

### 3. 打包失败

**常见错误及解决方案**：

#### 错误：`Cannot find module 'electron'`
```bash
# 重新安装依赖
cd frontend
rm -rf node_modules
npm install
```

#### 错误：`ENOENT: no such file or directory, open '...'`
```bash
# 确保先执行 build 命令
npm run build
npx electron-builder
```

#### 错误：`Python version not supported`
```bash
# 检查 Python 版本
python --version  # 应为 3.10+

# 如需使用特定版本
py -3.10 -m venv venv
```

#### 错误：`Permission denied` (macOS/Linux)
```bash
# 添加执行权限
chmod +x node_modules/.bin/electron-builder
```

### 4. 打包后应用闪退

**排查步骤**：
```bash
# Windows: 查看事件查看器
eventvwr.msc

# macOS: 查看控制台日志
open /Applications/Utilities/Console.app

# Linux: 终端运行查看输出
./网络规划工具-2.0.0.AppImage
```

**常见原因**：
- 后端服务启动失败
- 缺少运行时依赖
- 路径配置错误

### 5. 安装包体积过大

**优化方案**：
```json
// electron-builder.json 中添加排除配置
{
  "files": [
    "dist-renderer/**/*",
    "dist-electron/**/*",
    "!node_modules/**/*",
    "!**/*.map",
    "!**/*.ts",
    "!**/test/**/*"
  ]
}
```

### 6. Windows SmartScreen 警告

**原因**：应用未进行代码签名

**解决方案**：
1. 购买代码签名证书
2. 在 `electron-builder.json` 中配置签名：
```json
{
  "win": {
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "your-password",
    "signingHashAlgorithms": ["sha256"]
  }
}
```

## 打包流程检查清单

- [ ] Node.js 版本 >= 18
- [ ] Python 版本 >= 3.10
- [ ] 前端依赖已安装 (`npm install`)
- [ ] 后端虚拟环境已创建
- [ ] 后端依赖已安装 (`pip install -r requirements.txt`)
- [ ] 图标文件已准备
- [ ] 执行 `npm run build` 构建成功
- [ ] 执行打包命令成功
- [ ] 测试打包应用正常运行

## 相关文档

- [AGENTS.md](./AGENTS.md) - 项目开发指南
- [electron-builder 官方文档](https://www.electron.build/)
- [Electron 官方文档](https://www.electronjs.org/docs)
