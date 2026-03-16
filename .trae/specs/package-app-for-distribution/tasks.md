# Tasks

- [x] Task 1: 准备打包所需的资源文件
  - [x] SubTask 1.1: 创建 Windows 应用图标 (build/icon.ico)
  - [x] SubTask 1.2: 创建 macOS 应用图标 (build/icon.icns)
  - [x] SubTask 1.3: 创建 Linux 应用图标 (build/icons/)
  - [x] SubTask 1.4: 创建安装程序横幅图片 (build/banner.bmp)

- [x] Task 2: 优化 package.json 打包脚本
  - [x] SubTask 2.1: 添加 `pack` 脚本用于本地测试打包
  - [x] SubTask 2.2: 添加 `dist` 脚本用于正式发布打包
  - [x] SubTask 2.3: 添加 `build:check` 脚本用于打包前检查
  - [x] SubTask 2.4: 更新 `build` 脚本确保正确构建顺序

- [x] Task 3: 优化 electron-builder.json 配置
  - [x] SubTask 3.1: 确认 extraResources 正确打包后端代码和虚拟环境
  - [x] SubTask 3.2: 优化 NSIS 安装程序配置（中文界面、安装选项）
  - [x] SubTask 3.3: 配置便携版命名规则
  - [x] SubTask 3.4: 确保文件过滤规则正确排除不必要的文件

- [x] Task 4: 创建打包前检查脚本
  - [x] SubTask 4.1: 检查前端 node_modules 是否存在
  - [x] SubTask 4.2: 检查后端虚拟环境是否存在
  - [x] SubTask 4.3: 检查必要的资源文件是否存在
  - [x] SubTask 4.4: 检查图标文件是否存在

- [x] Task 5: 创建打包文档和指南
  - [x] SubTask 5.1: 创建 PACKAGING.md 文档说明打包流程
  - [x] SubTask 5.2: 添加打包前的准备步骤说明
  - [x] SubTask 5.3: 添加各平台打包命令说明
  - [x] SubTask 5.4: 添加常见问题排查指南

- [ ] Task 6: 测试打包流程
  - [ ] SubTask 6.1: 测试 Windows 打包生成安装包
  - [ ] SubTask 6.2: 测试 Windows 打包生成便携版
  - [ ] SubTask 6.3: 验证安装包可以正常安装和启动
  - [ ] SubTask 6.4: 验证应用启动后后端服务正常运行

# Task Dependencies
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2]
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]
