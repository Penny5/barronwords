# Barron's 1100 Words — 个人学习工具

把 Barron's 1100 Words You Need to Know 电子书转成 H5 词汇学习 App，纯自用。

## 数据流

```
EPUB (book.epub)
    ↓  npm run parse
data/weeks.json          ← 48 周 · 303 课（含 Bonus A/B）
    ↓  npm run enrich / enrich:passages
例句中文 + 短文中文
    ↓  H5 fetch
浏览器 localStorage 存学习进度
```

## 快速开始

```bash
# 1. 安装依赖
npm install && cd h5 && npm install && cd ..

# 2. 放置 EPUB 到项目根目录 book.epub，或指定路径
npm run parse                          # 或: npm run parse -- "path/to/book.epub"

# 3. 补充例句和中文翻译（首次或重新 parse 后）
npm run enrich
npm run enrich:passages

# 4. 启动
npm run dev:h5                         # http://localhost:5199
npm run build:h5                       # 输出 h5/dist/
```

## H5 架构

```
h5/src/
├── main.js              # 加载 weeks.json，启动应用
├── app.js               # 路由注册
├── core/
│   ├── router.js        # hash 路由
│   ├── store.js         # 内存态（quiz / review / memorize）
│   └── dom.js           # mount / delegate / toast
├── views/
│   ├── home.js          # 首页：进度、任务、跳课
│   ├── learn.js         # 学习：词卡轮播、短文、习语
│   ├── quiz.js          # 练习：填空 + 词义匹配
│   ├── memorize.js      # 词汇本：SRS 入口 + 自由练习
│   ├── review.js        # 复习会话：翻卡 / 看义选词
│   └── weak.js          # 薄弱词本
├── components/
│   ├── layout.js        # shell、tabBar、词卡轮播、任务清单
│   └── review-ui.js     # 共享复习 UI（翻卡、看义选词）
├── utils/
│   ├── progress.js      # 进度 localStorage
│   ├── srs.js           # 间隔复习算法
│   ├── vocab.js         # 词汇本统计
│   ├── weak.js          # 薄弱词
│   ├── def-pick.js      # 看义选词题目生成
│   ├── course.js        # 课程工具
│   ├── quiz.js          # 判分
│   ├── word.js          # 词索引查询
│   ├── speech.js        # TTS 发音
│   └── date.js          # 日期工具
└── styles/              # Scholar's Desk 设计系统
```

## 功能一览

| 模块 | 说明 |
|------|------|
| **今日任务** | 浏览新词 → 阅读短文 → 完成练习 |
| **学习** | 词卡 3D 翻转、例句中文、短文高亮、TTS 发音 |
| **练习** | 填空题 + 词义匹配；Day 5/6/7 有周复习/辨析/故事 |
| **词汇本** | SRS 间隔复习、看义选词、已毕业词、自由翻卡 |
| **薄弱词本** | 练习/复习错题自动收录，专练入口 |
| **间隔复习** | 1→3→7→14→30→60 天；模糊/不熟加练；level≥4 毕业（界面显示 Lv.5） |

## 进度存储

`localStorage` key: `barron_progress`

```json
{
  "week": 1, "day": 1,
  "completedDays": ["w1-d1"],
  "tasks": { "w1-d1": { "passage": true, "quiz": true } },
  "srs": { "voracious": { "word": "...", "level": 2, "nextReview": "2026-07-20" } },
  "weak": { "voracious": { "word": "...", "count": 1, "reason": "quiz" } }
}
```

## 课程结构

| Day | 类型 | 内容 |
|-----|------|------|
| 1–4 | lesson | 5 新词 + 短文 + 练习 |
| 5 | review | 周复习 |
| 6 | sensible | 辨析选词 |
| 7 | wordsearch | 选词故事 |
| Bonus | wordMatch 等 | 见 weeks.json |

首页「复习 N」直达 `#review` 间隔复习会话；词汇本 Tab 可切换复习方式。首页底部可**导出/导入**进度 JSON 备份。

## 设计系统

主题 **Scholar's Desk**：墨蓝 `#0F2744` + 纸白 `#F8F6F1` + 金色 `#C9A227`  
字体：Fraunces（标题/单词）+ Source Sans 3（界面）

## 脚本说明

| 命令 | 作用 |
|------|------|
| `npm run parse [epub]` | 解析 EPUB → `data/weeks.json` |
| `npm run enrich` | 补例句 + Edge 翻译中文 |
| `npm run enrich:passages` | 翻译短文/故事（passageZh、storyZh） |
| `npm run enrich:definitions` | 批量补 wordIndex 释义 |
| `npm run enrich:fast` | 补例句但跳过翻译 |

EPUB 路径优先级：命令行参数 > 环境变量 `BARRON_EPUB` > 项目根 `book.epub`
