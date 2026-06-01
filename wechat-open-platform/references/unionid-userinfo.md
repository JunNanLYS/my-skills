# UnionID 机制与获取用户信息

> 本文档覆盖 UnionID 跨应用用户识别机制和获取用户个人信息的完整流程。

## 目录

- [UnionID 机制概述](#unionid-机制概述)
- [完整授权流程（含 UnionID）](#完整授权流程含-unionid)
- [第一步：通过 Code 获取 Access Token](#第一步通过-code-获取-access-token)
- [第二步：刷新 Access Token](#第二步刷新-access-token)
- [第三步：检验 Access Token 有效性](#第三步检验-access-token-有效性)
- [第四步：获取用户个人信息](#第四步获取用户个人信息)
- [关键技术细节](#关键技术细节)
- [调用频率限制](#调用频率限制)

---

## UnionID 机制概述

UnionID 是微信开放平台下的**用户统一标识**。

**核心公式：**

```
微信用户 + AppID = openid（单应用维度）
微信用户 + 开放平台账号 = unionid（跨应用维度）
```

| 维度 | openid | unionid |
|------|--------|---------|
| 作用范围 | 单个应用内 | 整个开放平台账号下 |
| 唯一性 | 同一用户在不同应用中**不同** | 同一用户在同平台下所有应用中**相同** |
| 获取前提 | 接入对应应用即可 | 需将应用绑定到开放平台 |
| 适用场景 | 单应用内用户识别 | 跨应用用户身份打通 |
| 稳定性 | AppID 不变则不变 | 开放平台账号不变则不变 |

**支持绑定的应用类型：**
- 移动应用
- 网站应用
- 小程序
- 小游戏
- 公众号
- 服务号
- 微信小店

---

## 完整授权流程（含 UnionID）

```
用户授权 -> 获取 code
    |
    v
+------------------------------------------+
| 第一步：code 换取 access_token             |
| 返回：access_token, refresh_token,        |
|       openid, unionid（务必保存 unionid）   |
+------------------------------------------+
    |
    v
+------------------------------------------+
| 第二步：需要时用 refresh_token 刷新          |
| 返回：新的 access_token（注意：不返回 unionid）|
+------------------------------------------+
    |
    v
+------------------------------------------+
| 第三步：获取用户个人信息                      |
| 返回：nickname, headimgurl, unionid 等      |
+------------------------------------------+
    |
    v
  使用 unionid 跨应用识别同一用户
```

---

## 第一步：通过 Code 获取 Access Token

**接口地址：**

```
GET https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code
```

**请求参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| appid | 是 | 应用唯一标识 |
| secret | 是 | 应用密钥 AppSecret |
| code | 是 | 第一步获取的 code |
| grant_type | 是 | 固定填 `authorization_code` |

**成功返回：**

```json
{
  "access_token": "ACCESS_TOKEN",
  "expires_in": 7200,
  "refresh_token": "REFRESH_TOKEN",
  "openid": "OPENID",
  "scope": "SCOPE",
  "unionid": "UNIONID"
}
```

| 参数 | 说明 |
|------|------|
| access_token | 接口调用凭证 |
| expires_in | 凭证超时时间（秒），默认 7200（2小时） |
| refresh_token | 刷新 access_token 的凭证 |
| openid | 授权用户唯一标识（单应用维度） |
| scope | 用户授权的作用域，逗号分隔 |
| **unionid** | **用户统一标识（跨应用维度）** |

**错误返回：**

```json
{"errcode": 40029, "errmsg": "invalid code"}
```

---

## 第二步：刷新 Access Token

**技术细节：**
- access_token 有效期 **2小时**
- refresh_token 有效期 **30天**，且**不可续期**
- refresh_token 失效后需用户重新授权

**刷新行为：**
1. access_token **已超时** -> 获取新的 access_token 和新的超时时间
2. access_token **未超时** -> access_token 不变，但超时时间刷新（续期）

**接口地址：**

```
GET https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=APPID&grant_type=refresh_token&refresh_token=REFRESH_TOKEN
```

**成功返回：**

```json
{
  "access_token": "ACCESS_TOKEN",
  "expires_in": 7200,
  "refresh_token": "REFRESH_TOKEN",
  "openid": "OPENID",
  "scope": "SCOPE"
}
```

> **关键提醒：刷新接口返回值中不包含 unionid，请务必在第一步保存 unionid。**

---

## 第三步：检验 Access Token 有效性

**接口地址：**

```
GET https://api.weixin.qq.com/sns/auth?access_token=ACCESS_TOKEN&openid=OPENID
```

**请求参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| access_token | 是 | 调用接口凭证 |
| openid | 是 | 普通用户标识 |

**返回值：**

| 状态 | 返回 |
|------|------|
| 有效 | `{"errcode": 0, "errmsg": "ok"}` |
| 无效 | `{"errcode": 40003, "errmsg": "invalid openid"}` |

---

## 第四步：获取用户个人信息

**接口地址：**

```
GET https://api.weixin.qq.com/sns/userinfo?access_token=ACCESS_TOKEN&openid=OPENID&lang=zh_CN
```

**请求参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| access_token | 是 | 调用凭证 |
| openid | 是 | 普通用户标识，对当前开发者账号唯一 |
| lang | 否 | 语言版本：`zh_CN`（简体）/ `zh_TW`（繁体）/ `en`（英语，默认） |

**成功返回：**

```json
{
  "openid": "OPENID",
  "nickname": "NICKNAME",
  "sex": 1,
  "province": "PROVINCE",
  "city": "CITY",
  "country": "COUNTRY",
  "headimgurl": "https://thirdwx.qlogo.cn/mmopen/g3MonUZtNHkdmzicIlibx6iaFqAc56vxLSUfpb6n5WKSYVY0ChQKkiaJSgQ1dZuTOgvLLrhJbERQQ4eMsv84eavHiaiceqxibJxCfHe/0",
  "privilege": ["PRIVILEGE1", "PRIVILEGE2"],
  "unionid": "o6_bmasdasdsad6_2sgVt7hMZOPfL"
}
```

**返回参数说明：**

| 参数 | 说明 |
|------|------|
| openid | 对当前开发者账号唯一的用户标识 |
| nickname | 用户昵称 |
| sex | 性别：1=男性，2=女性 |
| province | 省份 |
| city | 城市 |
| country | 国家（如 CN） |
| headimgurl | 头像 URL，末尾数值控制大小（0/46/64/96/132），0 代表 640x640 |
| privilege | 用户特权信息，JSON 数组 |
| **unionid** | **跨应用统一标识** |

**错误返回：**

```json
{"errcode": 40003, "errmsg": "invalid openid"}
```

---

## 关键技术细节

### 1. 性别及地区信息已废弃

自 **2021年10月20日 24时** 起，接口**不再返回用户性别及地区信息**（sex、province、city、country 字段实际将为空），这是基于法律法规的合规调整。不应再依赖这些数据。

### 2. 头像 URL 失效问题

用户修改微信头像后，**旧的头像 URL 会失效**。开发者应在获取用户信息后**主动保存头像图片**到自有存储，避免后续异常。

### 3. UnionID 保存建议

文档明确建议：**开发者最好保存用户 unionID 信息，以便以后在不同应用中进行用户信息互通。**

UnionID 只在以下两步返回：
- 第一步（code 换 token）
- 第四步（获取用户信息）

刷新 token 时不会返回 unionid。

### 4. Refresh Token 的不可逆性

refresh_token 有效期 **30天**，且**无法续期**。过期后唯一的方式是让用户重新走授权流程。

---

## 调用频率限制

| 接口 | 频率限制 |
|------|----------|
| 通过 code 换取 access_token | **1万次/分钟** |
| 刷新 access_token | **5万次/分钟** |
| 获取用户基本信息 | **5万次/分钟** |
