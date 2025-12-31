# 积分制绩效管理系统

基于 React + TypeScript + Vite + Supabase 构建的现代化积分制绩效管理系统。

## 项目简介

本系统用于管理员工的积分评价、排名和奖励，包含四大积分模块：
- **基本职责积分**：考勤管理、基础学习、工作纪律
- **工作实绩积分**：日常评价、年终测评
- **重点工作积分**：任务分配、完成度评估
- **绩效奖励积分**：表彰奖励记录

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 6
- **UI 组件库**: Ant Design 5
- **状态管理**: Zustand
- **后端服务**: Supabase (PostgreSQL + 认证 + 实时订阅)
- **图表库**: Recharts + ECharts
- **路由**: React Router v7

## 快速开始

### 环境要求

- Node.js >= 18
- npm 或 yarn

### 安装依赖

\`\`\`bash
npm install
\`\`\`

### 环境配置

请参考 [环境变量配置文档](docs/环境变量配置.md) 配置 Supabase 相关环境变量。

创建 `.env` 文件：

\`\`\`env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
\`\`\`

### 开发运行

\`\`\`bash
npm run dev
\`\`\`

### 构建生产版本

\`\`\`bash
npm run build
\`\`\`

### 预览生产构建

\`\`\`bash
npm run preview
\`\`\`

## 项目结构

\`\`\`
src/
├── components/      # 可复用组件
├── pages/          # 页面组件
├── stores/         # Zustand 状态管理
├── services/       # API 服务
├── hooks/          # 自定义 Hooks
├── lib/            # 工具库和配置
└── utils/          # 工具函数
\`\`\`

## 主要功能

- ✅ 用户认证与权限管理
- ✅ 积分管理（四大模块）
- ✅ 排行榜与统计分析
- ✅ 人员与部门管理
- ✅ Excel 数据导入导出
- ✅ 实时数据同步
- ✅ 通知中心

## 相关文档

- [环境变量配置](docs/环境变量配置.md)
- [交付说明](docs/交付说明.md)
- [端到端验证清单](docs/端到端串联验证清单.md)

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  extends: [
    // other configs...
    // Enable lint rules for React
    reactX.configs['recommended-typescript'],
    // Enable lint rules for React DOM
    reactDom.configs.recommended,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```
