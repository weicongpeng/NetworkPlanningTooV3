# Backend Requirements: 地理化数据格式修复

## Context

**What we're building**: 修复地理化数据在地图上不渲染的问题

**Who it's for**: 前端地图组件需要正确加载和显示用户上传的地理化数据（点状图或扇区图）

**What problem it solves**: 用户勾选"地理化数据"文件后，地图没有显示点状图或扇区图

## Root Cause Analysis

### The Problem

前端期望的数据格式与后端实际返回的格式不匹配：

**后端返回（修复前）**:
```json
{
  "success": true,
  "data": [...]  // 直接返回数组
}
```

**前端期望**:
```json
{
  "success": true,
  "data": {
    "default": [...]  // 需要包装在 default 字段中
  }
}
```

**前端代码位置**: `frontend/src/renderer/components/Map/OnlineMap.tsx:1469`
```typescript
if (response.success && response.data && response.data.default) {
  const pointData = response.data.default.filter(...)
}
```

## Data Structure Requirements

### What I need from the backend

**When frontend calls**: 获取地理化数据详情 API

**Response format I expect**:
```json
{
  "success": true,
  "data": {
    "default": [  // 必须包装在 default 字段中
      {
        "longitude": 115.164639,
        "latitude": 23.740832,
        "displayLng": 115.1695578011762,
        "displayLat": 23.73833741096823,
        "name": "河源东源河惠莞大邪",
        "azimuth": 0,  // 可选，如果有则为扇区，否则为点
        "properties": {}  // 其他属性
      }
    ]
  }
}
```

### Why I need this structure

1. **Frontend code checks for `response.data.default`** - 硬编码在多个地方
2. **Consistency with other data types** - LTE/NR 数据使用类似结构
3. **Future extensibility** - 可以添加其他类型的地理化数据

## Current Implementation

### File: `backend/app/services/data_service.py`

**Method**: `get_data(self, data_id: str)`

**Lines**: 2858-2882

**Fix applied**:
```python
if filename == "default.json":
    return {"default": data}  # ✅ Wrap in 'default' field
elif filename == "data.json":
    return data  # ✅ Standard format (already has LTE/NR structure)
else:
    return data
```

### What this fixes

- ✅ 地理化数据（`default.json`）现在包装在 `default` 字段中
- ✅ 标准工参（`data.json`）保持原样（已有 `{LTE: [...], NR: [...]}` 结构）
- ✅ 分表格式（`LTE.json`, `NR.json`）保持原有逻辑

## States I Need to Handle

### Loading State
- **When**: 用户勾选图层时
- **What I show**: Loading indicator
- **What backend provides**: Quick response with cached data

### Empty State
- **When**: 数据文件中没有有效的经纬度数据
- **What I show**: "无有效数据"提示
- **What backend provides**: Empty array or filtered data

### Error State
- **When**:
  - 数据文件不存在（404）
  - 数据格式错误
  - 文件读取失败
- **What I show**: Error message with details
- **What backend provides**: HTTP error with descriptive message

### Special Case: No Coordinates
- **When**: 数据缺少 longitude/latitude 字段
- **Frontend behavior**: Filter out invalid points
- **Expected**: Partial data with valid points only

## Business Rules Affecting UI

1. **File Type Detection**:
   - `fileType='geo_data'` → 显示在"地理化数据"分组
   - `geometryType='point'` → 渲染为圆点
   - `geometryType='sector'` → 渲染为扇区

2. **Coordinate Transformation**:
   - Input: WGS84 coordinates (longitude, latitude)
   - Backend should provide: `displayLng`, `displayLat` (GCJ02)
   - Fallback: Frontend transforms if not provided

3. **Data Filtering**:
   - Only points with valid longitude/latitude are displayed
   - Invalid coordinates are silently filtered

## Uncertainties

- [ ] **Performance**: Large datasets (>10,000 points) - should backend paginate?
- [ ] **Caching**: Should backend cache parsed data to avoid repeated file reads?
- [ ] **Validation**: Should backend validate coordinate ranges (-180~180, -90~90)?
- [ ] **Error reported**: 用户提到"调整后报错"，但没有看到具体错误信息
  - 可能是 Python 语法错误？
  - 可能是运行时错误？
  - 需要查看后端日志

## Questions for Backend

1. **Error diagnosis**:
   - 用户报告修复后出现错误，能否提供完整的错误堆栈？
   - 是启动错误还是运行时错误？
   - 错误发生在哪个 API 端点？

2. **Data validation**:
   - Should backend validate coordinate ranges?
   - Should backend reject invalid data or filter it out?

3. **Performance**:
   - For large datasets, should backend implement pagination or streaming?
   - Current approach: Load all data at once

4. **Alternative approaches**:
   - Would it be better to change frontend to accept both formats?
   - Should we standardize all data to use `default` wrapper?

## Potential Issues to Investigate

Based on user reporting an error after the fix:

1. **Indentation error**: Python is sensitive to indentation
2. **Logic error**: The `if-elif-else` chain might have a bug
3. **Type error**: `data` might not be what we expect
4. **Missing import**: Though unlikely, as we didn't add new imports

### Debug Steps Needed

1. Check backend logs for full error traceback
2. Verify Python syntax: `python -m py_compile data_service.py` ✅ Done - no syntax errors
3. Test the API endpoint directly
4. Check console output when loading geo data

## Discussion Log

### 2025-01-27 - Initial fix implemented

**Change**: Modified `data_service.py:get_data()` to wrap `default.json` data in `default` field

**Rationale**: Frontend expects `response.data.default` structure

**User feedback**: "调整后报错如图" (Error after adjustment, as shown in image)

**Next steps**:
1. Need to see the actual error message
2. Check if backend service starts successfully
3. Verify API endpoint works with the change
4. Consider rolling back if critical error

### Open Issues

- ❓ **Critical**: What is the actual error message?
- ❓ Can the backend service start with the changes?
- ❓ Is the error in frontend or backend?
- ❓ Does the error affect only geo data or all data types?

## Testing Checklist

After backend implements/verifies the fix:

- [ ] Backend starts without errors
- [ ] GET `/api/v1/data/{geo_data_id}` returns 200
- [ ] Response has `data.default` field
- [ ] Frontend can parse the response
- [ ] Points render on map
- [ ] Console shows no errors
- [ ] Existing LTE/NR data still works

## Rollback Plan

If the fix causes issues:

**Option 1**: Revert to original behavior
```python
return data  # Don't wrap, let frontend adapt
```

**Option 2**: Frontend fixes
- Update frontend to handle both formats
- Check for `data.default` first, fallback to `data` as array

**Option 3**: Different wrapper
```python
return {"geo_data": data}  # Use different field name
```

---

**Status**: ⚠️ **Awaiting error details from user**

**Last updated**: 2025-01-27
