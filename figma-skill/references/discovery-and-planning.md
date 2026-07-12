# Read-Only Discovery and Planning

## Bounded Discovery

任何写入前，必须通过 `figma-cli` 只读获取当前任务需要的最小上下文：

- 当前打开文件和目标文件；
- 目标 page、Section、Frame 与直接层级；
- 相关 variables、styles、components、Component Sets、variants、instances 和 reuse handles；
- 当前尺寸、布局行为和绑定；
- 目标区域基线截图。

搜索必须限定 page、parent 或 name。局部查询足够时禁止扫描整份大型文件。此阶段禁止 Figma 写入。

## Task-Local Context

单次任务可以保留 file key、page、目标 Frame、已确认的 NodeId/name/type、reuse handles、相关 collections/tokens、查询次数、近似耗时和失效状态。

禁止创建跨任务持久缓存。duplicate、reparent、unwrap、组件化、组合 variants、删除重建或大幅层级变化后必须失效并重新读取。任务上下文禁止替代写入前实时读取。

## Reuse Decision

使用第一条适用路径：

1. 已有组件或 reuse handle：先 `spec`，再 `instantiate`。
2. 跨页、多状态或需要统一演进：Component 或 Component Set。
3. 同页结构相同、内容不同：先完成一份，`duplicate`，重新读取 NodeId，再逐份修改。
4. 多个完全相同且独立的节点：`render-batch`。
5. 确认没有可复用结构后才允许新建。

用户要求 N 个同类对象时必须得到 N 个独立节点。禁止把 wrapper 升级成一个组件冒充多个对象。

## Figma Write Plan

第二次审批前必须展示：

- 目标文件、页面、Frame 和明确边界；
- 将复用、实例化、duplicate、修改或创建的结构；
- 将修改的组件和 variables；
- 布局与响应式行为；
- 文档冲突和修正边界；
- 基线记录与批次顺序；
- 每个 `eval/run` 降级的原生命令缺失证据、代码范围和目标 NodeId；
- 验证对象与验收标准。

必须等待明确 Figma 写入批准。设计系统审批禁止满足此门禁。

结构、设计系统、任务边界、共享组件或降级方法变化时，原批准失效。批准方案内的文案、尺寸和低风险细节可以继续。
