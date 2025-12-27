# 问题诊断与解决方案

## 当前状态

### ✅ 后端服务：正常运行
- Python API 服务成功启动在 http://127.0.0.1:8000
- API 文档可访问：http://127.0.0.1:8000/docs

### ❌ 前端服务：启动失败

**错误信息**：
```
Error: Cannot find module 'D:\mycode\NetworkPlanningTooV2\frontend\node_modules\wait-on\bin\wait-on'
```

**根本原因**：
1. `wait-on` 包没有被正确安装到 `node_modules` 中
2. Electron 包安装失败（网络连接问题：ECONNREFUSED 127.0.0.1:443）

## 解决方案

### 方案一：使用 Web 模式（推荐）

这是最简单和最可靠的方案，直接在浏览器中使用应用。

**启动步骤**：
```batch
start_web_only.bat
```

**访问地址**：
- 前端界面：http://localhost:5173
- 后端 API：http://127.0.0.1:8000
- API 文档：http://127.0.0.1:8000/docs

**优点**：
- 不需要安装 Electron
- 启动速度快
- 适用于开发和测试

### 方案二：修复 Electron 安装

如果你需要使用 Electron 桌面应用，需要配置 npm 镜像源。

**步骤**：

1. 配置淘宝镜像源：
```batch
npm config set registry https://registry.npmmirror.com
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
```

2. 清理并重新安装：
```batch
cd frontend
rmdir /s /q node_modules
del package-lock.json
npm install
```

3. 启动：
```batch
npm run dev
```

### 方案三：手动启动

**启动后端**：
```batch
cd backend
python main.py
```

**启动前端（Vite）**：
```batch
cd frontend
npm run dev:vite
```

然后在浏览器中访问 http://localhost:5173

## 文件说明

| 文件 | 用途 |
|------|------|
| `start_web_only.bat` | Web 模式启动脚本（推荐） |
| `start_fixed.bat` | 修复版启动脚本 |
| `fix_electron.bat` | Electron 修复诊断脚本 |
| `fix_frontend.bat` | 前端依赖修复脚本 |

## 常见问题

### Q: 为什么 Electron 下载失败？
A: Electron 的二进制文件托管在 GitHub 上，在某些网络环境下可能无法访问。建议使用 Web 模式或配置镜像源。

### Q: wait-on 是什么？
A: wait-on 是一个工具，用于等待某个服务（如 Vite）启动后再启动 Electron。在 Web 模式下不需要它。

### Q: 如何确认服务是否启动成功？
A:
- 后端：访问 http://127.0.0.1:8000/docs 应该看到 API 文档
- 前端：访问 http://localhost:5173 应该看到应用界面

## 推荐启动流程

**初次使用**：
1. 运行 `start_web_only.bat`
2. 等待服务启动
3. 在浏览器中打开 http://localhost:5173

**需要 Electron 桌面版时**：
1. 先配置镜像源（见方案二）
2. 运行 `fix_electron.bat` 查看详细步骤
3. 按提示配置并安装

## 技术细节

### 错误堆栈分析
```
Error: Cannot find module 'wait-on'
  at process.module.(node:internal/main/run_main_module:36:49)
```

这表明：
1. package.json 中定义了 `dev:electron` 脚本使用 `wait-on`
2. 但 `wait-on` 包没有在 node_modules 中
3. 可能是因为 `npm install` 中途失败或未完成

### 为什么 Web 模式可以工作？
- Vite 开发服务器不需要 `wait-on`
- 不需要 Electron
- 所有功能都可以通过浏览器访问
- 前后端通过 HTTP API 通信
