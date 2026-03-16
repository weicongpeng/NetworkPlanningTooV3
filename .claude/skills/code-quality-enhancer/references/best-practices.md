# 编码最佳实践

## 目录
- [Python最佳实践](#python最佳实践)
- [JavaScript/TypeScript最佳实践](#javascripttypescript最佳实践)
- [Java最佳实践](#java最佳实践)
- [通用编码原则](#通用编码原则)
- [常见反模式](#常见反模式)

## 概览
本文档整理了主流编程语言和框架的编码最佳实践，帮助识别代码中的反模式并提供改进建议。

## Python最佳实践

### PEP 8 遵循
- 使用4空格缩进
- 行长度不超过79字符
- 使用空行分隔函数和类
- 导入顺序：标准库 → 第三方库 → 本地模块

### 类型提示
```python
# 推荐
def process_data(data: List[Dict[str, Any]]) -> Optional[Result]:
    ...

# 避免
def process_data(data):
    ...
```

### 上下文管理器
```python
# 推荐
with open('file.txt', 'r') as f:
    data = f.read()

# 避免
f = open('file.txt', 'r')
data = f.read()
f.close()
```

### 列表推导
```python
# 推荐
squares = [x**2 for x in range(10)]

# 避免
squares = []
for x in range(10):
    squares.append(x**2)
```

### 异常处理
```python
# 推荐
try:
    result = risky_operation()
except SpecificError as e:
    logger.error(f"Error: {e}")
    raise

# 避免
try:
    result = risky_operation()
except:  # 过于宽泛
    pass
```

### 字符串格式化
```python
# 推荐（Python 3.6+）
name = "Alice"
greeting = f"Hello, {name}"

# 推荐（Python 3.5及以下）
greeting = "Hello, {}".format(name)

# 避免
greeting = "Hello, " + name
```

## JavaScript/TypeScript最佳实践

### 变量声明
```javascript
// 推荐
const PI = 3.14;
let count = 0;

// 避免
var count = 0;
```

### 异步处理
```javascript
// 推荐
async function fetchData() {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// 避免
function fetchData() {
  fetch(url)
    .then(response => response.json())
    .then(data => processData(data))
    .catch(error => console.error(error));
}
```

### 比较运算
```javascript
// 推荐
if (value === null) { ... }
if (count > 0) { ... }

// 避免
if (value == null) { ... }  // 类型转换
if (count) { ... }  // 不够明确
```

### 函数默认参数
```javascript
// 推荐
function greet(name = 'World') {
  console.log(`Hello, ${name}`);
}

// 避免
function greet(name) {
  name = name || 'World';
  console.log('Hello, ' + name);
}
```

### 解构赋值
```javascript
// 推荐
const {name, age} = user;
const [first, second] = array;

// 避免
const name = user.name;
const age = user.age;
```

## Java最佳实践

### 资源管理
```java
// 推荐（Java 7+）
try (FileReader reader = new FileReader("file.txt");
     BufferedReader br = new BufferedReader(reader)) {
    String line = br.readLine();
} catch (IOException e) {
    e.printStackTrace();
}

// 避免
FileReader reader = new FileReader("file.txt");
try {
    // 使用reader
} finally {
    reader.close();
}
```

### 字符串处理
```java
// 推荐
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 100; i++) {
    sb.append(i);
}
String result = sb.toString();

// 避免
String result = "";
for (int i = 0; i < 100; i++) {
    result += i;
}
```

### 集合初始化
```java
// 推荐
List<String> list = new ArrayList<>();
list.add("item");

// 避免
List<String> list = new ArrayList<String>();
```

### Optional使用
```java
// 推荐
public Optional<String> findUser(String id) {
    User user = repository.findById(id);
    return Optional.ofNullable(user).map(User::getName);
}

// 避免
public String findUser(String id) {
    User user = repository.findById(id);
    return user != null ? user.getName() : null;
}
```

### 异常处理
```java
// 推荐
try {
    processFile();
} catch (IOException e) {
    logger.error("Failed to process file", e);
    throw new ProcessingException("File processing failed", e);
}

// 避免
try {
    processFile();
} catch (Exception e) {
    e.printStackTrace();
}
```

## 通用编码原则

### SOLID原则
1. **单一职责原则（SRP）**
   - 类/函数只做一件事
   - 避免万能类

2. **开闭原则（OCP）**
   - 对扩展开放，对修改关闭
   - 使用抽象和接口

3. **里氏替换原则（LSP）**
   - 子类可以替换父类
   - 不破坏父类行为

4. **接口隔离原则（ISP）**
   - 接口要小而专一
   - 避免臃肿接口

5. **依赖倒置原则（DIP）**
   - 依赖抽象而非具体
   - 使用依赖注入

### DRY原则（Don't Repeat Yourself）
```python
# 避免
def calculate_discount(amount):
    if amount > 100:
        return amount * 0.9

def calculate_tax(amount):
    if amount > 100:
        return amount * 0.9  # 重复逻辑

# 推荐
def is_high_value(amount):
    return amount > 100

def calculate_discount(amount):
    return amount * 0.9 if is_high_value(amount) else amount

def calculate_tax(amount):
    return amount * 0.9 if is_high_value(amount) else amount * 0.8
```

### KISS原则（Keep It Simple, Stupid）
- 保持代码简单直接
- 避免过度设计
- 优先使用标准库

### YAGNI原则（You Aren't Gonna Need It）
- 不实现不需要的功能
- 避免过早优化
- 关注当前需求

## 常见反模式

### 魔法数字
```python
# 避免
if (user_age >= 18):
    print("adult")

# 推荐
ADULT_AGE = 18
if (user_age >= ADULT_AGE):
    print("adult")
```

### 深层嵌套
```python
# 避免
def process(data):
    if data:
        for item in data:
            if item:
                if item.active:
                    print(item.value)

# 推荐
def process(data):
    if not data:
        return

    for item in data:
        if not item or not item.active:
            continue
        print(item.value)
```

### 过长函数
```python
# 避免
def process_user_data(user_id):
    # 100+ 行代码
    ...

# 推荐
def process_user_data(user_id):
    user = fetch_user(user_id)
    validate_user(user)
    transform_user(user)
    save_user(user)

def fetch_user(user_id):
    # ...
```

### 全局状态
```python
# 避免
current_user = None

def set_user(user):
    global current_user
    current_user = user

# 推荐
class UserContext:
    def __init__(self):
        self._user = None

    def set_user(self, user):
        self._user = user
```

### 注释掉的代码
```python
# 避免
# def old_function():
#     return "old"

def new_function():
    return "new"

# 推荐：直接删除不再使用的代码
def new_function():
    return "new"
```

### 复制粘贴代码
```python
# 避免
def process_user(user):
    if user.age > 18:
        user.status = "adult"
    else:
        user.status = "minor"

def process_admin(admin):
    if admin.age > 18:
        admin.status = "adult"
    else:
        admin.status = "minor"

# 推荐
def set_age_status(person):
    if person.age > 18:
        person.status = "adult"
    else:
        person.status = "minor"

def process_user(user):
    set_age_status(user)

def process_admin(admin):
    set_age_status(admin)
```

## 性能优化建议

### 算法选择
- 优先选择O(n)而非O(n²)算法
- 考虑数据结构的适用性
- 避免不必要的嵌套循环

### 缓存策略
- 缓存重复计算结果
- 使用memoization
- 考虑LRU缓存

### IO优化
- 批量处理IO操作
- 异步IO处理
- 减少网络请求次数

### 数据库优化
- 使用索引
- 避免N+1查询
- 合理使用分页
