# 授权变更事件通知

> 本文档覆盖微信开放平台授权用户信息变更通知的完整机制，包括事件类型、推送格式和处理建议。

## 目录

- [通知机制概述](#通知机制概述)
- [事件类型](#事件类型)
- [推送格式](#推送格式)
- [字段定义](#字段定义)
- [开发者处理建议](#开发者处理建议)
- [关键注意点](#关键注意点)

---

## 通知机制概述

微信开放平台通过**消息推送服务器**向开发者发送授权用户信息变更通知。

**覆盖范围：** 仅限**最近 30 天内授权过**的用户。

**前提条件：** 开发者需提前配置消息推送服务器才能接收这些事件通知。详见 `references/message-push.md`。

---

## 事件类型

| 事件标识 | 触发场景 | 开发者处理要求 |
|---------|---------|--------------|
| `user_info_modified` | 用户资料存在风险，平台对用户资料进行清理 | 及时主动**更新或清理**用户的头像及昵称 |
| `user_authorization_revoke` | 用户主动撤回授权信息 | 及时**删除**该用户信息 |
| `user_authorization_cancellation` | 用户完成账号注销 | 依法依规及时履行**个人信息保护义务** |

---

## 推送格式

支持 **XML** 和 **JSON** 两种格式，开发者可在消息推送服务器配置中选择。

### XML 格式示例

```xml
<xml>
    <ToUserName><![CDATA[gh_870882ca4b1]]></ToUserName>
    <FromUserName><![CDATA[owAqB1v0ahK_Xlc7GshIDdf2yf7E]]></FromUserName>
    <CreateTime>1626857200</CreateTime>
    <MsgType><![CDATA[event]]></MsgType>
    <Event><![CDATA[user_authorization_revoke]]></Event>
    <OpenID><![CDATA[owAqB1nqaOYYWl0Ng484G2z5NIwU]]></OpenID>
    <AppID><![CDATA[wx13974bf780d3dc89]]></AppID>
    <RevokeInfo><![CDATA[1]]></RevokeInfo>
</xml>
```

### JSON 格式示例

```json
{
    "ToUserName": "gh_870882ca4b1",
    "FromUserName": "oaKk346BaWE-eIn4oSRWbaM9vR7s",
    "CreateTime": 1627359464,
    "MsgType": "event",
    "Event": "user_authorization_revoke",
    "OpenID": "oaKk343WOktAaT2ygsX138BGblrg",
    "AppID": "wx13974bf780d3dc89",
    "RevokeInfo": "301"
}
```

---

## 字段定义

| 属性 | 类型 | 说明 |
|-----|------|-----|
| `ToUserName` | string | 网站应用的 UserName |
| `FromUserName` | string | 平台推送服务 UserName |
| `MsgType` | string | 固定值：`event` |
| `Event` | string | 事件类型标识（见上方三种） |
| `CreateTime` | number | 消息发送时间（Unix 时间戳） |
| `OpenID` | string | 授权用户的 OpenID |
| `UnionID` | string | 授权用户的 UnionID（可能为空，需做容空处理） |
| `AppID` | string | 网站应用的 AppID |
| `RevokeInfo` | string | 用户撤回的授权信息详情，`301` = 撤回网站应用所有授权 |

---

## 开发者处理建议

```
收到推送事件
    |
    +-- Event = user_info_modified
    |   +-- 调用接口重新获取用户信息，更新本地头像/昵称缓存
    |
    +-- Event = user_authorization_revoke
    |   +-- 根据 RevokeInfo 判断撤回范围
    |       +-- 301: 删除该用户在本应用的所有授权数据
    |
    +-- Event = user_authorization_cancellation
        +-- 彻底删除该用户所有个人信息，履行注销义务
            （需符合《个人信息保护法》等法规要求）
```

---

## 关键注意点

1. **30 天窗口期**：仅对最近 30 天内有授权行为的用户发送变更通知
2. **RevokeInfo 字段**：目前文档仅明确 `301` 一种值（撤回所有授权），未来可能扩展更多细粒度撤回类型
3. **UnionID 字段**：字段定义表中列出了 UnionID，但推送示例中未包含该字段，实际使用时需做**容空处理**
4. **合规要求**：用户注销场景下，需依法依规履行个人信息保护义务，建议建立完整的用户数据删除流程
5. **消息加解密**：如果消息推送配置为安全模式，推送数据需先解密才能读取，详见 `references/message-push.md`
