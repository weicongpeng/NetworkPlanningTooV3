# Checklist

## 问题排查
- [x] 已分析"基站"图层（LTE/NR）框选高亮逻辑
- [x] 已分析"图层文件"扇区类型框选高亮逻辑
- [x] 已确认"地理化数据"图层高亮工作的原因

## 修复验证
- [x] LTE 扇区图层框选时正确调用 setSelectionHighlight
- [x] NR 扇区图层框选时正确调用 setSelectionHighlight
- [x] 图层文件扇区类型框选时正确调用 setSelectionHighlight
- [x] selectionHighlightIds 正确匹配扇区ID
- [x] 高亮样式正确应用到扇区多边形/标记

## 修复内容
- [x] 修复 _forceRenderSectorsById 方法移除缩放级别限制（zoom <= 6 时不再返回）
- [x] 修复 _render 方法在低缩放级别下保留选中的扇区

## 功能测试
- [ ] 圆形框选 LTE 扇区图层高亮正常
- [ ] 多边形框选 LTE 扇区图层高亮正常
- [ ] 圆形框选 NR 扇区图层高亮正常
- [ ] 多边形框选 NR 扇区图层高亮正常
- [ ] 圆形框选图层文件扇区类型高亮正常
- [ ] 多边形框选图层文件扇区类型高亮正常

## 代码质量
- [x] TypeScript 类型检查通过
