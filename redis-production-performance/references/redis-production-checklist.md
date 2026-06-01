# Redis Production Checklist

## 快速问题

- Redis 是缓存、状态存储、消息通道、队列，还是多种角色混用？
- 允许丢多少数据：0 秒、1 秒、分钟级，还是完全可重建？
- 峰值 QPS、P99 延迟、最大 value、最大集合基数、总 key 数、内存预算是多少？
- 是否需要跨 key 原子性？这些 key 是否能设计到同一 hash slot？
- 客户端是否支持 Sentinel/Cluster、pipeline、TLS、ACL、超时和拓扑刷新？

## 配置基线

```conf
maxmemory <bytes>
maxmemory-policy allkeys-lfu
timeout 0
tcp-keepalive 300
slowlog-log-slower-than 10000
slowlog-max-len 256
lazyfree-lazy-user-del yes
lazyfree-lazy-expire yes
appendonly yes
appendfsync everysec
aof-use-rdb-preamble yes
```

按业务调整：

- 纯缓存：可关闭 AOF，保留 RDB 或完全依赖回源能力。
- 低丢失窗口：开启 AOF `everysec`，配合 RDB 和备份恢复演练。
- 写入必须可审计：不要只依赖 Redis，使用数据库或可靠消息系统作为事实来源。
- 写入不能被淘汰：使用 `noeviction`，并处理写命令失败。

## TTL 设计

```text
SET cache:user:{id} <json> EX <ttl-with-jitter>
SET lock:job:{id} <uuid> NX PX <lease-ms>
```

检查点：

- 所有缓存 key 是否有 TTL？
- TTL 是否加随机抖动？
- 更新 key 是否会清除原 TTL？
- 是否存在集合内部元素需要单独过期？
- 是否有后台任务扫描无 TTL key、超大 key 和异常增长前缀？

无破坏性抽样：

```redis
SCAN 0 MATCH cache:* COUNT 1000
TTL cache:user:123
MEMORY USAGE cache:user:123
OBJECT ENCODING cache:user:123
```

## 原子性模板

计数：

```redis
INCRBY quota:{userId}:2026-05-24 1
EXPIRE quota:{userId}:2026-05-24 172800
```

如果 `INCRBY` 与 `EXPIRE` 必须同时满足，用 Lua 包起来，或者首次创建时设置 TTL：

```lua
local v = redis.call('INCRBY', KEYS[1], ARGV[1])
if v == tonumber(ARGV[1]) then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return v
```

安全解锁：

```lua
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
```

Cluster 多 key：

```text
{order:123}:state
{order:123}:events
{order:123}:lock
```

## Pub/Sub 判断

适合：

- 本地缓存失效通知。
- 在线状态提示。
- 配置刷新。
- 可丢失、可重试、无需审计的实时提示。

不适合：

- 订单、支付、库存等可靠业务事件。
- 需要消费者确认、重放、追踪积压的任务。
- 慢消费者或离线消费者必须收到消息的场景。

替代：

- Redis Stream：需要消费组、ACK、重放且规模适中。
- Kafka/RabbitMQ/Pulsar：需要持久化事件流、跨系统可靠投递和大规模消费者。

## 内存与性能排查

常用观测：

```redis
INFO memory
INFO stats
INFO clients
INFO commandstats
SLOWLOG GET 20
LATENCY LATEST
CLIENT LIST
```

风险指标：

- `used_memory` 接近 `maxmemory`。
- `evicted_keys` 持续增长。
- `blocked_clients` 大于 0。
- `mem_fragmentation_ratio` 长期过高或过低。
- `instantaneous_ops_per_sec` 突降同时 P99 升高。
- `rejected_connections`、`total_error_replies` 增长。

大 key 处理：

- 先定位：`redis-cli --bigkeys`、`MEMORY USAGE`、按前缀采样。
- 读路径分页：`HSCAN`、`SSCAN`、`ZSCAN`，避免一次返回全量。
- 删除使用 `UNLINK`，或按成员分批删。

热 key 处理：

- 本地缓存短 TTL。
- 请求合并和互斥重建。
- key 分片，例如 `counter:{id}:0..N`。
- 读副本或专门只读集群。
- 限流和降级。

## Cluster/Sentinel 检查

Sentinel：

- 至少 3 个 Sentinel，避免单点仲裁。
- 客户端必须连接 Sentinel 发现主库，不要写死旧 master。
- 明确故障转移期间写入失败、重复执行和幂等策略。

Cluster：

- 客户端必须支持 `MOVED`、`ASK` 和拓扑刷新。
- 多 key 命令、Lua、事务必须同 slot。
- 迁移期间监控 slot 状态、重定向、复制延迟和热点分片。
- 不要在业务高峰做 reshard、AOF rewrite、全量备份或大 key 清理。

## 连接池建议

- Web 服务使用进程级连接池，不要请求级创建连接。
- 设置 connect timeout、read timeout、command timeout、最大重试和指数退避。
- 池大小从小开始压测，观察 Redis CPU、客户端排队时间和 P99。
- pipeline 单批控制在可观测、可回滚范围；大 value 或大响应要减小批量。
- 连接泄漏时检查 `CLIENT LIST` 的 `cmd`、`age`、`idle`、`obl`、`omem`。

## 评审清单

- [ ] key 命名含业务边界、环境、实体和版本，避免冲突。
- [ ] 缓存 key 有 TTL，TTL 有抖动，永久 key 有白名单。
- [ ] 内存预算、`maxmemory` 和淘汰策略已配置。
- [ ] 大 key、热 key、集合基数和 value 尺寸有上限。
- [ ] 原子性不是依赖客户端多命令拼接。
- [ ] 锁有唯一 value、TTL、续租/超时处理和 Lua 解锁。
- [ ] Pub/Sub 不承担可靠投递。
- [ ] 持久化配置与可丢失窗口匹配，恢复演练已覆盖。
- [ ] Cluster 跨 slot 限制已处理。
- [ ] 连接池、超时、重试、pipeline 和熔断策略已定义。
- [ ] 监控覆盖慢查询、延迟、内存、淘汰、连接、复制和错误。
