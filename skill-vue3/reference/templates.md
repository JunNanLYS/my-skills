# CRUD 页面模板

> 核心规则见 `SKILL.md`，组件用法见 `reference/shadcn-components.md`。

---

## 使用方式

将 `{Module}` / `{module}` / `{模块中文名}` 替换为实际名称，生成 2 个页面文件 + 1 个类型文件 + 1 个 API 文件。

---

## 1. 列表页模板

```vue
<!-- src/views/{module}/{Module}List.vue -->
<script setup lang="ts">
/**
 * {模块中文名}列表页面
 * 功能：搜索、分页、新增、编辑、删除
 */
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-vue-next'
import type { {Module}Info } from '@/types/{module}'
import {module}Api from '@/api/{module}'
import { useTable } from '@/composables/useTable'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/components/ui/toast/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {Module}Form from './{Module}Form.vue'

// 表格
const { loading, dataList, total, params, handleSearch, handleReset } =
  useTable<{Module}Info>({ apiFn: {module}Api.getList })

// 弹窗
const { visible: formVisible, editingId, open: openForm, close: closeForm } = useDialog<string>()

// 删除确认
const deleteDialogOpen = ref(false)
const deletingItem = ref<{Module}Info | null>(null)

function handleAdd() { openForm() }
function handleEdit(row: {Module}Info) { openForm(row.id) }

function handleDeleteClick(row: {Module}Info) {
  deletingItem.value = row
  deleteDialogOpen.value = true
}

async function handleDeleteConfirm() {
  if (!deletingItem.value) return
  await {module}Api.delete(deletingItem.value.id)
  const { toast } = useToast()
  toast({ title: '删除成功' })
  deleteDialogOpen.value = false
  deletingItem.value = null
  handleSearch()
}

function handleFormSuccess() { closeForm(); handleSearch() }
</script>

<template>
  <div class="space-y-6">
    <!-- 搜索栏 -->
    <Card>
      <CardContent class="pt-6">
        <div class="flex items-center gap-4">
          <Input
            v-model="params.keyword"
            placeholder="请输入关键词"
            class="max-w-sm"
            clearable
            @keyup.enter="handleSearch"
          />
          <Button @click="handleSearch">搜索</Button>
          <Button variant="outline" @click="handleReset">重置</Button>
        </div>
      </CardContent>
    </Card>

    <!-- 数据表格 -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between">
        <CardTitle>{模块中文名}列表</CardTitle>
        <Button @click="handleAdd">
          <Plus class="mr-2 h-4 w-4" />新增
        </Button>
      </CardHeader>
      <CardContent>
        <!-- 加载状态 -->
        <div v-if="loading" class="flex items-center justify-center py-8">
          <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <!-- 表格 -->
        <Table v-else>
          <TableHeader>
            <TableRow>
              <!-- 根据业务字段添加列 -->
              <TableHead>名称</TableHead>
              <TableHead class="w-[120px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="item in dataList" :key="item.id">
              <TableCell class="font-medium">{{ item.name }}</TableCell>
              <TableCell class="text-right">
                <Button variant="ghost" size="icon-sm" @click="handleEdit(item)">
                  <Pencil class="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" @click="handleDeleteClick(item)">
                  <Trash2 class="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
            <!-- 空状态 -->
            <TableRow v-if="dataList.length === 0">
              <TableCell colspan="2" class="h-24 text-center text-muted-foreground">
                暂无数据
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <!-- 分页信息 -->
        <div class="mt-4 flex items-center justify-between">
          <p class="text-sm text-muted-foreground">共 {{ total }} 条记录</p>
          <div class="flex items-center gap-2">
            <select
              v-model.number="params.page_size"
              class="h-8 rounded-md border border-input bg-background px-2 text-sm"
              @change="handleSearch"
            >
              <option :value="10">10 条/页</option>
              <option :value="20">20 条/页</option>
              <option :value="50">50 条/页</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 表单弹窗 -->
    <{Module}Form v-model:visible="formVisible" :item-id="editingId" @success="handleFormSuccess" />

    <!-- 删除确认 -->
    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>此操作不可撤销，确定要删除吗？</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="handleDeleteConfirm"
          >删除</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
```

---

## 2. 表单弹窗模板（vee-validate + zod）

```vue
<!-- src/views/{module}/{Module}Form.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { Loader2 } from 'lucide-vue-next'
import { useToast } from '@/components/ui/toast/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import type { {Module}Create, {Module}Update } from '@/types/{module}'
import {module}Api from '@/api/{module}'

const props = defineProps<{
  visible: boolean
  itemId: string | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const loading = ref(false)
const isEdit = computed(() => !!props.itemId)

// Zod 校验规则
const formSchema = toTypedSchema(z.object({
  name: z.string().min(1, '请输入名称').max(50, '名称最多 50 个字符'),
  // 根据业务字段添加校验规则
}))

const form = useForm({ validationSchema: formSchema })

// 监听弹窗打开
watch(
  () => props.visible,
  async (val) => {
    if (val) {
      if (props.itemId) {
        const res = await {module}Api.getById(props.itemId)
        form.resetForm({ values: res })
      } else {
        form.resetForm()
      }
    }
  }
)

const onSubmit = form.handleSubmit(async (values) => {
  loading.value = true
  try {
    if (isEdit.value) {
      await {module}Api.update(props.itemId!, values as {Module}Update)
    } else {
      await {module}Api.create(values as {Module}Create)
    }
    const { toast } = useToast()
    toast({ title: isEdit.value ? '更新成功' : '创建成功' })
    emit('update:visible', false)
    emit('success')
  } finally {
    loading.value = false
  }
})

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog :open="visible" @update:open="emit('update:visible', $event)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑' : '新增' }}{模块中文名}</DialogTitle>
        <DialogDescription>请填写以下信息。</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>名称</FormLabel>
            <FormControl>
              <Input placeholder="请输入名称" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <!-- 根据业务字段添加更多 FormField -->

        <DialogFooter>
          <Button type="button" variant="outline" @click="handleClose">取消</Button>
          <Button type="submit" :disabled="loading">
            <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
            确定
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
```

---

## 3. 类型文件模板

```typescript
// src/types/{module}.d.ts
/** {模块中文名}信息 */
export interface {Module}Info {
  id: string
  name: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/** 创建{模块中文名} */
export interface {Module}Create {
  name: string
  description?: string
}

/** 更新{模块中文名} */
export interface {Module}Update {
  name?: string
  description?: string
  is_active?: boolean
}
```

---

## 4. API 文件模板

```typescript
// src/api/{module}.ts
import service, { type PageResponse, type PageParams } from './index'
import type { {Module}Create, {Module}Update, {Module}Info } from '@/types/{module}'

const {module}Api = {
  getList: (params: PageParams) =>
    service.get<any, PageResponse<{Module}Info>>('/{module_name}s', { params }),

  getById: (id: string) =>
    service.get<any, {Module}Info>(`/{module_name}s/${id}`),

  create: (data: {Module}Create) =>
    service.post<any, {Module}Info>('/{module_name}s', data),

  update: (id: string, data: {Module}Update) =>
    service.put<any, {Module}Info>(`/{module_name}s/${id}`, data),

  delete: (id: string) =>
    service.delete<any, void>(`/{module_name}s/${id}`),
}

export default {module}Api
```

---

## 5. 快速替换清单

| 占位符 | 示例（用户模块） |
|--------|----------------|
| `{module}` | `user` |
| `{Module}` | `User` |
| `{module_name}` | `user` |
| `{模块中文名}` | `用户` |
