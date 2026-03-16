import {
  Database,
  Settings,
  Network,
  Layers,
  MapPin,
  Map,
  Shield,
  LucideIcon
} from 'lucide-react'

export function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">欢迎使用网络规划工具 v2.0</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 功能卡片 */}
        <FeatureCard
          title="数据管理"
          description="导入和管理工参数据"
          icon={Database}
          link="/data"
          iconColor="text-blue-500"
        />
        <FeatureCard
          title="PCI规划"
          description="LTE和NR的PCI自动规划"
          icon={Settings}
          link="/pci"
          iconColor="text-purple-500"
        />
        <FeatureCard
          title="邻区规划"
          description="自动生成邻区关系"
          icon={Network}
          link="/neighbor"
          iconColor="text-green-500"
        />
        <FeatureCard
          title="TAC核查"
          description="对比图层TAC与现网TAC，统计一致性"
          icon={Layers}
          link="/tac"
          iconColor="text-orange-500"
        />
        <FeatureCard
          title="TAC规划"
          description="数据驱动的新站小区TAC分配"
          icon={MapPin}
          link="/tac-planning"
          iconColor="text-red-500"
        />
        <FeatureCard
          title="地图工具"
          description="查看基站分布和覆盖"
          icon={Map}
          link="/map"
          iconColor="text-cyan-500"
        />
        <FeatureCard
          title="配置管理"
          description="管理系统配置"
          icon={Shield}
          link="/license"
          iconColor="text-slate-500"
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
  icon: Icon,
  link,
  iconColor
}: {
  title: string
  description: string
  icon: LucideIcon
  link: string
  iconColor?: string
}) {
  return (
    <a
      href={link}
      className="block p-6 bg-card rounded-lg border border-border hover:border-primary transition-all duration-300 hover:shadow-md group"
    >
      <div className={`mb-4 p-3 rounded-lg bg-muted w-fit group-hover:scale-110 transition-transform ${iconColor}`}>
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">{title}</h3>
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
