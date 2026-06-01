---
name: aliyun-sms-verify
description: 阿里云号码认证服务 - 短信验证码发送与核验。触发场景：用户需要实现短信验证码登录/注册、手机号核验、短信认证集成；用户提到"短信验证码"、"SMS验证"、"号码认证"、"SendSmsVerifyCode"、"CheckSmsVerifyCode"、"阿里云短信认证"、"手机验证码"、"验证码登录"、"短信校验"、"短信核验"。
---

# 阿里云短信认证服务 (DYPNS)

基于阿里云号码认证服务（产品码 Dypnsapi, API 版本 2017-05-25）的短信验证码发送与核验集成技能。

## 核心流程

```
用户输入手机号 → 后端调用 SendSmsVerifyCode → 短信下发 → 用户收到验证码
→ 用户输入验证码 → 后端调用 CheckSmsVerifyCode → 返回核验结果
```

## 前置条件

1. **开通服务**：在[号码认证控制台](https://dypns.console.aliyun.com/)开通号码认证服务
2. **配置签名**：在[赠送签名配置](https://dypns.console.aliyun.com/smsCertParamsConfig/sign)选择系统赠送签名
3. **配置模板**：在[赠送模板配置](https://dypns.console.aliyun.com/smsCertParamsConfig/template)选择系统赠送模板
4. **安装 SDK**：`pip install alibabacloud-dypnsapi20170525`
5. **配置凭证**：通过环境变量或配置文件设置 AccessKey ID / AccessKey Secret

> **重要**：推荐使用系统赠送的签名和模板，自定义签名近期可能下发失败。

## 快速集成（Python）

### 发送验证码

```python
from alibabacloud_dypnsapi20170525.client import Client
from alibabacloud_dypnsapi20170525.models import SendSmsVerifyCodeRequest
from alibabacloud_tea_openapi.models import Config

def create_client(access_key_id: str, access_key_secret: str) -> "Client":
    config = Config(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret,
        endpoint="dypnsapi.aliyuncs.com",
    )
    return Client(config)

def send_verify_code(client: "Client", phone_number: str) -> dict:
    """发送短信验证码"""
    request = SendSmsVerifyCodeRequest(
        phone_number=phone_number,             # 必填：手机号
        sign_name="速通互联验证码",            # 必填：系统赠送签名
        template_code="100001",                # 必填：系统赠送模板CODE
        template_param='{"code":"##code##"}',  # 必填：占位符模式，支持核验
        code_type=1,                           # 占位符模式必填：1=纯数字
        code_length=4,                         # 可选：验证码长度 4-8，默认4
        valid_time=300,                        # 可选：有效期（秒），默认300
        interval=60,                           # 可选：发送间隔（秒），默认60
        return_verify_code=False,              # 可选：是否返回验证码，生产环境建议false
    )
    response = client.send_sms_verify_code(request)
    return {
        "success": response.body.success,
        "code": response.body.code,            # "OK" 表示接口调用成功
        "message": response.body.message,
        "biz_id": response.body.model.biz_id if response.body.model else None,
    }
```

### 核验验证码

```python
from alibabacloud_dypnsapi20170525.models import CheckSmsVerifyCodeRequest

def check_verify_code(client: "Client", phone_number: str, verify_code: str) -> dict:
    """核验短信验证码"""
    request = CheckSmsVerifyCodeRequest(
        phone_number=phone_number,    # 必填：手机号
        verify_code=verify_code,      # 必填：用户输入的验证码
    )
    response = client.check_sms_verify_code(request)

    # 关键：接口调用成功 ≠ 核验成功，必须看 Model.VerifyResult
    verify_result: str = ""
    if response.body.model:
        verify_result = response.body.model.verify_result

    return {
        "api_success": response.body.success,  # 接口是否调用成功
        "verify_result": verify_result,        # "PASS"=核验成功, "UNKNOWN"=失败
        "is_verified": verify_result == "PASS",
    }
```

### 完整使用示例

```python
# 初始化客户端
client = create_client("your-access-key-id", "your-access-key-secret")

# 步骤1：发送验证码
result = send_verify_code(client, "18612345678")
if not result["success"]:
    print(f"发送失败: {result['message']}")
else:
    print("验证码已发送")

# 步骤2：核验验证码（用户提交后）
check = check_verify_code(client, "18612345678", "1234")
if check["is_verified"]:
    print("验证通过")
else:
    print("验证码错误或已过期")
```

## 关键注意事项

| 事项 | 说明 |
|------|------|
| **核验结果判断** | `Code=OK` + `Success=true` 仅表示接口调用成功，核验结果必须看 `Model.VerifyResult`（`PASS`/`UNKNOWN`） |
| **验证码生成方式** | `TemplateParam` 用 `##code##` 占位符 → API 动态生成 → 支持阿里云核验；直接传固定值 → 不支持核验 |
| **方案名称一致性** | 发送和核验的 `SchemeName` 必须完全一致 |
| **仅支持国内号码** | `CountryCode` 固定为 86，暂不支持国际号码 |
| **计费规则** | 仅收取短信发送费用，按运营商回执状态计费，运营商回执失败不计费，核验服务免费 |
| **生产安全** | `ReturnVerifyCode` 生产环境务必设为 `false`，避免验证码通过 API 响应泄露 |

## 错误处理

| 错误码 | 含义 | 处理建议 |
|--------|------|----------|
| `MOBILE_NUMBER_ILLEGAL` | 手机号格式错误 | 前端校验手机号格式 |
| `BUSINESS_LIMIT_CONTROL` | 触发天级流控 | 提示用户当日发送次数已达上限 |
| `FREQUENCY_FAIL` | 频控校验未通过 | 提示用户间隔后再试（默认60秒） |
| `INVALID_PARAMETERS` | 参数非法 | 检查请求参数是否合规 |
| `FUNCTION_NOT_OPENED` | 未开通融合认证功能 | 在控制台开通服务 |

## 进阶配置

详细的参数说明和配置选项，参见：

- [references/send-sms-verify-code.md](references/send-sms-verify-code.md) — 发送验证码完整参数文档
- [references/check-sms-verify-code.md](references/check-sms-verify-code.md) — 核验验证码完整参数文档
- [references/integration-guide.md](references/integration-guide.md) — 集成最佳实践与安全建议
