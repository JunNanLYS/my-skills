# SendSmsVerifyCode — 发送短信验证码

## 接口信息

| 项目 | 内容 |
|------|------|
| Action | `dypns:SendSmsVerifyCode` |
| API 版本 | 2017-05-25 |
| 访问级别 | create（写入） |
| 调试地址 | [OpenAPI Explorer](https://api.aliyun.com/api/Dypnsapi/2017-05-25/SendSmsVerifyCode) |

## 请求参数

### 必填参数

| 参数名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `PhoneNumber` | string | 短信接收方手机号 | `18612345678` |
| `SignName` | string | 签名名称，使用系统赠送签名 | `速通互联验证码` |
| `TemplateCode` | string | 短信模板 CODE，需搭配赠送签名 | `100001` |
| `TemplateParam` | string | 模板参数（JSON 格式） | `{"code":"##code##","min":"5"}` |

### 可选参数

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `SchemeName` | string | `""` | 方案名称，不填为"默认方案"，最多 20 字符 |
| `CountryCode` | string | `86` | 号码国家编码，目前仅支持 86 |
| `CodeLength` | integer | `4` | 验证码长度，4-8 位 |
| `ValidTime` | integer | `300` | 有效时长（秒） |
| `Interval` | integer | `60` | 发送间隔（秒），用于频控 |
| `CodeType` | integer | `1` | 验证码类型，占位符模式必填 |
| `ReturnVerifyCode` | boolean | `false` | 是否返回验证码，生产环境建议 false |
| `DuplicatePolicy` | integer | `1` | `1`=覆盖旧码（默认），`2`=保留多码 |
| `AutoRetry` | integer | `1` | `1`=自动重试，`0`=不重试 |
| `OutId` | string | — | 外部流水号（透传） |
| `SmsUpExtendCode` | string | — | 上行扩展码，系统自动生成，一般忽略 |

### CodeType 枚举

| 值 | 类型 | 说明 |
|----|------|------|
| 1 | 纯数字 | **默认** |
| 2 | 纯大写字母 | |
| 3 | 纯小写字母 | |
| 4 | 大小写字母混合 | |
| 5 | 数字+大写字母 | |
| 6 | 数字+小写字母 | |
| 7 | 数字+大小写字母混合 | |

### TemplateParam 两种模式

| 模式 | 示例 | 验证码来源 | 是否支持 CheckSmsVerifyCode |
|------|------|-----------|---------------------------|
| **占位符模式（推荐）** | `{"code":"##code##","min":"5"}` | API 动态生成 | 支持 |
| 固定值模式 | `{"code":"123456","min":"5"}` | 自行配置 | **不支持** |

> 占位符模式下 `CodeType` 必填。

### DuplicatePolicy 枚举

| 值 | 含义 | 场景 |
|----|------|------|
| 1 | 覆盖（默认） | 新验证码使旧码失效，常规场景 |
| 2 | 保留 | 多个验证码在有效期内均可校验通过 |

## 返回参数

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `Code` | string | `OK`=成功，其他见错误码 |
| `Message` | string | 状态描述 |
| `RequestId` | string | 请求 ID |
| `Success` | boolean | 是否成功 |
| `Model` | object | 业务数据 |
| `Model.VerifyCode` | string | 验证码（仅 `ReturnVerifyCode=true`） |
| `Model.BizId` | string | 业务 ID |
| `Model.OutId` | string | 外部流水号 |
| `Model.RequestId` | string | 请求 ID |

## 返回示例

```json
{
  "Code": "OK",
  "Message": "成功",
  "RequestId": "CC3BB6D2-2FDF-4321-9DCE-B38165CE4C47",
  "Success": true,
  "Model": {
    "VerifyCode": "4232",
    "BizId": "112231421412414124123^4",
    "OutId": "1231231313",
    "RequestId": "a3671ccf-0102-4c8e-8797-a3678e091d09"
  }
}
```

## 错误码

| HTTP 状态 | 错误码 | 含义 | 处理 |
|-----------|--------|------|------|
| 400 | `MOBILE_NUMBER_ILLEGAL` | 手机号格式错误 | 校验手机号格式 |
| 400 | `BUSINESS_LIMIT_CONTROL` | 触发天级流控 | 提示用户限额 |
| 400 | `FREQUENCY_FAIL` | 频控校验未通过 | 提示间隔时间 |
| 400 | `INVALID_PARAMETERS` | 参数非法 | 检查参数 |
| 400 | `FUNCTION_NOT_OPENED` | 未开通功能 | 控制台开通服务 |

> 完整错误码：[阿里云错误中心](https://api.aliyun.com/document/Dypnsapi/2017-05-25/errorCode)
