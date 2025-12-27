export function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">欢迎使用网络规划工具 v2.0</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 功能卡片 */}
        <FeatureCard
          title="数据管理"
          description="导入和管理工参数据"
          icon="📊"
          link="/data"
        />
        <FeatureCard
          title="PCI规划"
          description="LTE和NR的PCI自动规划"
          icon="🔧"
          link="/pci"
        />
        <FeatureCard
          title="邻区规划"
          description="自动生成邻区关系"
          icon="🔗"
          link="/neighbor"
        />
        <FeatureCard
          title="地图浏览"
          description="查看基站分布和覆盖"
          icon="🗺️"
          link="/map"
        />
        <FeatureCard
          title="许可证管理"
          description="管理软件许可证"
          icon="🔑"
          link="/license"
        />
      </div>

      {/* 系统状态 */}
      <div className="mt-8 p-6 bg-card rounded-lg border border-border">
        <h2 className="text-xl font-semibold mb-4">系统状态</h2>
        <div className="space-y-2">
          <StatusItem label="后端服务" status="online" />
          <StatusItem label="数据库" status="online" />
          <StatusItem label="许可证" status="valid" />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({
  title,
  description,
  icon,
  link
}: {
  title: string
  description: string
  icon: string
  link: string
}) {
  return (
    <a
      href={link}
      className="block p-6 bg-card rounded-lg border border-border hover:border-primary transition-colors"
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </a>
  )
}

function StatusItem({
  label,
  status
}: {
  label: string
  status: 'online' | 'offline' | 'valid' | 'invalid'
}) {
  const statusConfig = {
    online: { color: 'text-green-500', text: '运行中' },
    offline: { color: 'text-red-500', text: '离线' },
    valid: { color: 'text-green-500', text: '已激活' },
    invalid: { color: 'text-red-500', text: '未激活' }
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={config.color}>{config.text}</span>
    </div>
  )
}
