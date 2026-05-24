---
name: skill-vue3
description: Vue 3 前端编码规范，包含项目结构、组件库、动画、状态管理、路由、请求层、页面模板等，编辑前端时必须遵守。
---

# Vue 3 前端编码规范

> **渐进式披露设计**：本文件是核心索引，始终加载。详细参考按需加载。
>
> - 🎨 Shadcn Vue 组件用法 + Tailwind CSS → 加载 `reference/shadcn-components.md`
> - ✨ Motion 动效模式 → 加载 `reference/motion.md`
> - 📦 CRUD 页面模板 → 加载 `reference/templates.md`

## 技术栈

Vue 3 + TypeScript + Shadcn Vue + Tailwind CSS + Motion (motion-v) + Pinia + Vue Router + Axios

---

## 1. 项目结构

```
frontend/src/
├── api/                    # API 请求层
│   ├── index.ts            # axios 实例 + 拦截器
│   └── {module}.ts         # 模块 API
├── components/
│   ├── ui/                 # Shadcn Vue 组件（CLI 生成，勿手动改）
│   ├── common/             # 通用基础组件
│   └── business/           # 通用业务组件
├── composables/            # 组合式函数
│   ├── useTable.ts         # 表格通用逻辑
│   └── useDialog.ts        # 弹窗通用逻辑
├── constants/              # 常量（含动画变体）
├── layouts/                # 布局组件
├── lib/utils.ts            # cn() 工具函数
├── router/index.ts         # 路由
├── stores/                 # Pinia 状态管理
├── types/                  # TypeScript 类型
├── utils/                  # 工具函数
├── views/{module}/         # 页面视图
├── assets/styles/globals.css
├── App.vue
└── main.ts
```

---

## 2. API 请求层

```typescript
// src/api/index.ts — 核心结构
export interface ApiResponse<T> { code: number; message: string; data: T }
export interface PageResponse<T> { items: T[]; total: number; page: number; page_size: number }
export interface PageParams { page?: number; page_size?: number; keyword?: string }

// 错误提示用 useToast，不用 ElMessage
```

```typescript
// src/api/{module}.ts — 模块 API
const {module}Api = {
  getList: (params: PageParams) => service.get<any, PageResponse<{Module}Info>>('/{module_name}s', { params }),
  getById: (id: string) => service.get<any, {Module}Info>(`/{module_name}s/${id}`),
  create: (data: {Module}Create) => service.post<any, {Module}Info>('/{module_name}s', data),
  update: (id: string, data: {Module}Update) => service.put<any, {Module}Info>(`/{module_name}s/${id}`, data),
  delete: (id: string) => service.delete<any, void>(`/{module_name}s/${id}`),
}
```

- ✅ 统一 axios 实例，每个函数有返回类型
- ✅ 错误提示用 `useToast`（Shadcn Vue Toast）
- ❌ 禁止组件中直接 axios，禁止 api 层处理 UI 逻辑

---

## 3. 类型定义

```typescript
// src/types/{module}.d.ts
export interface {Module}Info { id: string; name: string; /* ... */ created_at: string }
export interface {Module}Create { name: string; /* ... */ }
export interface {Module}Update { name?: string; /* ... */ }
```

- ✅ 字段名 `snake_case`（与后端一致）
- ❌ 禁止 `any`

### ⚠️ 强制类型标注（零容忍）

**所有变量和函数必须显式标注类型，不允许省略。**

```typescript
// ✅ 正确
const count: Ref<number> = ref(0)
const name: string = 'test'
const list: ModuleInfo[] = []
const isLoading: ComputedRef<boolean> = computed(() => !!loading.value)

function fetchList(params: PageParams): Promise<PageResponse<ModuleInfo>> { ... }
function handleSubmit(): void { ... }
const double = (n: number): number => n * 2

// ❌ 禁止
const count = ref(0)           // 缺少 Ref<number>
const name = 'test'            // 缺少 : string
const list = []                // 缺少类型注解
function fetchList(params) { } // 缺少参数类型和返回类型
function handleSubmit() { }    // 缺少返回类型
```

- ❌ **禁止**省略变量的类型注解（包括 `ref`、`reactive`、`computed`）
- ❌ **禁止**省略函数参数的类型注解
- ❌ **禁止**省略函数返回类型（包括箭头函数和 composable 返回值）
- ❌ **禁止**依赖 TypeScript 类型推断代替显式标注

---

## 4. Composables

### useTable — 表格通用逻辑

```typescript
const { loading, dataList, total, params, handleSearch, handleReset } =
  useTable<{Module}Info>({ apiFn: {module}Api.getList })
```

### useDialog — 弹窗通用逻辑

```typescript
const { visible, editingId, isEdit, open, close } = useDialog<string>()
```

- ✅ 文件名 `use` 前缀 + camelCase
- ✅ 必须用 TypeScript 泛型
- ❌ 禁止操作 DOM

---

## 5. 组件规范

- ✅ `<script setup lang="ts">` → `<template>` → `<style scoped>`（按需）
- ✅ 图标：`lucide-vue-next`（唯一图标库）
- ✅ 加载状态：`v-if="loading"` + `<Loader2 class="animate-spin">`
- ✅ 样式：优先 Tailwind 工具类
- ❌ 禁止 Options API
- ❌ 禁止 `el-*`、`ElMessage`、`ElMessageBox` 等 Element Plus

### Props / Emits

```typescript
const props = withDefaults(defineProps<{ visible: boolean; itemId: string | null }>(), {})
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'success'): void }>()
```

---

## 6. 路由

```typescript
// 懒加载 + PascalCase name + meta
{ path: 'users', name: 'UserList', component: () => import('@/views/user/UserList.vue'), meta: { title: '用户管理' } }
```

---

## 7. Pinia

```typescript
// Setup Store 风格
export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const isLoggedIn = computed(() => !!token.value)
  // actions...
  return { token, isLoggedIn }
})
```

---

## 8. Shadcn Vue 核心速查

> 完整组件用法见 `reference/shadcn-components.md`

| 场景 | 组件 | 关键点 |
|------|------|--------|
| 按钮 | `<Button variant="outline/ghost/destructive">` | 图标用 `lucide-vue-next` |
| 弹窗 | `<Dialog v-model:open>` | `DialogContent/Header/Footer` |
| 确认删除 | `<AlertDialog>` | 替代 `ElMessageBox.confirm` |
| 消息提示 | `useToast()` → `toast({ title })` | `<Toaster />` 挂在 App.vue |
| 表格 | `<Table/Header/Body/Row/Cell>` | 空状态用 `colspan` |
| 表单 | `vee-validate` + `zod` + `<FormField>` | `FormField → FormItem → Label + Control + Message` |
| 卡片 | `<Card/Header/Content>` | — |
| 徽章 | `<Badge variant="default/destructive">` | 替代 `el-tag` |

**导入方式**：`import { Button } from '@/components/ui/button'`（本地路径，非 npm）

---

## 9. Tailwind CSS 速查

> 完整样式规范见 `reference/shadcn-components.md`

```html
<div class="space-y-6">          <!-- 垂直间距 -->
<div class="flex items-center gap-4">  <!-- 水平排列 -->
<div class="flex justify-between">     <!-- 两端对齐 -->
<p class="text-sm text-muted-foreground">  <!-- 次要文字 -->
```

- ✅ 用 `cn()` 合并类名
- ❌ 禁止 SCSS 变量、硬编码颜色、`!important`

---

## 10. 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `UserList.vue` |
| composable | camelCase + use | `useTable.ts` |
| CSS | Tailwind 工具类 | `space-y-4` |
| 路由 name | PascalCase | `UserList` |
| 变量/函数 | camelCase | `handleSearch` |
| 常量 | UPPER_SNAKE | `MAX_PAGE_SIZE` |

---

## 11. AI 检查清单

- [ ] `<script setup lang="ts">`
- [ ] Props / Emits 有类型定义
- [ ] API 通过 api 层，有返回类型
- [ ] 类型与后端 Schema 对应
- [ ] **所有变量均有显式类型标注**（含 `ref`、`reactive`、`computed`）
- [ ] **所有函数参数和返回类型均已标注**（含箭头函数、composable 返回值）
- [ ] 用了 composables（useTable / useDialog）
- [ ] 表单用 zod + vee-validate
- [ ] Shadcn Vue 组件从 `@/components/ui/` 导入
- [ ] 图标用 `lucide-vue-next`
- [ ] 消息提示用 `useToast`
- [ ] 确认弹窗用 `AlertDialog`
- [ ] 加载状态用 `Loader2` + 条件渲染
- [ ] 样式优先 Tailwind 工具类
- [ ] 组件文件名 PascalCase
- [ ] 列表页有搜索、分页、CRUD
- [ ] 命名规范正确
- [ ] **无任何 Element Plus 组件**
