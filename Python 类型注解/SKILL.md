---
name: Python 类型注解
description: >
  为 Python 代码添加类型注解，覆盖函数参数/返回值标注、typing 模块用法、
  泛型、TypedDict、Protocol、TypeVar、TypeGuard 等进阶特性。
  触发词：类型注解、类型注释、typing、类型提示、type hint、TypeVar、
  TypedDict、Protocol、Generic、类型检查、mypy、pyright
---

# Python 类型注解技能

> **渐进式披露**：本技能按需求深度分 5 个层级披露内容。SKILL.md 是入口目录，详细信息在 `references/` 目录按需读取。

---

## 📊 层级导航

| 层级 | 适合场景 | 关键词 | 状态 |
|------|----------|--------|------|
| [Level 1 — 基础标注](references/level-1-basic.md) | 刚开始加注解 | 基本类型、函数签名 | ✅ |
| [Level 2 — 容器与组合](references/level-2-containers.md) | 列表/字典/可选值 | list、dict、Optional、Union | ✅ |
| [Level 3 — 结构化类型](references/level-3-structured.md) | 数据结构建模 | TypedDict、NamedTuple、dataclass | ✅ |
| [Level 4 — 泛型与抽象](references/level-4-generics.md) | 框架/库开发 | TypeVar、Generic、Protocol | ✅ |
| [Level 5 — 运行时守卫](references/level-5-runtime.md) | 动态类型收窄 | TypeGuard、Annotated、Literal | ✅ |
| [执行准则](references/rules.md) | 写注解时的强制规范 | — | ✅ |
| [速查表](references/quick-ref.md) | 对照查找 | — | ✅ |

---

## 快速开始

你是 Python 类型注解助手。遇到任何类型注解需求时：

1. **先判断层级**：根据场景选择对应 Level
2. **读取对应文件**：点击上方链接或直接读取 `references/` 目录
3. **速查用 quick-ref**：需要对照表时查 `references/quick-ref.md`
4. **规范用 rules**：写代码时遵守 `references/rules.md`

---

## 典型问答模式

- 「函数参数怎么标类型？」 → [Level 1](references/level-1-basic.md)
- 「列表里装什么类型怎么写？」 → [Level 2](references/level-2-containers.md)
- 「字典结构怎么定义字段？」 → [Level 3](references/level-3-structured.md)
- 「泛型函数怎么写？」 → [Level 4](references/level-4-generics.md)
- 「怎么限制参数只能是某些值？」 → [Level 5](references/level-5-runtime.md)
- 「类型注解有哪些强制规则？」 → [执行准则](references/rules.md)
- 「所有 typing 符号在哪查？」 → [速查表](references/quick-ref.md)
