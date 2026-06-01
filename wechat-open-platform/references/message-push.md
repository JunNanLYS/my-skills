# 消息推送服务器配置与加解密机制

> 本文档覆盖微信开放平台消息推送的服务器配置、验证机制、消息加解密的完整技术细节。

## 目录

- [消息推送机制概述](#消息推送机制概述)
- [服务器配置参数](#服务器配置参数)
- [服务器验证机制（GET 请求）](#服务器验证机制get-请求)
- [消息接收机制（POST 请求）](#消息接收机制post-请求)
  - [明文模式](#明文模式)
  - [安全模式（加密）](#安全模式加密)
- [加密回包机制（安全模式）](#加密回包机制安全模式)
- [调试工具](#调试工具)
- [官方加解密示例代码](#官方加解密示例代码)

---

## 消息推送机制概述

消息推送是微信开放平台提供的**主动推送服务**，开发者无需调用 API 即可及时获取开放平台相关信息。

**数据链路：** 微信服务器 -> POST 请求 -> 开发者配置的 URL 服务器

**服务范围：** 小程序、公众号、小游戏、视频号小店、第三方平台、网站应用

**配置入口：** 登录 open.weixin.qq.com -> 管理中心 -> 网站应用 -> 消息推送

---

## 服务器配置参数

### 基础配置项

| 参数 | 说明 | 要求 |
|------|------|------|
| **URL 服务器地址** | 接收微信消息和事件的接口 URL | 必须以 `http://` 或 `https://` 开头，分别支持 80 和 443 端口 |
| **Token 令牌** | 用于签名验证 | 自定义字符串 |
| **EncodingAESKey** | 消息体加解密密钥 | 43 位字符 |
| **消息加解密方式** | 三选一 | 见下方对比 |
| **数据格式** | 消息体格式 | XML 或 JSON |

### 消息加解密方式对比

| 模式 | 说明 | 安全系数 | 推荐 |
|------|------|----------|------|
| **明文模式** | 不使用加解密，明文发送 | 低 | 不建议 |
| **兼容模式** | 明文、密文共存 | 中 | 不建议 |
| **安全模式** | 使用消息加解密，纯密文 | 高 | **强烈推荐** |

---

## 服务器验证机制（GET 请求）

点击"提交"后，微信服务器发送 **GET 请求**到配置的 URL。

### 请求参数

| 参数 | 描述 |
|------|------|
| `signature` | 签名 |
| `timestamp` | 时间戳 |
| `nonce` | 随机数 |
| `echostr` | 随机字符串 |

### 签名生成算法

```
1. 将 Token、timestamp、nonce 三个参数进行字典序排序
2. 将三个参数字符串拼接成一个字符串
3. 进行 SHA1 计算得到 signature
4. 对比 URL 中的 signature 参数，相等则验证通过
5. 验证通过后，原样返回 echostr 字符串
```

### 验证示例

```
假设：URL="https://www.qq.com/revice", Token="AAAAA"

推送URL：
https://www.qq.com/revice?signature=f464b24fc39322e44b38aa78f5edd27bd1441696&echostr=4375120948345356249&timestamp=1714036504&nonce=1514711492

验证步骤：
1. 字典序排序：["1514711492", "1714036504", "AAAAA"]
2. 拼接字符串："15147114921714036504AAAAA"
3. SHA1 计算：f464b24fc39322e44b38aa78f5edd27bd1441696
4. 对比 signature：相等，合法
5. 返回 echostr：4375120948345356249
```

---

## 消息接收机制（POST 请求）

当特定消息或事件触发时，微信服务器发送 **POST 请求**到配置的 URL。

### 明文模式

**请求参数（URL 中）：**

| 参数 | 说明 |
|------|------|
| `signature` | 签名（用 token + timestamp + nonce 生成） |
| `timestamp` | 时间戳 |
| `nonce` | 随机数 |

**消息体示例（JSON 格式）：**

```json
{
    "ToUserName": "gh_97417a04a28d",
    "FromUserName": "o9AgO5Kd5ggOC-bXrbNODIiE3bGY",
    "CreateTime": 1714037059,
    "MsgType": "event",
    "Event": "debug_demo",
    "debug_str": "hello world"
}
```

**签名验证：** 使用 token + timestamp + nonce 三个参数，字典序排序 -> 拼接 -> SHA1。

**回包：** 无特定要求时返回空串或 `"success"`。

### 安全模式（加密）

**请求参数（URL 中）：**

| 参数 | 说明 |
|------|------|
| `signature` | **不要使用此参数验证** |
| `timestamp` | 时间戳 |
| `nonce` | 随机数 |
| `openid` | 用户 openid |
| `encrypt_type` | 加密类型（aes） |
| `msg_signature` | **使用此参数验证** |

**消息体示例（JSON 格式）：**

```json
{
    "ToUserName": "gh_97417a04a28d",
    "Encrypt": "+qdx1OKCy+5JPCBFWw70tm0fJGb2Jmeia4FCB7kao+/Q5c/ohsOzQHi8khUOb05JCpj0JB4RvQMkUyus8TPxLKJGQqcvZqzDpVzazhZv6JsXUnnR8XGT740XgXZUXQ7vJVnAG+tE8NUd4yFyjPy7GgiaviNrlCTj+l5kdfMuFUPpRSrfMZuMcp3Fn2Pede2IuQrKEYwKSqFIZoNqJ4M8EajAsjLY2km32IIjdf8YL/P50F7mStwntrA2cPDrM1kb6mOcfBgRtWygb3VIYnSeOBrebufAlr7F9mFUPAJGj04="
}
```

**签名验证（msg_signature）：**

```
1. 将 token、timestamp、nonce、Encrypt 四个参数字典序排序
2. 拼接成字符串
3. SHA1 计算签名
4. 与 URL 中的 msg_signature 对比
```

**消息解密流程：**

```
+-------------------------------------------------------------+
| 1. 生成 AESKey                                               |
|    AESKey = Base64_Decode(EncodingAESKey + "=") -> 32 字节   |
+-------------------------------------------------------------+
| 2. Base64 解码 Encrypt 密文 -> TmpMsg                       |
+-------------------------------------------------------------+
| 3. AES 解密（CBC 模式，PKCS#7 填充）-> FullStr              |
+-------------------------------------------------------------+
| 4. 解析 FullStr 结构：                                       |
|    FullStr = random(16B) + msg_len(4B) + msg + appid        |
+-------------------------------------------------------------+
| 5. 验证 appid 是否与自身网站应用相符                          |
+-------------------------------------------------------------+
```

**AES 解密参数：**

| 参数 | 说明 |
|------|------|
| 模式 | CBC |
| 密钥长度 | 32 字节（256 位） |
| 填充方式 | PKCS#7 |
| PKCS#7 规则 | 填充 `(K - N%K)` 个字节，每字节内容为 `(K - N%K)` |

**解密后结构示例：**

```
random(16B) = "a8eedb185eb2fecf"
msg_len(4B) = 167（网络字节序）
msg = {"ToUserName":"gh_97417a04a28d",...}
appid = "wxba5fad812f8e6fb9"
```

> **注意**：msg_len 使用**网络字节序**（大端）。

---

## 加密回包机制（安全模式）

### 回包格式

**JSON 格式：**

```json
{
    "Encrypt": "${msg_encrypt}",
    "MsgSignature": "${msg_signature}",
    "TimeStamp": ${timestamp},
    "Nonce": "${nonce}"
}
```

**XML 格式：**

```xml
<xml>
    <Encrypt><![CDATA[${msg_encrypt}]]></Encrypt>
    <MsgSignature><![CDATA[${msg_signature}]]></MsgSignature>
    <TimeStamp>${timestamp}</TimeStamp>
    <Nonce><![CDATA[${nonce}]]></Nonce>
</xml>
```

### 回包参数生成

| 参数 | 生成方式 |
|------|----------|
| `Encrypt` | 加密后的内容（见下方加密流程） |
| `MsgSignature` | SHA1(sort(token, TimeStamp, Nonce, Encrypt)) |
| `TimeStamp` | 当前时间戳 |
| `Nonce` | 回填 URL 参数中的 nonce |

### Encrypt 加密流程

```
+-------------------------------------------------------------+
| 1. 生成 AESKey                                               |
|    AESKey = Base64_Decode(EncodingAESKey + "=")             |
+-------------------------------------------------------------+
| 2. 构造 FullStr                                              |
|    FullStr = random(16B) + msg_len(4B) + msg + appid        |
+-------------------------------------------------------------+
| 3. AES 加密（CBC 模式，PKCS#7 填充）-> TmpMsg               |
+-------------------------------------------------------------+
| 4. Base64 编码 -> Encrypt                                   |
+-------------------------------------------------------------+
```

---

## 调试工具

| 工具 | 用途 |
|------|------|
| **URL 验证工具** | 验证服务器配置是否正确 |
| **请求构造** | 生成 debug_demo 事件的发包/回包调试信息 |
| **调试工具** | 实际推送 debug_demo 事件到开发者服务器 |

访问地址：https://developers.weixin.qq.com/apiExplorer?type=messagePush

**调试工具所需参数：** AccessToken、URL 地址、Token、Body（调试工具需要）

---

## 官方加解密示例代码

微信官方提供多种语言的加解密示例代码：

- PHP
- Java
- C++
- Python
- C#

下载地址：https://wximg.gtimg.com/shake_tv/mpwiki/cryptoDemo.zip
