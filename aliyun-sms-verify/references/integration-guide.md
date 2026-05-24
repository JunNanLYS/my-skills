# 集成最佳实践与安全建议

## 一、SDK 安装与配置

### Python SDK

```bash
pip install alibabacloud-dypnsapi20170525
```

### AccessKey 管理

**推荐使用环境变量**，不要硬编码到代码中：

```bash
export ALIBABA_CLOUD_ACCESS_KEY_ID="your-ak-id"
export ALIBABA_CLOUD_ACCESS_KEY_SECRET="your-ak-secret"
```

```python
import os
from alibabacloud_tea_openapi.models import Config

config = Config(
    access_key_id=os.environ["ALIBABA_CLOUD_ACCESS_KEY_ID"],
    access_key_secret=os.environ["ALIBABA_CLOUD_ACCESS_KEY_SECRET"],
    endpoint="dypnsapi.aliyuncs.com",
)
```

> **安全建议**：生产环境使用 RAM 子账号的 AccessKey，仅授权 `dypns:SendSmsVerifyCode` 和 `dypns:CheckSmsVerifyCode` 操作权限。

## 二、后端集成架构

```
前端                    后端                     阿里云
 │                       │                       │
 │── POST /sms/send ──→  │                       │
 │                       │── SendSmsVerifyCode ─→│
 │                       │←── BizId ────────────│
 │←── {biz_id} ──────── │                       │
 │                       │                       │
 │── POST /sms/check ──→ │                       │
 │                       │── CheckSmsVerifyCode ─→│
 │                       │←── VerifyResult ─────│
 │←── {verified} ────── │                       │
```

### FastAPI 集成示例

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class SendRequest(BaseModel):
    phone_number: str

class CheckRequest(BaseModel):
    phone_number: str
    verify_code: str

@app.post("/api/sms/send")
async def send_sms(req: SendRequest):
    """发送验证码"""
    # TODO: 基础校验（手机号格式、频率限制等）
    if not is_valid_phone(req.phone_number):
        raise HTTPException(400, "手机号格式错误")

    result = send_verify_code(sms_client, req.phone_number)
    if not result["success"]:
        raise HTTPException(400, f"发送失败: {result['message']}")

    return {"message": "验证码已发送"}

@app.post("/api/sms/check")
async def check_sms(req: CheckRequest):
    """核验验证码"""
    result = check_verify_code(sms_client, req.phone_number, req.verify_code)
    if result["is_verified"]:
        return {"verified": True, "message": "验证通过"}
    else:
        raise HTTPException(400, "验证码错误或已过期")
```

## 三、安全建议

### 1. 验证码不通过 API 返回

```python
# 生产环境务必设置
request.return_verify_code = False
```

验证码仅通过短信渠道送达用户，API 响应中不应包含验证码明文。

### 2. 频控策略

| 维度 | 建议值 | 说明 |
|------|--------|------|
| 同号码发送间隔 | 60 秒 | `Interval` 参数，防止用户频繁触发 |
| 同号码每日上限 | 10 次 | 在后端维护计数器 |
| 同 IP 每小时上限 | 20 次 | 防刷接口，后端 Redis 实现 |
| 核验失败次数 | 5 次 | 超过后使验证码失效 |

### 3. 验证码有效期

```python
# 默认 300 秒（5 分钟），可根据业务调整
request.valid_time = 300
```

建议不要超过 10 分钟，减少被截获利用的风险。

### 4. 手机号校验

后端在调用阿里云 API 之前先做格式校验，避免无效请求：

```python
import re

def is_valid_phone(phone: str) -> bool:
    """校验中国大陆手机号"""
    return bool(re.match(r"^1[3-9]\d{9}$", phone))
```

## 四、错误码处理建议

```python
ERROR_MAP = {
    "MOBILE_NUMBER_ILLEGAL": ("手机号格式错误", 400),
    "BUSINESS_LIMIT_CONTROL": ("今日发送次数已达上限", 429),
    "FREQUENCY_FAIL": ("发送过于频繁，请稍后再试", 429),
    "INVALID_PARAMETERS": ("请求参数错误", 400),
    "FUNCTION_NOT_OPENED": ("短信认证服务未开通", 500),
}

def handle_error(code: str, message: str):
    if code in ERROR_MAP:
        user_msg, status = ERROR_MAP[code]
        raise HTTPException(status, user_msg)
    # 未知错误
    raise HTTPException(500, f"服务异常: {message}")
```

## 五、计费说明

| 项目 | 说明 |
|------|------|
| 计费项 | 仅短信发送费用 |
| 计费方式 | 按运营商回执状态计费 |
| 运营商回执失败 | 不计费 |
| 核验服务 | 免费 |
| 发送成功但用户未收到 | 仍计费（运营商已接受） |

## 六、签名与模板配置

1. 进入[号码认证控制台](https://dypns.console.aliyun.com/)
2. 选择「赠送签名配置」页面，选用系统赠送签名
3. 选择「赠送模板配置」页面，选用系统赠送模板
4. 系统赠送签名必须搭配系统赠送模板使用

> 自定义签名因运营商管控加强，存在下发失败风险，不推荐使用。
