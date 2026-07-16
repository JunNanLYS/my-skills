# Naming Authority

Single source of truth for component, screen, specimen, flow, and variant naming. The figma-skill runtime references this file from `SKILL.md` Mandatory Lookups for Pre-Spec Context Gate, Spec Canvas, and PlanWeave implementation planning.

PlanWeave blocks may cite naming decisions, but canonical naming grammar remains in this file.

## Component Path

```text
<Category>/<Domain>/<Component>[/<Part>...]
```

完整路径在同一个 Figma 文件中必须唯一。路径只表达稳定身份；禁止使用颜色、尺寸、状态或版本修饰。

固定基础分类：

```text
Foundation
Primitive
Action
Input
Navigation
DataDisplay
Feedback
Overlay
Layout
Content
Internal
Deprecated
```

项目可在 `docs/FIGMA_DESIGN_SYSTEM.md` 增加业务域分类，但必须说明用途并禁止使用 `Common` / `General` / `Misc` / `Other` 等兜底目录。

## Screen Path

```text
Screen/<Platform>/<Domain>/<Flow>/<View>
  /State=<State>
  /Viewport=<Viewport>
  /Role=<Role>
```

State、Viewport、Role 之间必须相互独立，禁止把多个维度合并到同一个值。

## Specimen Path

唯一强制性 Specimen 是 `Specimen/StateGallery`，用于展示状态全集；其它变体（如 `Specimen/VariantMatrix`、`Specimen/Properties`、`Specimen/Usage`）可以作为项目的可选扩展而非默认要求，禁止写为必填。

## Flow Path

```text
Flow/<Domain>/<Flow>
```

## Collision Resolution

```text
能否在相同位置、以相同职责直接互换？
├── 是 → 同一 Component Set，以独立 Variant Property 区分
└── 否 → 独立组件，以完整语义路径区分
```

## Variant Axes

```text
Variant
Platform
Size
State
Validation
Selection
Orientation
Density
Expanded
Loading
```

标准 State 值：

```text
State=Default
State=Hover
State=Pressed
State=Focused
State=Disabled
```

属性名和值统一英文 PascalCase。布尔属性统一使用 `True` / `False`。

禁止：

```text
State=PrimaryMediumHoverLoading
State=MacOSDarkInactive
Validation=SelectedErrorDisabled
```

## Instance Naming

主组件保持规范完整路径；实例按在页面内的角色命名（例如 `PrimaryNavigation`）。禁止从实例名称猜测主组件来源，CLI 必须按主组件完整路径查找。