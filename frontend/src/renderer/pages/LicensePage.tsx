import { useState, useEffect } from 'react'
import { Shield, Check, X, Upload } from 'lucide-react'

export function LicensePage() {
  const [licenseStatus, setLicenseStatus] = useState<{
    valid: boolean
    expiryDate: string
    licensee: string
  } | null>(null)

  useEffect(() => {
    // 获取许可证状态
    fetchLicenseStatus()
  }, [])

  const fetchLicenseStatus = async () => {
    try {
      const response = await fetch('/api/license/status')
      const data = await response.json()
      setLicenseStatus(data)
    } catch (error) {
      console.error('获取许可证状态失败:', error)
    }
  }

  const handleActivateLicense = (licenseKey: string) => {
    console.log('Activating license:', licenseKey)
  }

  const handleUploadLicense = (file: File) => {
    console.log('Uploading license file:', file.name)
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">许可证管理</h1>

      <div className="max-w-2xl">
        {/* 许可证状态 */}
        <div className="bg-card p-6 rounded-lg border border-border mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield size={24} className={licenseStatus?.valid ? 'text-green-500' : 'text-red-500'} />
            <h2 className="text-xl font-semibold">许可证状态</h2>
          </div>

          {licenseStatus ? (
            <div className="space-y-4">
              <StatusItem
                label="状态"
                value={licenseStatus.valid ? '已激活' : '未激活'}
                valid={licenseStatus.valid}
              />
              <StatusItem
                label="授权用户"
                value={licenseStatus.licensee || '-'}
                valid={true}
              />
              <StatusItem
                label="到期时间"
                value={licenseStatus.expiryDate || '-'}
                valid={true}
              />
            </div>
          ) : (
            <p className="text-muted-foreground">加载中...</p>
          )}
        </div>

        {/* 激活许可证 */}
        {!licenseStatus?.valid && (
          <>
            <div className="bg-card p-6 rounded-lg border border-border mb-6">
              <h3 className="text-lg font-semibold mb-4">激活许可证</h3>

              <LicenseInputForm onSubmit={handleActivateLicense} />
            </div>

            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-lg font-semibold mb-4">上传许可证文件</h3>

              <LicenseUploadForm onUpload={handleUploadLicense} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatusItem({
  label,
  value,
  valid
}: {
  label: string
  value: string
  valid: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {valid ? (
          <Check size={16} className="text-green-500" />
        ) : (
          <X size={16} className="text-red-500" />
        )}
        <span className={valid ? 'text-green-500' : 'text-red-500'}>
          {value}
        </span>
      </div>
    </div>
  )
}

function LicenseInputForm({
  onSubmit
}: {
  onSubmit: (key: string) => void
}) {
  const [licenseKey, setLicenseKey] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (licenseKey.trim()) {
      onSubmit(licenseKey.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          type="text"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder="请输入许可证密钥"
          className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          激活
        </button>
      </div>
    </form>
  )
}

function LicenseUploadForm({ onUpload }: { onUpload: (file: File) => void }) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
    }
  }

  return (
    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
      <div className="flex flex-col items-center justify-center text-muted-foreground">
        <Upload size={32} />
        <p className="mt-2 text-sm">点击上传许可证文件</p>
        <p className="text-xs mt-1">支持 .lic 格式</p>
      </div>
      <input
        type="file"
        className="hidden"
        accept=".lic"
        onChange={handleFileChange}
      />
    </label>
  )
}
