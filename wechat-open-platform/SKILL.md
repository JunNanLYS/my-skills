---

name: wechat-open-platform
description: 微信开放平台开发技能，覆盖网站应用接入完整技术栈：微信扫码登录（OAuth2.0）、UnionID跨应用识别、消息推送加解密、PC OpenSDK等。触发词：微信登录、微信扫码、微信OAuth、UnionID、openid、access_token、refresh_token、snsapi_login、wxLogin、小程序拉起、微信消息推送、微信消息加解密、EncodingAESKey、微信应用审核、微信网站应用、wechat open platform、微信开发者平台、微信登录接入、微信快捷登录
---

# 微信开放平台开发技能

> 渐进式披露 -- 按需读取详细文档，避免一次性加载过多信息。

## 第一层：核心认知（必读）

### 平台概览

| 项目 | 内容 |
|------|------|
| 平台地址 | https://open.weixin.qq.com |
| 管理平台 | https://developers.weixin.qq.com/platform |
| 核心能力 | 跨应用用户身份关联（UnionID 机制） |

**微信开放平台 vs 微信开发者平台：**
- **开放平台**（open.weixin.qq.com）：提供 UnionID 机制，实现跨应用用户身份关联
- **开发者平台**（developers.weixin.qq.com/platform）：统一管理与开发平台，管理移动应用、网站应用、小程序、公众号等

### 你需要知道的五件事

1. **OAuth2.0 流程**：请求 code -> 换取 access_token -> 调用接口获取用户信息
2. **UnionID 机制**：同一开放平台账号下所有应用的同一用户拥有唯一 UnionID，用于跨应用识别
3. **openid vs unionid**：openid 是单应用维度唯一标识，unionid 是开放平台维度唯一标识
4. **安全红线**：AppSecret、access_token、refresh_token **严禁存储在客户端**
5. **凭证有效期**：access_token 2小时 / refresh_token 30天 / code 10分钟且一次性

### 接口速查

| 功能 | 方法 | 端点 |
|------|------|------|
| 请求 CODE（跳转） | `GET` | `https://open.weixin.qq.com/connect/qrconnect` |
| 通过 code 换取 access_token | `GET` | `https://api.weixin.qq.com/sns/oauth2/access_token` |
| 刷新 access_token | `GET` | `https://api.weixin.qq.com/sns/oauth2/refresh_token` |
| 检查 access_token 有效性 | `GET` | `https://api.weixin.qq.com/sns/auth` |
| 获取用户个人信息 | `GET` | `https://api.weixin.qq.com/sns/userinfo` |
| 获取 PC OpenSDK ticket | `POST` | `https://api.weixin.qq.com/cgi-bin/pcopensdk/ticket` |

### 关键参数

| 参数 | 说明 |
|------|------|
| `appid` | 应用唯一标识 |
| `redirect_uri` | 授权回调地址，需 urlEncode，域名须与审核一致 |
| `scope` | 网站应用固定填 `snsapi_login` |
| `state` | 防 CSRF 参数，建议随机数+session |
| `code` | 临时票据，10分钟有效，一次性 |
| `access_token` | 接口调用凭证，2小时有效 |
| `refresh_token` | 刷新凭证，30天有效 |
| `unionid` | 跨应用用户统一标识 |

### 错误码速查

| 错误码 | 含义 | 处理 |
|--------|------|------|
| 40029 | invalid code | code 无效/过期/已使用，引导用户重新授权 |
| 40030 | invalid refresh_token | refresh_token 失效，引导用户重新授权 |
| 40003 | invalid openid | openid 错误 |

### 接口频率限制

| 接口 | 限制 |
|------|------|
| code 换取 access_token | 1万次/分钟 |
| 刷新 access_token | 5万次/分钟 |
| 获取用户信息 | 5万次/分钟 |
| PC OpenSDK 所有接口 | 每用户每秒1次/每分钟5次 |

---

## 第二层：按需深入（读取对应 references 文件）

根据用户的具体需求，读取相应的参考文档：

| 用户需求 | 读取文件 |
|----------|----------|
| 接入微信扫码登录、OAuth2.0 流程、内嵌二维码 | `references/auth-login.md` |
| UnionID 跨应用用户识别、获取用户信息 | `references/unionid-userinfo.md` |
| 配置消息推送服务器、加解密机制 | `references/message-push.md` |
| 处理授权变更事件（撤回/注销/信息修改） | `references/authorization-events.md` |
| PC OpenSDK（拉起/分享小程序、微信分享） | `references/pc-api.md` |
| 应用审核规范、官网要求、类目配置 | `references/operations.md` |

**重要**：不要提前读取这些文件，仅在用户提出相关需求时才加载。

---

## 第三层：完整工作流与生产实践（按需读取）

当用户需要：
- 完整的微信登录 Python/FastAPI 后端实现代码
- Token 刷新策略与登录态管理方案
- 消息推送服务器的完整加解密实现
- 生产环境安全最佳实践

读取 `references/production-patterns.md`。

---

## 快速命令模板

### 跳转微信扫码登录页

```
https://open.weixin.qq.com/connect/qrconnect
  ?appid=YOUR_APPID
  &redirect_uri=URL_ENCODED_REDIRECT_URI
  &response_type=code
  &scope=snsapi_login
  &state=RANDOM_STATE
  #wechat_redirect
```

### 通过 code 换取 access_token

```bash
curl -X GET "https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code"
```

成功返回：`access_token`、`expires_in`(7200)、`refresh_token`、`openid`、`scope`、`unionid`（需 userinfo 授权）。

### 获取用户信息

```bash
curl -X GET "https://api.weixin.qq.com/sns/userinfo?access_token=TOKEN&openid=OPENID&lang=zh_CN"
```

返回：`openid`、`nickname`、`headimgurl`、`unionid` 等。注意：性别和地区字段自 2021.10.20 起不再返回。

### 刷新 access_token

```bash
curl -X GET "https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=APPID&grant_type=refresh_token&refresh_token=REFRESH_TOKEN"
```

注意：刷新接口**不返回 unionid**，务必在首次获取时保存。
