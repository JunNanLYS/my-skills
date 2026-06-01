# Shadcn Vue + Tailwind CSS 组件参考

> 核心规则见 `SKILL.md`。

---

## 1. Shadcn Vue 安装与导入

### 安装（CLI 添加到项目本地）

```bash
pnpm dlx shadcn-vue@latest add button dialog table form input card badge alert-dialog toast pagination
```

### 导入方式

```typescript
// ✅ 从本地 ui 目录导入
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast/use-toast'
import { Toaster } from '@/components/ui/toast'

// ❌ 禁止从 npm 包导入
// import { Button } from 'shadcn-vue'
```

---

## 2. Button 按钮

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-vue-next'
</script>

<template>
  <Button>默认（主要操作）</Button>
  <Button variant="secondary">次要</Button>
  <Button variant="outline">轮廓（重置/取消）</Button>
  <Button variant="ghost">幽灵（表格操作）</Button>
  <Button variant="destructive">危险（删除）</Button>
  <Button variant="link">链接</Button>

  <!-- 带图标 -->
  <Button><Plus class="mr-2 h-4 w-4" />新增</Button>

  <!-- 图标按钮 -->
  <Button variant="ghost" size="icon-sm"><Pencil class="h-4 w-4" /></Button>

  <!-- 加载 -->
  <Button :disabled="loading">
    <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />提交
  </Button>
</template>
```

**variant 速查**：`default` 主要 | `secondary` 次要 | `outline` 边框 | `ghost` 幽灵 | `destructive` 危险 | `link` 链接

**size 速查**：`default` | `sm` | `lg` | `icon` | `icon-sm` | `icon-lg`

---

## 3. Dialog 弹窗

```vue
<script setup lang="ts">
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
const open = ref(false)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>标题</DialogTitle>
        <DialogDescription>描述文字。</DialogDescription>
      </DialogHeader>
      <!-- 内容 -->
      <DialogFooter>
        <Button variant="outline" @click="open = false">取消</Button>
        <Button @click="handleSubmit">确定</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- 用 `v-model:open` 控制开关
- `DialogContent` 可设 `class="max-w-md"` 控制宽度

---

## 4. AlertDialog 确认弹窗（替代 ElMessageBox.confirm）

```vue
<script setup lang="ts">
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
const dialogOpen = ref(false)
</script>

<template>
  <AlertDialog v-model:open="dialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认删除</AlertDialogTitle>
        <AlertDialogDescription>此操作不可撤销，确定要删除吗？</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="handleConfirm"
        >删除</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
```

---

## 5. Toast 消息提示（替代 ElMessage）

```vue
<script setup lang="ts">
import { useToast } from '@/components/ui/toast/use-toast'
const { toast } = useToast()

toast({ title: '操作成功' })
toast({ title: '操作失败', description: '请稍后重试', variant: 'destructive' })
</script>
```

> `<Toaster />` 只需在 `App.vue` 中挂载一次。

---

## 6. Table 表格

```vue
<script setup lang="ts">
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>名称</TableHead>
        <TableHead class="w-[120px] text-right">操作</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="item in dataList" :key="item.id">
        <TableCell class="font-medium">{{ item.name }}</TableCell>
        <TableCell class="text-right">...</TableCell>
      </TableRow>
      <!-- 空状态 -->
      <TableRow v-if="dataList.length === 0">
        <TableCell colspan="2" class="h-24 text-center text-muted-foreground">暂无数据</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
```

---

## 7. Card 卡片

```vue
<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between">
      <CardTitle>标题</CardTitle>
      <Button>操作</Button>
    </CardHeader>
    <CardContent>内容</CardContent>
  </Card>
</template>
```

---

## 8. Badge 徽章（替代 el-tag）

```vue
<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
</script>

<template>
  <Badge variant="default">启用</Badge>
  <Badge variant="destructive">禁用</Badge>
  <Badge variant="secondary">次要</Badge>
  <Badge variant="outline">轮廓</Badge>
</template>
```

---

## 9. Form 表单校验（vee-validate + zod）

```vue
<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const formSchema = toTypedSchema(z.object({
  username: z.string().min(2, '至少 2 个字符').max(50, '最多 50 个字符'),
  email: z.string().email('请输入正确的邮箱'),
  password: z.string().min(6, '至少 6 个字符'),
}))

const form = useForm({ validationSchema: formSchema })
const onSubmit = form.handleSubmit((values) => { /* 提交 */ })
</script>

<template>
  <form class="space-y-4" @submit="onSubmit">
    <FormField v-slot="{ componentField }" name="username">
      <FormItem>
        <FormLabel>用户名</FormLabel>
        <FormControl>
          <Input placeholder="请输入" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button type="submit">提交</Button>
  </form>
</template>
```

**结构**：`FormField` → `FormItem` → `FormLabel` + `FormControl` + `FormMessage`

---

## 10. Input 输入框

```vue
<script setup lang="ts">
import { Input } from '@/components/ui/input'
</script>

<template>
  <Input v-model="value" placeholder="请输入" />
  <Input type="email" placeholder="邮箱" />
  <Input type="password" placeholder="密码" />
</template>
```

---

## 11. Select 下拉选择

```vue
<script setup lang="ts">
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
</script>

<template>
  <Select v-model="value">
    <SelectTrigger class="w-[180px]">
      <SelectValue placeholder="请选择" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="active">启用</SelectItem>
      <SelectItem value="inactive">禁用</SelectItem>
    </SelectContent>
  </Select>
</template>
```

---

## 12. DropdownMenu 下拉菜单

```vue
<script setup lang="ts">
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-vue-next'
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm"><MoreHorizontal class="h-4 w-4" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem @click="handleEdit">编辑</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="text-destructive" @click="handleDelete">删除</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
```

---

## 13. Skeleton 骨架屏

```vue
<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'
</script>

<template>
  <div class="flex items-center space-x-4">
    <Skeleton class="h-12 w-12 rounded-full" />
    <div class="space-y-2">
      <Skeleton class="h-4 w-[250px]" />
      <Skeleton class="h-4 w-[200px]" />
    </div>
  </div>
</template>
```

---

## 14. Tailwind CSS 常用类速查

### 布局

```html
<div class="space-y-6">                    <!-- 垂直间距 1.5rem -->
<div class="space-y-4">                    <!-- 垂直间距 1rem -->
<div class="space-x-4">                    <!-- 水平间距 1rem -->
<div class="flex items-center gap-4">      <!-- 水平排列 + 间距 -->
<div class="flex justify-between">         <!-- 两端对齐 -->
<div class="flex flex-col">                <!-- 垂直排列 -->
<div class="grid grid-cols-2 gap-4">       <!-- 网格布局 -->
<div class="flex-1">                       <!-- 弹性填充 -->
```

### 间距

```html
p-4 pt-6 pb-2 px-4 py-2 m-4 mx-auto mt-4 mb-2
```

### 文字

```html
text-sm text-base text-lg text-xl text-2xl
font-medium font-semibold font-bold
text-foreground text-muted-foreground text-destructive
text-center text-right
truncate (单行省略)
```

### 边框与圆角

```html
rounded-md rounded-lg rounded-full
border border-input
divide-y divide-border
```

### 显示与隐藏

```html
hidden block inline-flex
v-if / v-show (Vue 指令)
```

### 响应式

```html
sm:  md:  lg:  xl:  2xl:
```

### 语义化颜色（Shadcn Vue）

```html
bg-background text-foreground
bg-card text-card-foreground
bg-primary text-primary-foreground
bg-muted text-muted-foreground
bg-destructive text-destructive-foreground
border-border
ring-ring
```

---

## 15. 全局样式入口

```css
/* src/assets/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    /* Shadcn Vue 自动生成的 CSS 变量 */
  }
  .dark { /* 暗色变量 */ }
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

---

## 16. 样式规则总结

- ✅ 优先 Tailwind 工具类，用 `cn()` 合并
- ✅ 语义化颜色：`text-foreground`、`text-muted-foreground`
- ✅ 仅在 Tailwind 不够时用 `<style scoped>`
- ❌ 禁止 SCSS 变量
- ❌ 禁止硬编码颜色值
- ❌ 禁止 `!important`
