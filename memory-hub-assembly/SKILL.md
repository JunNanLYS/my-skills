---
name: memory-hub-assembly
description: Use when 需要给 TencentDB Agent Memory 的 Memory Hub 搭建/维护组织（team/agent/task）、把记忆资产（skill/wiki/code_graph/chat_memory）装配绑定到 agent、设置可见性与 ACL，或审计某个 agent/team 已装了什么。涉及 /v3/meta 接口、agent-fixed-asset、acl。
version: 1.0.0
---

# Memory Hub 装配（TencentDB Agent Memory）

## Overview

Memory Hub 是 TencentDB Agent Memory 的团队记忆控制面。**装配** = 建立组织（team/agent/task）+ 把资产（skill / wiki / code_graph / chat_memory）按角色绑给 agent（`agent-fixed-asset/set`）+ 用可见性/ACL 控制谁能用。装配到位后，proxy 才会把对应资产的清单/记忆注入到该 agent 的对话。

核心原则：**先扫描现状 → 设计装配 → 再执行 → 最后校验**，不要凭猜测批量建。

## 连接与鉴权

```bash
BASE="http://localhost:8420/v3/meta"        # memory-core gateway
KEY="<user_key>"                            # 从面板「API Key」页，或本地 .admin-key
HDR=(-H "x-tdai-user-key: $KEY" -H "x-tdai-service-id: default" -H "content-type: application/json")
```

- 鉴权头：`x-tdai-user-key`（用户 API key）+ `x-tdai-service-id`（记忆实例 ID，本地固定 `default`）。
- **很多 list 接口同时要求 body 里带 `user_key` 或 `user_id`**（zod refine），否则 400/401。
- 本地部署的 admin key 通常在 `deploy/global-images/.admin-key`（脚本目录）；找不到就引导用户从面板拿。

## 快速参考

| 操作 | 端点 | 关键入参 |
|---|---|---|
| 团队增改删查 | `/v3/meta/team/{create,update,delete,list}` | create: `name, owner_user_id` |
| 团队成员 | `/v3/meta/team-member/{add,remove,list}` | `team_id, user_id, role` |
| Agent 增改删档查 | `/v3/meta/agent/{create,update,delete,archive,list}` | create: `team_id, owner_user_id, name, prompt, visibility` |
| Task 增改删查 | `/v3/meta/task/{create,update,delete,list}` | create: `team_id, creator_user_id, title` |
| Task↔Agent 关联 | `/v3/meta/task-agent/{link,unlink,list}` | `task_id, agent_id` |
| 资产注册/查 | `/v3/meta/asset/{create,update,delete,list,list-accessible}` | create: `asset_id, team_id, asset_type, name, owner_user_id, source_type` |
| **绑定资产给 agent** | `/v3/meta/agent-fixed-asset/set` | `agent_id, bindings:[{asset_id, asset_type, injection_mode, priority}]` |
| 已装配清单 | `/v3/meta/agent-fixed-asset/{list,list-with-detail,summary-by-agents}` | `agent_id` / `agent_ids` |
| ACL 授权/撤销/查 | `/v3/meta/acl/{grant,revoke,list,check}` | grant: `asset_id, subject_type, subject_id, permission` |

**枚举**：
- `asset_type`: `skill | llm_wiki | code_graph | chat_memory`
- `visibility`: `private | team | restricted | agent | task`
- `injection_mode`: `direct | summary | tool | reference`
- `permission`: `read | write | delete | assign | share | use`
- `acl_subject_type`: `user | team_role | agent`

## 装配工作流

### 1. 扫描现状（只读，先做）

```bash
# 团队 → 找到目标 team_id
curl -s ${HDR[@]} -X POST $BASE/team/list -d '{"user_key":"'$KEY'"}' | jq '.data.items[] | {team_id,name}'

# 该 team 下的 agent
curl -s ${HDR[@]} -X POST $BASE/agent/list -d '{"team_id":"<team_id>","user_key":"'$KEY'"}' | jq '.data.items[] | {agent_id,name,prompt}'

# 可访问的资产（skill/wiki/code_graph/chat_memory）
curl -s ${HDR[@]} -X POST $BASE/asset/list-accessible -d '{"user_key":"'$KEY'"}' | jq '.data.items[] | {asset_id,asset_type,name,visibility}'

# 每个 agent 已装了什么（审计）
curl -s ${HDR[@]} -X POST $BASE/agent-fixed-asset/summary-by-agents -d '{"agent_ids":["<agent_id>"]}' | jq .
```

### 2. 设计装配（判断，不写）

- 按 agent 的 `prompt`/角色推断该配哪些资产，列出 `{agent_id, asset_id, injection_mode, priority}` 映射表。
- 拿不准就问用户；**不要把无关资产塞给 agent**。

### 3. 执行

```bash
# 建缺失的 agent
curl -s ${HDR[@]} -X POST $BASE/agent/create \
  -d '{"team_id":"<team_id>","owner_user_id":"<user_id>","name":"<name>","prompt":"<system prompt>","visibility":"team"}' | jq .

# 绑定资产（幂等：整体替换该 agent 的绑定集）
curl -s ${HDR[@]} -X POST $BASE/agent-fixed-asset/set \
  -d '{"agent_id":"<agent_id>","bindings":[
        {"asset_id":"<asset_id>","asset_type":"skill","injection_mode":"direct","priority":50}
      ]}' | jq .

# 设 ACL（restricted 可见性时精确授权）
curl -s ${HDR[@]} -X POST $BASE/acl/grant \
  -d '{"asset_id":"<asset_id>","subject_type":"agent","subject_id":"<agent_id>","permission":"read"}' | jq .
```

### 4. 校验

```bash
curl -s ${HDR[@]} -X POST $BASE/agent-fixed-asset/list-with-detail -d '{"agent_id":"<agent_id>"}' | jq .
# 应能看到 bindings 已就位；summary-by-agents 的 counts 与设计一致。
```

## 装配策略（怎么选 injection_mode / visibility）

| injection_mode | 适用 | 说明 |
|---|---|---|
| `direct` | 简短、高价值、需全文进上下文（如少量约束/偏好） | 全文注入，省 token 但占用上下文 |
| `summary` | 中长资产（如 chat_memory） | 注入摘要，细节按需 |
| `tool` | 大型资产（wiki/code_graph/长 skill） | 不注入内容，只暴露调用工具，按需读取 |
| `reference` | 只给索引/引用 | 最省，LLM 需要时再拉 |

- **大资产默认 `tool`**，不要 `direct`——避免占满上下文。
- `priority` 决定同类型注入顺序，数值高者优先。
- `visibility`: 想给团队所有人用 → `team`；只给指定 agent/角色 → `restricted` + ACL；个人私有默认 `private`（装配后 `private` 资产只有 owner 可见，agent 看不到，**绑定前先确认可见性**）。
- chat_memory 资产通常由系统自动生成（`source_type: auto`），装配时直接引 `asset_id` 即可，不必新建。

## 常见错误

| 错误 | 后果 | 修法 |
|---|---|---|
| 漏 `x-tdai-user-key` 或 body 里没 `user_key` | 401 missing_user_key / 400 缺字段 | 头 + body 都带 `user_key` |
| 建了资产但 visibility 是 `private` | 目标 agent 看不到，装配无效 | 改成 `team`/`restricted` + ACL |
| 大资产用 `direct` | 上下文被占满 | 改 `tool`/`summary` |
| 直接在线上批量 set | 误绑/误删绑定集（set 是整体替换） | set 前先 `list-with-detail` 拿现状，diff 后再写 |
| 建 agent 后忘了删测试数据 | 脏数据 | 测试用 agent 用完立即 `agent/delete` |

## 安全注意

- `agent-fixed-asset/set` 是**整体替换**：传空 `bindings:[]` 会清空该 agent 全部绑定。执行前先读现状。
- 写操作（create/delete/grant/set）默认**先给用户看将要执行的 payload 再动手**，批量操作尤其如此。
- 删用户/团队/资产不可恢复，需显式确认。

## 为什么用本技能（触发边界）

在用户表达"给 agent 配记忆/技能/知识""建团队建 agent 并装配资产""看看某 agent 装了什么""调整谁的可见性/权限"时使用。若只是想**查询**已装配内容且不涉及写入，直接用上面只读配方即可；若用户要**长期自动化**（反复装配），考虑配合 MCP 把写操作封装成工具（见 MemoryKnowledge/src/mcp/server.ts 模板）。
