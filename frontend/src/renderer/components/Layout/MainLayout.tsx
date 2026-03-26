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
import { useTranslation } from 'react-i18next'

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const navigation = [
    { name: t('nav.home'), href: '/', icon: Home },
    { name: t('nav.data'), href: '/data', icon: Database },
    { name: t('nav.pci'), href: '/pci', icon: Settings },
    { name: t('nav.neighbor'), href: '/neighbor', icon: Network },
    { name: t('nav.tac'), href: '/tac', icon: Layers },
    { name: t('nav.tacPlanning'), href: '/tac-planning', icon: MapPin },
    { name: t('nav.map'), href: '/map', icon: Map },
    { name: t('nav.config'), href: '/license', icon: Shield }
  ]

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* 侧边栏 */}
      <aside
        style={{
          width: sidebarOpen ? '180px' : '42px',
          transition: 'width 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
        className="bg-secondary border-r border-border flex flex-col relative z-20"
      >
        {/* 侧边栏边缘把手 - 右边缘中部，与面板风格一致 */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.88)' }}
          style={{
            width: '16px',
            height: '64px',
            // 配色与侧边栏面板保持一致：白色毛玻璃效果
            backgroundColor: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(12px)',
            borderRadius: '4px',
            border: '1px solid rgba(0, 0, 0, 0.06)',
            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.08)',
            cursor: 'pointer',
            // 与侧边栏同步的过渡动画
            transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center z-30"
          title={sidebarOpen ? t('common.collapseSidebar') : t('common.expandSidebar')}
        >
          {/* 箭头图标 */}
          {sidebarOpen ? (
            <ChevronLeft size={14} color="#6b7280" strokeWidth={2.5} />
          ) : (
            <ChevronRight size={14} color="#6b7280" strokeWidth={2.5} />
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
                    maxWidth: sidebarOpen ? '140px' : '0px',
                    transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
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
