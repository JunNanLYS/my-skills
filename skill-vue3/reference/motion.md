# Motion 动效参考

> 核心规则见 `SKILL.md`。

## 安装

```bash
npm install motion-v
```

---

## 1. 基础用法

```vue
<script setup lang="ts">
import { motion } from 'motion-v'
</script>

<template>
  <!-- 淡入上滑 -->
  <motion.div
    :initial="{ opacity: 0, y: 20 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.3 }"
  >
    内容
  </motion.div>

  <!-- 悬停缩放 -->
  <motion.div
    :while-hover="{ scale: 1.05 }"
    :while-press="{ scale: 0.95 }"
  >
    可交互元素
  </motion.div>

  <!-- 进入视口时显示 -->
  <motion.div
    :initial="{ opacity: 0 }"
    :while-in-view="{ opacity: 1 }"
    :viewport="{ once: true }"
    :transition="{ duration: 0.5 }"
  >
    滚动可见时显示
  </motion.div>
</template>
```

---

## 2. 列表动画（AnimatePresence）

```vue
<script setup lang="ts">
import { motion, AnimatePresence } from 'motion-v'
</script>

<template>
  <AnimatePresence>
    <motion.div
      v-for="item in dataList"
      :key="item.id"
      :initial="{ opacity: 0, y: -10 }"
      :animate="{ opacity: 1, y: 0 }"
      :exit="{ opacity: 0, y: 10 }"
      :transition="{ duration: 0.2 }"
    >
      {{ item.name }}
    </motion.div>
  </AnimatePresence>
</template>
```

---

## 3. 弹窗动画

```vue
<script setup lang="ts">
import { motion } from 'motion-v'
</script>

<template>
  <DialogContent>
    <motion.div
      :initial="{ opacity: 0, scale: 0.95 }"
      :animate="{ opacity: 1, scale: 1 }"
      :transition="{ duration: 0.2 }"
    >
      弹窗内容
    </motion.div>
  </DialogContent>
</template>
```

---

## 4. 预设动画变体

统一放在 `src/constants/animations.ts`，复用动画：

```typescript
// src/constants/animations.ts

/** 页面切换 */
export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25, ease: 'easeOut' },
}

/** 列表项 */
export const listItemVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: { duration: 0.2 },
}

/** 弹窗 */
export const dialogVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: 'easeOut' },
}

/** 卡片悬停 */
export const cardHover = {
  whileHover: { y: -2, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' },
  transition: { duration: 0.2 },
}
```

使用：

```vue
<script setup lang="ts">
import { motion } from 'motion-v'
import { pageTransition } from '@/constants/animations'
</script>

<template>
  <motion.div v-bind="pageTransition">
    页面内容
  </motion.div>
</template>
```

---

## 5. 可用属性速查

| 属性 | 说明 |
|------|------|
| `:initial` | 初始状态 |
| `:animate` | 目标状态 |
| `:exit` | 退出状态（需 AnimatePresence） |
| `:transition` | 过渡配置（duration, ease, delay） |
| `:while-hover` | 悬停状态 |
| `:while-press` | 按下状态 |
| `:while-in-view` | 进入视口状态 |
| `:viewport` | 视口配置（`{ once: true }` 只触发一次） |

---

## 6. 规则

- ✅ 用 `motion-v` 包（非 `@vueuse/motion`）
- ✅ 必须设 `duration`，推荐 0.2~0.4 秒
- ✅ 列表动画配合 `AnimatePresence`
- ✅ 复用变体放 `src/constants/animations.ts`
- ✅ 适用于：页面切换、列表项、弹窗、卡片悬停
- ❌ 禁止 `duration > 0.5s`
- ❌ 禁止大量列表（>100 条）逐项动画
- ❌ 禁止弹跳、旋转等花哨效果
- ❌ 禁止 `motion.create()` 放在模板中
