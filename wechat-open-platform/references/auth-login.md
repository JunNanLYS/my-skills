# 微信扫码登录（OAuth2.0）完整流程

> 本文档覆盖微信网站应用扫码登录的全部技术细节。

## 目录

- [前置条件](#前置条件)
- [完整授权流程](#完整授权流程)
- [第一步：请求 CODE](#第一步请求-code)
  - [方式一：跳转到微信授权页面](#方式一跳转到微信授权页面)
  - [方式二：页面内嵌二维码（JS 方式）](#方式二页面内嵌二维码js-方式)
- [第二步：通过 CODE 获取 ACCESS_TOKEN](#第二步通过-code-获取-access_token)
  - [2.1 获取 access_token](#21-获取-access_token)
  - [2.2 刷新 access_token](#22-刷新-access_token)
- [第三步：通过 ACCESS_TOKEN 调用接口](#第三步通过-access_token-调用接口)
- [错误码](#错误码)
- [安全注意事项](#安全注意事项)

---

## 前置条件

1. 在微信开放平台注册开发者账号
2. 创建网站应用并**审核通过**
3. 获得 **AppID** 和 **AppSecret**
4. 申请微信登录功能且**通过审核**

## 完整授权流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   第三方网站  │     │   微信服务器  │     │   微信用户   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │ 1.跳转授权页请求CODE                   │
       │───────────────────>│                   │
       │                    │ 2.展示二维码/快捷登录│
       │                    │<──────────────────│
       │                    │ 3.用户扫码确认授权  │
       │                    │<──────────────────│
       │ 4.重定向回redirect_uri(带code)          │
       │<───────────────────│                   │
       │ 5.用code换取access_token               │
       │───────────────────>│                   │
       │ 6.返回access_token等                   │
       │<───────────────────│                   │
       │ 7.用access_token获取用户信息            │
       │───────────────────>│                   │
       │ 8.返回用户信息      │                   │
       │<───────────────────│                   │
```

---

## 第一步：请求 CODE

### 方式一：跳转到微信授权页面

**请求URL：**

```
https://open.weixin.qq.com/connect/qrconnect?appid=APPID&redirect_uri=REDIRECT_URI&response_type=code&scope=SCOPE&state=STATE#wechat_redirect
```

**请求参数：**

| 参数 | 是否必须 | 说明 |
|------|----------|------|
| `appid` | 是 | 应用唯一标识 |
| `redirect_uri` | 是 | 重定向地址，需使用 **urlEncode** 处理；域名必须与审核时填写的授权域名一致 |
| `response_type` | 是 | 固定填 `code` |
| `scope` | 是 | 固定填 `snsapi_login` |
| `state` | 否 | 防止 CSRF 攻击，授权后原样返回；建议设置随机数+session |
| `lang` | 否 | 界面语言：`cn`（中文简体，默认）/ `en`（英文） |

**返回说明：**
- 用户**允许授权** -> 重定向到 `redirect_uri?code=CODE&state=STATE`
- 用户**禁止授权** -> **不发生重定向**

### 方式二：页面内嵌二维码（JS 方式）

**步骤1：引入JS文件**

```html
<script src="http://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js"></script>
```

**步骤2：实例化 WxLogin 对象**

```javascript
var obj = new WxLogin({
    self_redirect: true,
    id: "login_container",
    appid: "YOUR_APPID",
    scope: "snsapi_login",
    redirect_uri: "URL_ENCODED_REDIRECT_URI",
    state: "RANDOM_STATE",
    style: "black",
    href: "",
    stylelite: "",
    fast_login: "",
    color_scheme: "auto",
    onReady: function(isReady) {
        console.log(isReady);
    },
    onQRcodeReady: function() {}
});
```

**完整参数说明：**

| 参数 | 是否必须 | 说明 |
|------|----------|------|
| `self_redirect` | 否 | `true`：iframe 内跳转；`false`：top window 跳转（默认） |
| `id` | 是 | 页面显示二维码的容器元素 ID |
| `appid` | 是 | 应用唯一标识 |
| `scope` | 是 | 固定填 `snsapi_login` |
| `redirect_uri` | 是 | 重定向地址，需 UrlEncode |
| `state` | 否 | 防 CSRF 参数，原样返回 |
| `style` | 否 | `"black"`（默认，浅色背景）或 `"white"`（深色背景） |
| `href` | 否 | 自定义 CSS 样式链接，覆盖默认样式（`stylelite=1` 时失效） |
| `stylelite` | 否 | 值为 `1` 切换新UI样式，建议预留 **220px x 220px** |
| `fast_login` | 否 | 值为 `0` 禁用快速登录功能 |
| `color_scheme` | 否 | `"light"` / `"dark"` / `"auto"`（跟随系统） |
| `onReady` | 否 | iframe 加载完成回调，`isReady=true` 表示成功 |
| `onQRcodeReady` | 否 | 二维码加载完成回调 |

**Chrome 142+ 注意**：如使用自行嵌入的 iframe（非 wxLogin.js 引入），需添加 `allow="local-network-access"` 属性。

**自定义样式示例（缩小二维码并隐藏标题）：**

```css
.impowerBox .qrcode {width: 200px;}
.impowerBox .title {display: none;}
.impowerBox .info {width: 200px;}
.status_icon {display: none;}
.impowerBox .status {text-align: center;}
```

将 CSS 文件链接填入 `href` 参数即可覆盖默认样式（`stylelite=1` 时失效）。

### 快速登录功能

| 项目 | 说明 |
|------|------|
| 支持版本 | 微信 **3.9.11** for Windows+ / 微信 **4.0.0** for Mac+ |
| 触发条件 | 用户已在设备上登录微信客户端，且处于非锁定状态 |
| 行为 | 优先提示快速登录，无需扫码，直接在设备上确认 |
| 用户选择 | 仍可切换其他微信账号或使用二维码登录 |
| 禁用方式 | 内嵌二维码 JS 中设置 `fast_login: 0` |

---

## 第二步：通过 CODE 获取 ACCESS_TOKEN

### 2.1 获取 access_token

**请求URL：**

```
GET https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code
```

**请求参数：**

| 参数 | 是否必须 | 说明 |
|------|----------|------|
| `appid` | 是 | 应用唯一标识 |
| `secret` | 是 | 应用密钥 AppSecret |
| `code` | 是 | 第一步获取的 code |
| `grant_type` | 是 | 固定填 `authorization_code` |

**成功返回：**

```json
{
    "access_token": "ACCESS_TOKEN",
    "expires_in": 7200,
    "refresh_token": "REFRESH_TOKEN",
    "openid": "OPENID",
    "scope": "SCOPE",
    "unionid": "o6_bmasdasdsad6_2sgVt7hMZOPfL"
}
```

| 字段 | 说明 |
|------|------|
| `access_token` | 接口调用凭证 |
| `expires_in` | 超时时间，单位秒（当前 7200秒 = 2小时） |
| `refresh_token` | 刷新 access_token 的凭证 |
| `openid` | 授权用户唯一标识 |
| `scope` | 用户授权的作用域，逗号分隔 |
| `unionid` | **仅当**应用已获得 userinfo 授权时才出现 |

**错误返回：**

```json
{"errcode": 40029, "errmsg": "invalid code"}
```

### 2.2 刷新 access_token

**刷新规则：**
- access_token **已超时** -> 返回新的 access_token + 新的超时时间
- access_token **未超时** -> access_token 不变，但超时时间刷新（续期）
- refresh_token 有效期 **30天**，失效后需用户重新授权

**请求URL：**

```
GET https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=APPID&grant_type=refresh_token&refresh_token=REFRESH_TOKEN
```

**请求参数：**

| 参数 | 是否必须 | 说明 |
|------|----------|------|
| `appid` | 是 | 应用唯一标识 |
| `grant_type` | 是 | 固定填 `refresh_token` |
| `refresh_token` | 是 | 之前获取到的 refresh_token |

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

> **注意：刷新接口不返回 unionid，务必在第一步保存。**

**错误返回：**

```json
{"errcode": 40030, "errmsg": "invalid refresh_token"}
```

---

## 第三步：通过 ACCESS_TOKEN 调用接口

**调用前提：**
1. access_token 有效且未超时
2. 用户已授权给应用相应接口作用域（scope）

**可用接口列表：**

| 授权作用域 | 接口路径 | 说明 |
|-----------|---------|------|
| `snsapi_base` | `/sns/oauth2/access_token` | 通过 code 换取 access_token、refresh_token 和已授权 scope |
| `snsapi_base` | `/sns/oauth2/refresh_token` | 刷新或续期 access_token |
| `snsapi_base` | `/sns/auth` | 检查 access_token 是否有效 |
| `snsapi_userinfo` | `/sns/userinfo` | 获取用户个人信息 |

> `snsapi_base` 属于基础接口，若应用已拥有其它 scope 权限则默认拥有。仅使用 `snsapi_base` 无法获取需要用户额外授权的数据。

---

## 错误码

| 错误码 | 错误信息 | 含义 |
|-------|---------|------|
| `40029` | `invalid code` | code 无效（已过期/已使用/错误） |
| `40030` | `invalid refresh_token` | refresh_token 无效（已过期/错误） |
| `40003` | `invalid openid` | openid 错误 |

---

## 安全注意事项

1. **AppSecret** -- 泄漏将导致应用数据和用户数据泄漏，**切勿存储在客户端**
2. **access_token** -- 相当于用户登录态，**切勿存储在客户端**
3. **refresh_token** -- 长效凭证，泄漏风险等同 access_token
4. **建议**：将 secret、access_token 放在**云端服务器**，由服务端中转接口调用
5. **建议**：自行管理业务登录态并合理设置过期时间，减少用户重新授权次数
6. **CODE 票据**：有效期 10 分钟，仅能使用一次

## CODE 特性

| 属性 | 值 |
|------|-----|
| 有效期 | **10 分钟** |
| 使用次数 | **仅能成功换取一次** access_token，之后即失效 |
| 安全保障 | 临时性 + 一次性；配合 HTTPS 和 state 参数加强安全性 |
