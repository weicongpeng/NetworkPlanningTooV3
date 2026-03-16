# Checklist

## 图层可见性检查
- [x] layerVisibilityRef 正确创建并同步
- [x] selectFeaturesAtPoint 只选择可见图层元素
- [x] selectFeaturesInCircle 只选择可见图层元素
- [x] selectFeaturesInPolygon 只选择可见图层元素

## Shift+点选高亮
- [x] 第一次点击立即显示高亮
- [x] 多选模式正确累加选中元素

## 框选模式禁用干扰功能
- [x] 双击不放大地图
- [x] 点击不显示属性面板
- [x] 悬浮不显示标签

## 多边形框选预览
- [x] 绘制过程中显示不封闭线段
- [x] 完成时形成封闭区域

## 点击空白区域取消选中
- [x] 点击无可见元素区域时清除选中状态
- [x] 清除后高亮消失

## 代码质量
- [x] TypeScript 类型检查通过
- [x] 无控制台错误
