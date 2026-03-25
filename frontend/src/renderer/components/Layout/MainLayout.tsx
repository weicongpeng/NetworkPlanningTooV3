import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Database,
  Settings,
  Map,
  Network,
  Layers,
  MapPin,
  Shield,
  ChevronLeft,
  ChevronRight
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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* 侧边栏 */}
      <aside
        style={{
          width: sidebarOpen ? '116px' : '42px',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="bg-secondary border-r border-border flex flex-col relative z-20"
      >
        {/* 侧边栏边缘把手 - 右边缘中部 */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#D0D0D0' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#E0E0E0' }}
          style={{
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease',
            width: '16px',
            height: '64px',
            backgroundColor: '#E0E0E0',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center z-30"
          title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
        >
          {/* 箭头图标 */}
          {sidebarOpen ? (
            <ChevronLeft size={14} color="#666666" />
          ) : (
            <ChevronRight size={14} color="#666666" />
          )}
        </button>

        {/* 导航菜单 - 固定高度和间距，避免上下移动，图标位置固定，内容边距统一 */}
        <nav className="flex-1 overflow-y-auto py-3">
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
                  } flex items-center h-[42px] rounded-lg transition-colors`}
                style={{
                  paddingLeft: '6px',
                  paddingRight: '6px',
                  gap: '8px',
                }}
              >
                <div className="flex-shrink-0 w-6 flex justify-center">
                  <Icon size={20} />
                </div>
                <span
                  style={{
                    opacity: sidebarOpen ? 1 : 0,
                    maxWidth: sidebarOpen ? '200px' : '0px',
                    transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    display: 'block',
                  }}
                >
                  {item.name}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* 底部信息 - 使用固定高度容器避免菜单上下移动 */}
        <div className="border-t border-border text-xs text-muted-foreground">
          <div
            style={{
              opacity: sidebarOpen ? 1 : 0,
              transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            className="px-4 py-4 h-[52px]"
          >
            <p>版本: 2.0.0</p>
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 overflow-auto flex flex-col relative z-10">
        {children}
      </main>
    </div>
  )
}
