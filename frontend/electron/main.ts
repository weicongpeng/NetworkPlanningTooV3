import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { spawn } from 'child_process'

let mainWindow: BrowserWindow | null = null
let backendProcess: any = null

// 开发环境检测
const isDev = process.env.NODE_ENV !== 'production'

// 创建浏览器窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    backgroundColor: '#0f172a',
    show: false
  })

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 启动后端服务
function startBackend() {
  const backendPath = path.join(
    process.resourcesPath,
    isDev ? '../backend' : 'app.asar.unpacked/backend'
  )

  const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3'

  backendProcess = spawn(pythonExecutable, [
    path.join(backendPath, 'main.py')
  ], {
    cwd: backendPath,
    stdio: 'inherit'
  })

  backendProcess.on('error', (error: Error) => {
    console.error('后端启动失败:', error)
  })

  backendProcess.on('exit', (code: number) => {
    console.log(`后端进程退出，代码: ${code}`)
    if (code !== 0 && !backendProcess.killed) {
      // 尝试重启
      setTimeout(startBackend, 5000)
    }
  })
}

// IPC 通信处理
ipcMain.handle('app-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-app-path', () => {
  return app.getAppPath()
})

ipcMain.handle('is-dev', () => {
  return isDev
})

// 应用生命周期
app.whenReady().then(() => {
  createWindow()

  // 启动后端服务
  startBackend()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 停止后端服务
    if (backendProcess) {
      backendProcess.kill()
    }
    app.quit()
  }
})

app.on('before-quit', () => {
  // 停止后端服务
  if (backendProcess) {
    backendProcess.kill()
  }
})
