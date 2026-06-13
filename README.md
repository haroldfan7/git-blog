# Jason7 个人静态博客

这是一个低复杂度的个人静态博客，用于展示法律项目、AI 使用心得、法律脚本和专业文章。当前设计方向参考：

- lixiaolai.com：编辑部式首页、超大标题、元信息网格、编号分区
- AstroPaper：文章列表、正文排版、暗色模式、代码块和留白节奏
- smallworld / Bear Cub：轻量结构、少组件、少动画、少依赖

## 页面

- `index.html`：首页、精选文章、近期记录、项目、脚本、关于
- `article.html?slug=文章-slug`：文章正文页
- `tags.html`：标签总览
- `tags.html?tag=标签名`：指定标签下的文章

## 技术栈

- HTML：页面结构
- CSS：响应式布局、正文排版、代码块、明暗主题
- JavaScript：文章渲染、标签筛选、主题切换
- GitHub Pages：推荐用于当前部署，方便手机、iPad 和其他电脑访问
- Vercel：也可以作为后续备用部署方式
- Supabase：已预留数据库结构，可在下一阶段接入内容管理

## 部署到 GitHub Pages

推荐方式：新建一个公开 GitHub 仓库，然后启用 GitHub Pages。

如果你的 GitHub 用户名是 `yourname`，最省心的仓库名是：

```text
yourname.github.io
```

这样上线地址通常就是：

```text
https://yourname.github.io/
```

如果仓库名不是 `yourname.github.io`，比如 `personal-site`，地址通常是：

```text
https://yourname.github.io/personal-site/
```

在 GitHub 网页上启用 Pages：

1. 打开仓库。
2. 进入 `Settings`。
3. 找到 `Pages`。
4. `Build and deployment` 选择 `Deploy from a branch`。
5. `Branch` 选择 `main`，目录选择 `/root`。
6. 保存后等待 1-3 分钟。

项目里已经包含 `.nojekyll`，GitHub Pages 会原样发布这些静态文件。

## 在手机、iPad 或其他电脑上管理

上线后，你可以直接用浏览器访问 GitHub Pages 地址。

日常更新内容时，最简单的方式是在 GitHub 网页中编辑：

- `data/site-content.js`：文章、项目、脚本、标签
- `index.html`：首页固定文案
- `styles.css`：整体视觉样式

编辑完成后点击 `Commit changes`，GitHub Pages 会自动更新网站。

## 如何写文章

主要内容在 `data/site-content.js` 的 `articles` 数组中。

每篇文章建议包含：

- `slug`：文章链接标识，例如 `ai-in-legal-work`
- `date`：发布日期
- `category`：分类
- `title`：标题
- `summary`：摘要
- `readingTime`：阅读时间
- `featured`：是否显示在精选文章
- `tags`：标签
- `content`：文章正文 HTML

## 用 Markdown 自动发布

你也可以不用手工编辑 `data/site-content.js`。现在项目里已经有本地发布脚本：

```powershell
npm run publish
```

推荐工作流：

1. 在本地建立待发布文件夹。
   默认配置是：`D:/obsidian install/sync remote alpha/网站待发布`
2. 把写好的 `.md` 文件放进这个文件夹。
3. 在网站项目目录运行：

```powershell
npm run publish
```

脚本会自动：

- 扫描待发布文件夹里的 `.md`
- 读取文章开头的 frontmatter
- 把 Markdown 转成网页正文
- 复制 Obsidian 图片引用到 `assets/articles`
- 写入 `data/site-content.js`
- 创建 Git 提交
- 推送到 GitHub

### Markdown 文件格式

文章开头建议写：

```md
---
title: 文章标题
date: 2026-06-13
section: writing
slug: article-slug
tags: [法律, AI]
summary: 这里写一句摘要。
---

正文从这里开始。
```

`section` 支持三种：

- `writing`：发布到 Writing & Law
- `share`：发布到 Share
- `legal-ai`：发布到 Legal AI，并生成可点击的工具卡片

### 图片写法

支持 Obsidian 图片格式：

```md
![[IMG_0006.jpeg]]
```

脚本会在 Markdown 文件同目录和配置里的附件目录中查找图片，然后复制到网站的 `assets/articles/文章-slug/` 目录。

### 本机配置

本机私有配置文件是：

```text
publish.config.json
```

它已经被 `.gitignore` 忽略，不会上传到 GitHub。公开仓库里只保留：

```text
publish.config.example.json
```

如果你想换待发布文件夹，只改 `publish.config.json` 里的 `draftsDir`。

## 如何替换个人信息

在 `index.html`、`article.html`、`tags.html` 中搜索并替换：

- `Jason7`
- `fanchongzhe@cn.kingandwood.com`
- 头像文件 `头像.jpg`

## Supabase 预留说明

当前网站默认读取 `data/site-content.js`，离线也能正常打开。

如果后续要接 Supabase：

1. 在 Supabase 新建项目。
2. 执行 `supabase/schema.sql` 里的建表语句。
3. 把 `scripts/supabase-config.example.js` 复制为 `scripts/supabase-config.js`，填入项目 URL 和 anon key。
4. 在页面中把 `scripts/supabase-config.example.js` 改成 `scripts/supabase-config.js`。
5. 增加 Supabase 官方浏览器脚本后，即可从数据库读取内容。
