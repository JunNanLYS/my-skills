# CheckSmsVerifyCode — 核验短信验证码

## 接口信息

| 项目 | 内容 |
|------|------|
| Action | `dypns:CheckSmsVerifyCode` |
| API 版本 | 2017-05-25 |
| 访问级别 | none |
| 调试地址 | [OpenAPI Explorer](https://api.aliyun.com/api/Dypnsapi/2017-05-25/CheckSmsVerifyCode) |

## 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `PhoneNumber` | string | **是** | — | 手机号 |
| `VerifyCode` | string | **是** | — | 用户输入的验证码 |
| `SchemeName` | string | 否 | `""` | 方案名称，需与发送时一致 |
| `CountryCode` | string | 否 | `86` | 号码国家编码 |
| `OutId` | string | 否 | — | 外部流水号 |
| `CaseAuthPolicy` | integer | 否 | — | `1`=不区分大小写，`2`=区分大小写 |

## 返回参数

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `Code` | string | `OK`=接口调用成功 |
| `Message` | string | 状态描述 |
| `RequestId` | string | 请求 ID |
| `Success` | boolean | 接口是否调用成功 |
| `Model` | object | 业务数据 |
| `Model.VerifyResult` | string | **核验结果**：`PASS`=成功，`UNKNOWN`=失败 |
| `Model.OutId` | string | 外部流水号 |

## 返回示例

```json
{
  "Code": "OK",
  "Message": "成功",
  "RequestId": "CF8854E5-DB21-3E5D-A9B1-DDC752FD7384",
  "Success": true,
  "Model": {
    "VerifyResult": "PASS",
    "OutId": "1212312"
  }
}
```

## 关键注意：接口成功 ≠ 核验成功

**这是本接口最容易出错的点：**

- `Code="OK"` + `Success=true` → 仅表示**接口调用成功**
- 真正的核验结果在 `Model.VerifyResult` 字段：
  - `PASS` → 验证码正确，核验通过
  - `UNKNOWN` → 验证码错误、已过期或不存在

```python
# 正确的判断逻辑
response = client.check_sms_verify_code(request)

if not response.body.success:
    # 接口调用失败（网络/权限等问题）
    return error("接口异常")

if response.body.model and response.body.model.verify_result == "PASS":
    # 核验通过
    return success()
else:
    # 核验失败（验证码错误或过期）
    return error("验证码错误")
```

## 前置条件

本接口能否核验成功，取决于发送时 `TemplateParam` 的配置：

| 发送时的 TemplateParam | 能否核验 | 说明 |
|----------------------|----------|------|
| `{"code":"##code##"}` | 可以 | API 动态生成，阿里云保存了验证码记录 |
| `{"code":"123456"}` | **不可以** | 固定值模式，阿里云端无记录 |

## SchemeName 一致性

如果发送接口的 `SchemeName` 不为空，核验时必须传入相同的值：

```python
# 发送时
send_request.scheme_name = "my_app_login"

# 核验时 — 必须一致
check_request.scheme_name = "my_app_login"
```

## 错误码

完整错误码参见 [阿里云错误中心](https://api.aliyun.com/document/Dypnsapi/2017-05-25/errorCode)。

常见错误：
- 接口返回 `Success=true` 但 `VerifyResult=UNKNOWN`：验证码不匹配或已过期
- 接口返回 `Success=false`：参数错误、权限不足等
