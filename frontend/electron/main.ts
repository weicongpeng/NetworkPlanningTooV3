import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { spawn } from 'child_process'

// 在 CommonJS 模式下 __filename 和 __dirname 是全局变量
declare const __filename: string
declare const __dirname: string

let mainWindow: BrowserWindow | null = null
let backendProcess: any = null

// 开发环境检测
const isDev = process.env.NODE_ENV !== 'production'

console.log('Electron main process starting...')
console.log('isDev:', isDev)
console.log('__dirname:', __dirname)

// 创建浏览器窗口
function createWindow() {
  console.log('Creating browser window...')
  
  const preloadPath = path.join(__dirname, 'preload.js')
  console.log('Preload path:', preloadPath)
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    backgroundColor: '#0f172a',
    show: false
  })

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show')
    mainWindow?.show()
  })

  // 加载应用
  if (isDev) {
    console.log('Loading development URL: http://localhost:5173')
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
    
    // 在开发环境中，如果加载失败，自动重试
    let retryCount = 0
    const maxRetries = 10
    
    mainWindow.webContents.on('did-fail-load', () => {
      if (retryCount < maxRetries && mainWindow) {
        retryCount++
        console.log(`Retrying to load Vite (attempt ${retryCount}/${maxRetries})...`)
        setTimeout(() => {
          if (mainWindow) {
            mainWindow.loadURL('http://localhost:5173')
          }
        }, 2000)
      }
    })
  } else {
    const htmlPath = path.join(__dirname, '../dist-renderer/index.html')
    console.log('Loading HTML file:', htmlPath)
    mainWindow.loadFile(htmlPath)
  }

  mainWindow.on('closed', () => {
    console.log('Main window closed')
    mainWindow = null
  })

  // 监听加载错误
  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed')
  })

  // 使用 will-navigate 事件来处理导航失败
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('Started loading')
  })

  mainWindow.webContents.on('did-stop-loading', () => {
    console.log('Finished loading')
  })
}

// 启动后端服务
function startBackend() {
  // 开发环境下，后端由 start_app.bat 启动，这里跳过以避免端口冲突
  if (isDev) {
    console.log('Dev mode: Skipping internal backend start')
    return
  }

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
  console.log('App is ready')
  createWindow()

  // 启动后端服务
  startBackend()

  app.on('activate', () => {
    console.log('App activated')
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  console.log('All windows closed')
  if (process.platform !== 'darwin') {
    // 停止后端服务
    if (backendProcess) {
      console.log('Killing backend process')
      backendProcess.kill()
    }
    app.quit()
  }
})

app.on('before-quit', () => {
  console.log('App about to quit')
  // 停止后端服务
  if (backendProcess) {
    console.log('Killing backend process')
    backendProcess.kill()
  }
})
