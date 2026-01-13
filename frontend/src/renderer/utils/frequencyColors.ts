/**
 * 频点颜色映射工具
 * 
 * 为LTE和NR的不同频点分配唯一的颜色
 * - LTE: 蓝紫色系 (Hue: 200-260)
 * - NR: 绿黄色系 (Hue: 100-160)
 * 
 * 使用HSL色彩空间确保颜色区分度和视觉美观
 */

import type { NetworkType } from '../config/sector-config'

interface FrequencyColor {
    frequency: number
    color: string
    strokeColor: string
}

/**
 * 频点颜色映射器
 */
export class FrequencyColorMapper {
    private colorMap: Map<number, FrequencyColor> = new Map()
    private frequenciesByNetwork: Map<NetworkType, Set<number>> = new Map([
        ['LTE', new Set()],
        ['NR', new Set()]
    ])

    // LTE和NR使用不同的起始色调
    private readonly LTE_HUE_BASE = 220 // 蓝色基准
    private readonly NR_HUE_BASE = 140  // 绿色基准

    // 黄金比例共轭值 (约 0.618)，用于在色相环上产生尽可能分散的颜色
    private readonly GOLDEN_RATIO_CONJUGATE = 0.618033988749895

    // 基准样式
    private readonly BASE_SATURATION = 80
    private readonly BASE_LIGHTNESS = 50
    private readonly STROKE_LIGHTNESS_OFFSET = -25

    /**
     * 计算频点对应的颜色属性 (色调, 饱和度, 亮度)
     * 使用黄金比例分布算法最大化相邻频点的颜色差异
     */
    private calculateStyles(frequency: number, networkType: NetworkType): { h: number, s: number, l: number } {
        const frequencies = Array.from(this.frequenciesByNetwork.get(networkType) || []).sort((a, b) => a - b)
        const index = frequencies.indexOf(frequency)

        // 1. 色调分布：基于基准色调，利用黄金比例产生离散步进
        // 我们不使用简单的线性分布，而是让每个索引都产生一个大的色调跳变，但限制在合理范围内
        const baseHue = networkType === 'LTE' ? this.LTE_HUE_BASE : this.NR_HUE_BASE

        // 使用黄金比例步进，由于 Hue 是 360 度循环，这能产生非常分散的颜色
        // 我们将其限制在网络预设的色系附近（±60度）
        let hueOffset = (index * this.GOLDEN_RATIO_CONJUGATE * 360) % 120
        let hue = (baseHue - 60 + hueOffset + 360) % 360

        // 2. 亮度与饱和度大幅交替 (3个一组循环)
        // 这样即使色调接近，亮度差异也能一眼区分
        const lOffsets = [0, -15, 12]
        const sOffsets = [0, -20, 10]

        const lightness = this.BASE_LIGHTNESS + lOffsets[index % 3]
        const saturation = this.BASE_SATURATION + sOffsets[index % 3]

        return { h: hue, s: saturation, l: lightness }
    }

    /**
     * 生成HSL颜色字符串
     */
    private generateHSL(hue: number, saturation: number, lightness: number): string {
        return `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`
    }

    /**
     * 使颜色变深（用于边框）
     */
    private darkenColor(hue: number, saturation: number, lightness: number, offset: number): string {
        const newLightness = Math.max(0, Math.min(100, lightness + offset))
        return this.generateHSL(hue, saturation, newLightness)
    }

    /**
     * 获取频点对应的颜色
     * @param frequency 频点值
     * @param networkType 网络类型
     * @returns 颜色对象
     */
    getColor(frequency: number, networkType: NetworkType): FrequencyColor {
        if (!this.colorMap.has(frequency)) {
            // 记录频点
            const freqSet = this.frequenciesByNetwork.get(networkType)
            if (freqSet) {
                freqSet.add(frequency)
            }

            // 计算样式属性
            const { h, s, l } = this.calculateStyles(frequency, networkType)

            // 生成填充色和边框色
            const color = this.generateHSL(h, s, l)
            const strokeColor = this.darkenColor(h, s, l, this.STROKE_LIGHTNESS_OFFSET)

            const colorObj: FrequencyColor = {
                frequency,
                color,
                strokeColor
            }

            this.colorMap.set(frequency, colorObj)
        }

        return this.colorMap.get(frequency)!
    }

    /**
     * 获取所有已知频点
     * @param networkType 可选，按网络类型过滤
     * @returns 频点数组（已排序）
     */
    getAllFrequencies(networkType?: NetworkType): number[] {
        if (networkType) {
            const freqs = this.frequenciesByNetwork.get(networkType)
            return freqs ? Array.from(freqs).sort((a, b) => a - b) : []
        }

        // 返回所有频点
        const allFreqs = new Set<number>()
        this.frequenciesByNetwork.forEach(freqs => {
            freqs.forEach(f => allFreqs.add(f))
        })
        return Array.from(allFreqs).sort((a, b) => a - b)
    }

    /**
     * 获取频点图例数据
     * @param networkType 网络类型
     * @returns 频点图例数组
     */
    getFrequencyLegend(networkType: NetworkType): Array<{ frequency: number; color: string; strokeColor: string }> {
        const frequencies = this.getAllFrequencies(networkType)
        return frequencies.map(freq => this.getColor(freq, networkType))
    }

    /**
     * 清除缓存（用于数据刷新）
     */
    clear(): void {
        this.colorMap.clear()
        this.frequenciesByNetwork.set('LTE', new Set())
        this.frequenciesByNetwork.set('NR', new Set())
    }

    /**
     * 预加载频点（优化首次渲染性能）
     */
    preloadFrequencies(frequencies: Array<{ frequency: number; networkType: NetworkType }>): void {
        frequencies.forEach(({ frequency, networkType }) => {
            if (!this.colorMap.has(frequency)) {
                this.getColor(frequency, networkType)
            }
        })
    }
}

// 单例导出
export const frequencyColorMapper = new FrequencyColorMapper()
