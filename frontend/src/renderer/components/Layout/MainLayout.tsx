import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Database,
  Settings,
  Map,
  Network,
  Shield,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: '首页', href: '/', icon: Home },
  { name: '数据管理', href: '/data', icon: Database },
  { name: 'PCI规划', href: '/pci', icon: Settings },
  { name: '邻区规划', href: '/neighbor', icon: Network },
  { name: '地图浏览', href: '/map', icon: Map },
  { name: '许可证管理', href: '/license', icon: Shield }
]

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } bg-secondary border-r border-border transition-all duration-300 flex flex-col`}
      >
        {/* 头部 */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-primary">网络规划工具</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md hover:bg-muted transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                } flex items-center gap-3 px-4 py-3 rounded-lg transition-colors`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* 底部信息 */}
        {sidebarOpen && (
          <div className="p-4 border-t border-border text-sm text-muted-foreground">
            <p>版本: 2.0.0</p>
          </div>
        )}
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 overflow-auto flex flex-col">
        {children}
      </main>
    </div>
  )
}
