---
name: redis-production-performance
description: Redis 生产环境高性能设计、审查与故障排查技能。用于处理 Redis 缓存、分布式锁、计数器、限流、队列、会话、排行榜、发布订阅、Stream、持久化、内存淘汰、集群、连接池、Lua 脚本、事务、过期时间、热 key、大 key、缓存击穿/穿透/雪崩、原子性与一致性、性能优化和常见错误。触发词：Redis、缓存、TTL、EXPIRE、Lua、WATCH、MULTI、Pub/Sub、Stream、AOF、RDB、maxmemory、eviction、Cluster、Sentinel、pipeline、连接池、热 key、大 key、缓存泄漏
---

# Redis Production Performance

## 目标

使用该技能设计、审查或排障 Redis 方案时，优先保证：可预测的内存上限、明确的过期策略、原子性边界清晰、持久化与延迟折中可解释、连接数受控、集群扩展可演进、失败模式可恢复。

需要详细配置片段、排查命令或检查表时，读取 `references/redis-production-checklist.md`。

## 工作流程

1. 先确认 Redis 的角色：纯缓存、半持久状态、强依赖状态、消息通道、分布式协调、排行榜/计数器或多用途共享实例。
2. 明确数据模型：key 命名、value 类型、单 key 最大尺寸、集合基数、TTL、写入频率、读取热点、跨 key 关系。
3. 先设内存和过期边界，再谈性能：`maxmemory`、淘汰策略、TTL 覆盖率、大 key/热 key、碎片率、持久化峰值内存。
4. 审查原子性：单命令、Lua、事务、WATCH、锁、幂等、失败重试和跨 slot/跨实例操作。
5. 审查连接与吞吐：连接池、pipeline、批量命令、慢查询、阻塞命令、客户端超时、重连风暴。
6. 审查高可用：Sentinel 或 Cluster、复制延迟、故障转移、slot 迁移、读写路由和降级策略。
7. 输出结论时同时给出推荐配置、危险点、验证命令、压测指标和回滚方案。

## 1. 过期时间与内存泄漏

- 默认把 Redis 当作有限内存系统；除确实需要永久保存的元数据外，缓存 key 必须有 TTL。
- 写入缓存时使用原子 TTL 写法：`SET key value EX seconds` 或 `SET key value PX ms`，避免 `SET` 后 `EXPIRE` 失败造成永久 key。
- 对 Hash、Set、ZSet、List 的 TTL 只能作用于整个 key；如果需要字段级过期，改用独立 key、ZSet 时间索引、定时清理或 Redis 7.4+ 的字段过期能力（使用前确认运行版本）。
- TTL 加随机抖动，避免大量 key 同时过期引发缓存雪崩：例如基础 TTL 加 0-20% 随机值。
- 避免每次更新都无意清除 TTL：`SET` 默认会移除原 TTL，必要时使用 `KEEPTTL` 或重新设置过期时间。
- 周期性检查无 TTL key：`SCAN` + `TTL`，不要在生产库直接跑 `KEYS *`。

## 2. 原子性陷阱

- Redis 单条命令是原子的，多条命令组合不是原子的；读-改-写必须用单命令、Lua、事务加 WATCH 或服务端结构重建。
- 避免 `GET` 后在客户端计算再 `SET`；计数用 `INCRBY`，集合变更用原生集合命令，条件写用 `SET NX/XX`。
- 分布式锁必须使用 `SET lock value NX PX ttl`，解锁用 Lua 校验 value 后删除；不要直接 `DEL lock`。
- Lua 脚本要短、小、确定性强；避免长循环、网络调用、随机不确定逻辑和大结果返回，否则会阻塞 Redis 主线程。
- `MULTI/EXEC` 不会自动回滚已入队命令的业务语义错误；把事务理解为顺序原子执行，不要当作关系型数据库事务。
- Cluster 中 Lua、事务和多 key 原子操作必须落在同一 hash slot；需要 hash tag 时使用 `{user:123}:profile`、`{user:123}:quota`。

## 3. 发布/订阅限制

- Pub/Sub 是即时广播，不持久化、不确认、不重放；订阅者断线期间消息会丢失。
- Pub/Sub 不适合作为可靠任务队列、订单事件总线或需要审计的业务消息系统；这些场景优先使用 Redis Stream、Kafka、RabbitMQ 等。
- Pub/Sub 在高扇出、大消息或慢消费者场景下容易放大网络与客户端缓冲压力；要限制消息大小和频道数量。
- Cluster Pub/Sub 的传播和订阅语义需要按 Redis 版本与客户端能力确认；跨节点广播不要假设和单实例完全一致。
- 只把 Pub/Sub 用于可丢失通知：配置刷新、在线状态提示、本地缓存失效通知、轻量实时事件。

## 4. 持久性配置

- 先确定数据可丢失窗口：纯缓存可弱化持久化，业务状态必须配置 AOF/RDB、备份和恢复演练。
- RDB 适合快照和冷备，但两次快照之间的数据可能丢失；AOF 适合更小丢失窗口，但增加写放大和 fsync 延迟。
- 常见生产折中：开启 AOF，`appendfsync everysec`，保留 RDB 快照用于快速恢复；强一致需求不能只靠 Redis 持久化承诺。
- 关注 fork 带来的 Copy-on-Write 内存峰值；大实例执行 RDB/AOF rewrite 时需要预留内存。
- 开启 `aof-use-rdb-preamble yes` 可改善 AOF 重写后的加载速度。
- 验证恢复路径：定期从备份启动新实例，检查加载耗时、数据完整性、版本兼容和容量水位。

## 5. 内存管理

- 必须配置 `maxmemory`，并选择符合业务语义的淘汰策略：缓存常用 `allkeys-lru`/`allkeys-lfu`，有 TTL 缓存可用 `volatile-ttl`，禁止淘汰则用 `noeviction` 并让写入显式失败。
- 大 key 是性能和迁移风险：单个 String、Hash、Set、ZSet、List 的尺寸都要设上限，拆分或分页存储。
- 热 key 会压垮单线程或单分片：本地缓存、请求合并、key 分片、读副本、提前计算和限流要组合使用。
- 避免高复杂度命令在生产热路径执行：`KEYS`、大范围 `ZRANGE`、大集合 `SMEMBERS`、无界 `LRANGE`、大批量 `DEL`。
- 删除大 key 使用 `UNLINK` 或分批清理，减少主线程阻塞。
- 定期观察 `used_memory`、`used_memory_rss`、`mem_fragmentation_ratio`、`evicted_keys`、`expired_keys`、`allocator_frag_ratio`。

## 6. 聚类与高可用

- Sentinel 解决主从故障转移，不解决水平分片；Redis Cluster 解决分片和高可用，但引入 slot、跨 slot 限制和客户端路由复杂度。
- Cluster 设计 key 时先考虑 hash slot，跨 key 操作要么同 slot，要么拆成最终一致流程。
- 不要把强一致跨实体事务压进 Cluster；需要事务数据库、消息事务或业务补偿。
- 读副本可降低读压力，但要处理复制延迟；用户读己之写、库存、额度等场景默认读主库或用版本校验。
- 扩缩容和 reshard 期间关注 `MOVED`、`ASK`、客户端拓扑刷新、热点 slot 和迁移流量。
- 单分片仍是单线程瓶颈；集群提升总吞吐，不会让单个热 key 自动变快。

## 7. 常见模式

- Cache-Aside：应用先读缓存，未命中读数据库再回填；更新时先写数据库，再删除缓存，必要时延迟双删或版本戳防旧值回填。
- Write-Through/Write-Behind：只在能接受复杂度、丢失窗口和重放机制时使用；必须设计幂等和失败补偿。
- 缓存穿透：缓存空值、布隆过滤器、参数校验和限流。
- 缓存击穿：互斥重建、singleflight、逻辑过期、后台刷新。
- 缓存雪崩：TTL 抖动、多级缓存、限流降级、预热。
- 分布式限流：固定窗口用 `INCR + EXPIRE` 原子化，滑动窗口用 ZSet + Lua，令牌桶/漏桶要明确时间源。
- 排行榜：ZSet 适合 top-N 和排名，但要限制成员数、分片大榜、定期裁剪。
- 队列：简单低可靠可用 List；需要消费组、确认、重放时用 Stream；高可靠跨系统消息优先专用 MQ。

## 8. 连接管理

- 使用长连接和连接池，避免每次请求新建 TCP 连接。
- 设置合理的客户端超时、命令超时、重试次数、退避和熔断；避免故障时无限重试打爆 Redis。
- 连接池大小按并发、pipeline 和 Redis CPU 评估；过大的池会制造上下文切换、缓冲内存和故障放大。
- 使用 pipeline 批量减少 RTT，但要控制单批大小和响应体大小；不要把 pipeline 当作原子事务。
- 明确客户端对 Cluster、Sentinel、TLS、ACL、RESP3、重定向、读写分离的支持程度。
- 监控 `connected_clients`、`blocked_clients`、`client_recent_max_input_buffer`、`client_recent_max_output_buffer` 和客户端侧排队时间。

## 9. 常见错误

- 忘记 TTL 或 `SET` 覆盖 TTL，导致缓存变永久数据。
- 在生产执行 `KEYS`、`FLUSHALL`、大范围 `SCAN` 无节流、`SMEMBERS` 大集合、`DEL` 大 key。
- 把 Pub/Sub 当可靠队列。
- 用非原子 `GET` + `SET` 实现计数、扣减库存、限流或锁。
- 锁没有唯一 value、TTL 过短或业务超时后误删他人锁。
- 缓存更新顺序错误，造成旧值回填或长期脏读。
- 没有设置 `maxmemory` 或淘汰策略与业务语义冲突。
- 大 key、热 key 没有限制，迁移、备份、删除和查询都会抖动。
- 把 Redis Cluster 当作自动解决所有性能问题的开关，却没有处理跨 slot 和热点。
- 客户端连接池无上限、超时过长、重试无退避，故障时形成连接风暴。

## 输出格式

面向设计或评审任务时，输出：

1. 推荐架构与 Redis 角色边界。
2. Key 模型、TTL 策略、内存预算和淘汰策略。
3. 原子性方案与失败重试语义。
4. 持久化、高可用和集群方案。
5. 连接池、pipeline、超时和监控指标。
6. 风险清单、验证命令和压测/回滚建议。

面向排障任务时，先给出最可能的 3-5 个原因，再给出无破坏性的观测命令；涉及清理、重启、flush、迁移或配置变更时，先提醒风险并要求确认。
