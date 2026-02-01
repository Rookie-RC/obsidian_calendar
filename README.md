# Obsidian Calendar 插件

一款简洁优雅的 Obsidian 日历插件，支持 iCal 订阅（Google Calendar）和本地笔记整合，采用 Apple Calendar 风格设计。

## ✨ 主要特性

- 📅 **月视图日历** - 清爽的月历视图，支持快速导航
- 🔗 **iCal 订阅支持** - 整合 Google Calendar 等 iCal 格式日历源
- 📝 **笔记关联** - 通过 frontmatter 日期字段自动关联笔记
- 🎨 **Apple 风格设计** - 简洁、克制、优雅的视觉体验
- 🌓 **深浅色主题** - 完美适配 Obsidian 明暗主题
- ⚡ **快速创建笔记** - 一键为选定日期创建笔记
- 🎯 **笔记密度指示** - 可视化显示每日笔记数量
- 🔄 **自动刷新** - 定时同步日历数据

## 📦 安装方式

### 从 GitHub Release 安装（推荐）

1. 从 [最新 Release](https://github.com/YOUR_USERNAME/obsidian_calendar/releases) 下载 `main.js` 和 `manifest.json`
2. 在你的 Vault 插件目录中创建文件夹：

   ```
   /path/to/vault/.obsidian/plugins/obsidian-calendar-mvp/
   ```

3. 将下载的文件复制到该文件夹中
4. 在 Obsidian 中启用插件：
   - 设置 → 社区插件 → 启用 "Calendar MVP"

### 手动构建

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/obsidian_calendar.git
cd obsidian_calendar

# 安装依赖
npm install

# 构建
npm run build

# 将 main.js 和 manifest.json 复制到你的 vault 插件目录
```

## 🚀 快速开始

### 1. 添加日历源

进入插件设置，在 "Calendar sources" 部分添加你的 iCal 订阅地址：

- **Google Calendar**: 日历设置 → 集成日历 → 秘密地址（iCal 格式）
- **其他服务**: 任何支持 iCal (ICS) 格式的日历服务

### 2. 配置笔记关联

在设置中配置 "Note date fields"，指定用于关联日期的 frontmatter 字段（默认为 `date`）：

```yaml
---
date: 2026-02-01
---
```

### 3. 使用日历

- 点击侧边栏的日历图标打开视图
- 点击日期查看当天的笔记和事件
- 使用 "Create note" 按钮快速创建笔记
- 鼠标悬停在日期上可预览笔记内容

## ⚙️ 配置选项

### 基础设置

- **刷新间隔**: 日历数据自动刷新的时间间隔（分钟）
- **周起始日**: 选择周一或周日作为每周第一天
- **时间格式**: 12 小时制或 24 小时制

### 视觉定制

- **Today 高亮色**: 今天日期的强调色
- **选中日期高亮色**: 当前选中日期的强调色
- **笔记密度条颜色**: 日期下方笔记数量指示条的颜色

### 笔记设置

- **笔记日期字段**: 用于关联笔记的 frontmatter 字段（支持多个，逗号分隔）
- **允许创建笔记**: 是否显示快速创建笔记按钮
- **笔记模板**: 选择创建笔记时使用的模板文件

## 🎨 设计理念

本插件的视觉设计参考了 Apple Calendar，追求：

- **极简克制** - 去除视觉噪音，只保留必要元素
- **清晰层级** - 通过间距、字重和对齐建立视觉层次
- **舒适自然** - 适度的留白和柔和的色彩
- **Obsidian 原生感** - 完美融入 Obsidian 界面风格

### 关键设计元素

- ✅ **下划线强调** - 今天和选中日期使用粗下划线，而非背景色
- ✅ **开放式网格** - 无边框日历格，轻盈通透
- ✅ **微妙的周末区分** - 周末通过透明度区分，不使用警示色
- ✅ **笔记密度条** - 细线指示器，默认使用柔和的青色

## 🔌 API 与命令

插件提供以下命令：

- `Open calendar` - 打开日历视图
- `Jump to today` - 跳转到今天
- `Refresh calendar` - 立即刷新日历数据

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- 设计灵感来自 Apple Calendar
- 基于 Obsidian API 构建
- iCal 解析实现参考了社区最佳实践

---

**注意**: 这是一个 MVP (Minimum Viable Product) 版本，功能持续完善中。如遇问题请提交 Issue。
