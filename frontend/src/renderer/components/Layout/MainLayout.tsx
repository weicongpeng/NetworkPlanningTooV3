import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Database,
  Settings,
  Map,
  Network,
  Layers,
  MapPin,
  Shield
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: '首页', href: '/', icon: Home },
  { name: '数据管理', href: '/data', icon: Database },
  { name: 'PCI规划', href: '/pci', icon: Settings },
  { name: '邻区规划', href: '/neighbor', icon: Network },
  { name: 'TAC核查', href: '/tac', icon: Layers },
  { name: 'TAC规划', href: '/tac-planning', icon: MapPin },
  { name: '地图工具', href: '/map', icon: Map },
  { name: '配置管理', href: '/license', icon: Shield }
]

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <aside
        className={`${sidebarOpen ? 'w-44' : 'w-16'
          } bg-secondary border-r border-border transition-all duration-300 flex flex-col relative`}
      >
        {/* 侧边栏边缘把手 - 右边缘中部，轻微凸出 */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 w-4 h-16 bg-secondary border border-border rounded-r-md hover:bg-muted transition-all duration-200 flex items-center justify-center group shadow-sm hover:shadow-md z-10"
          title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
        >
          {/* 把手纹理 - 横向线条 */}
          <div className="flex flex-col gap-1.5">
            <div className="w-2 h-0.5 bg-muted-foreground/50 rounded-full group-hover:bg-muted-foreground/70 transition-colors"></div>
            <div className="w-2 h-0.5 bg-muted-foreground/50 rounded-full group-hover:bg-muted-foreground/70 transition-colors"></div>
            <div className="w-2 h-0.5 bg-muted-foreground/50 rounded-full group-hover:bg-muted-foreground/70 transition-colors"></div>
          </div>
        </button>

        {/* 导航菜单 */}
        <nav className={`flex-1 overflow-y-auto ${sidebarOpen ? 'p-4 space-y-2' : 'p-2 space-y-2'}`}>
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`${isActive
                    ? 'bg-blue-400 text-white hover:bg-blue-500'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  } flex items-center ${sidebarOpen ? 'justify-start px-4' : 'justify-center px-2'} gap-3 py-3 rounded-lg transition-colors`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* 底部信息 */}
        {sidebarOpen && (
          <div className="p-4 border-t border-border text-xs text-muted-foreground">
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
