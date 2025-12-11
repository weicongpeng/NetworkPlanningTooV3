# GeoPandas 安装指南

## 简介
GeoPandas 是一个基于 pandas 的地理空间数据处理库，它使得在 Python 中处理地理空间数据变得更加简单。本项目的图层导出功能使用 GeoPandas 来生成标准的 MapInfo 格式文件，确保与 MapInfo 软件完全兼容。

## 安装方法

### 方法一：使用 pip 安装（推荐）

```bash
# 安装 GeoPandas 及其依赖
pip install geopandas

# 如果需要特定版本
pip install geopandas==0.13.2
```

### 方法二：使用 conda 安装（如果使用 Anaconda）

```bash
# 使用 conda-forge 频道安装
conda install -c conda-forge geopandas
```

### 方法三：离线安装

如果在线安装遇到问题，可以下载 whl 文件进行离线安装：

1. 访问 [https://www.lfd.uci.edu/~gohlke/pythonlibs/](https://www.lfd.uci.edu/~gohlke/pythonlibs/)
2. 下载以下 whl 文件（根据 Python 版本选择）：
   - GDAL-*.whl
   - Fiona-*.whl
   - Shapely-*.whl
   - pyproj-*.whl
   - rtree-*.whl
   - geopandas-*.whl
3. 按顺序安装：
   ```bash
   pip install GDAL-*.whl
   pip install Fiona-*.whl
   pip install Shapely-*.whl
   pip install pyproj-*.whl
   pip install rtree-*.whl
   pip install geopandas-*.whl
   ```

## 验证安装

安装完成后，运行以下命令验证是否安装成功：

```python
import geopandas as gpd
from shapely.geometry import Point

# 创建一个简单的点
point = Point(116.3974, 39.9093)
gdf = gpd.GeoDataFrame({'name': ['测试点']}, geometry=[point], crs='EPSG:4326')

# 导出为 MapInfo 格式
gdf.to_file('test_point.tab', driver='MapInfo File')
print("GeoPandas 安装成功！")
```

## 常见问题

### 1. 安装失败：Microsoft Visual C++ 14.0 is required

解决方案：
- 安装 Microsoft Visual C++ Build Tools
- 或者使用预编译的 whl 文件（见离线安装）

### 2. Fiona 安装失败

Fiona 是 GeoPandas 的重要依赖，安装时可能需要 GDAL。

解决方案：
```bash
# Windows
pip install fiona

# Linux
sudo apt-get install libgdal-dev
pip install fiona

# macOS
brew install gdal
pip install fiona
```

### 3. 版本兼容性问题

确保所有依赖库版本兼容：
- GDAL >= 2.2
- Fiona >= 1.8
- Shapely >= 1.6
- pyproj >= 2.2

## 项目中的使用

安装 GeoPandas 后，本项目的图层制作功能将：

1. **自动检测** GeoPandas 是否可用
2. **优先使用** GeoPandas 生成标准 MapInfo 格式
3. **回退方案** 如果 GeoPandas 未安装，使用兼容性模式导出

### 使用示例

1. **扇区图层导出**：
   - 使用 GeoPandas 创建多边形几何对象
   - 自动处理坐标闭合
   - 导出为标准 MapInfo TAB 格式

2. **点状图层导出**：
   - 使用 Shapely 创建点几何对象
   - 保持原始坐标精度
   - 支持自定义属性字段

## 优势

使用 GeoPandas 的好处：

- ✅ **标准格式**：生成的文件完全符合 MapInfo 规范
- ✅ **坐标系支持**：自动处理坐标系和投影信息
- ✅ **编码支持**：支持 UTF-8 编码，避免中文乱码
- ✅ **错误处理**：更好的错误提示和处理机制
- ✅ **扩展性**：易于添加更多地理空间功能

## 测试

运行测试脚本验证安装：

```bash
python test_layer_export.py
```

这将：
1. 检查 GeoPandas 是否可用
2. 创建测试用的扇区和点数据
3. 导出为 MapInfo TAB 格式
4. 验证生成的文件格式

## 更新日志

- 2025-12-10：添加 GeoPandas 支持，重写图层导出功能
- 2025-12-10：创建安装指南和测试脚本