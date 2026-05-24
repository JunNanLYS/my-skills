# 生产环境最佳实践与完整工作流

> 本文档提供微信登录接入的完整生产级实现方案。

## 目录

- [FastAPI 后端实现](#fastapi-后端实现)
- [Token 刷新策略](#token-刷新策略)
- [登录态管理方案](#登录态管理方案)
- [消息推送服务器完整实现](#消息推送服务器完整实现)
- [安全最佳实践清单](#安全最佳实践清单)

---

## FastAPI 后端实现

### 配置

```python
# config.py
from pydantic_settings import BaseSettings

class WeChatSettings(BaseSettings):
    WECHAT_APPID: str
    WECHAT_APPSECRET: str
    WECHAT_REDIRECT_URI: str

    class Config:
        env_file = ".env"

wechat_settings = WeChatSettings()
```

### OAuth2.0 完整流程

```python
# routers/wechat_auth.py
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
import httpx
import hashlib
import secrets

router = APIRouter(prefix="/api/auth/wechat", tags=["wechat"])

OAUTH_URL = "https://open.weixin.qq.com/connect/qrconnect"
TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token"
REFRESH_URL = "https://api.weixin.qq.com/sns/oauth2/refresh_token"
USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo"
AUTH_CHECK_URL = "https://api.weixin.qq.com/sns/auth"


@router.get("/login")
async def wechat_login(request: Request):
    """生成微信扫码登录 URL"""
    state = secrets.token_urlsafe(32)
    # 存储 state 到 session/redis 用于 CSRF 验证
    request.session["wechat_oauth_state"] = state

    url = (
        f"{OAUTH_URL}?appid={wechat_settings.WECHAT_APPID}"
        f"&redirect_uri={wechat_settings.WECHAT_REDIRECT_URI}"
        f"&response_type=code&scope=snsapi_login"
        f"&state={state}#wechat_redirect"
    )
    return {"login_url": url}


@router.get("/callback")
async def wechat_callback(code: str, state: str, request: Request):
    """处理微信授权回调"""
    # 1. 验证 state 防 CSRF
    saved_state = request.session.pop("wechat_oauth_state", None)
    if not saved_state or saved_state != state:
        raise HTTPException(status_code=400, detail="Invalid state")

    # 2. 用 code 换取 access_token
    async with httpx.AsyncClient() as client:
        resp = await client.get(TOKEN_URL, params={
            "appid": wechat_settings.WECHAT_APPID,
            "secret": wechat_settings.WECHAT_APPSECRET,
            "code": code,
            "grant_type": "authorization_code",
        })
        data = resp.json()

    if "errcode" in data:
        raise HTTPException(
            status_code=400,
            detail=f"WeChat OAuth error: {data['errcode']} {data['errmsg']}"
        )

    access_token = data["access_token"]
    refresh_token = data["refresh_token"]
    openid = data["openid"]
    unionid = data.get("unionid")
    expires_in = data["expires_in"]

    # 3. 获取用户信息
    async with httpx.AsyncClient() as client:
        resp = await client.get(USERINFO_URL, params={
            "access_token": access_token,
            "openid": openid,
            "lang": "zh_CN",
        })
        user_info = resp.json()

    if "errcode" in user_info:
        raise HTTPException(
            status_code=400,
            detail=f"Get userinfo error: {user_info['errmsg']}"
        )

    # 4. 保存/更新用户数据（unionid 务必保存）
    # 5. 生成业务登录态（JWT）
    # 6. 返回登录态给前端

    return {
        "openid": openid,
        "unionid": unionid or user_info.get("unionid"),
        "nickname": user_info.get("nickname"),
        "headimgurl": user_info.get("headimgurl"),
    }
```

### 刷新 Token 接口

```python
@router.post("/refresh")
async def refresh_access_token(refresh_token: str):
    """刷新 access_token"""
    async with httpx.AsyncClient() as client:
        resp = await client.get(REFRESH_URL, params={
            "appid": wechat_settings.WECHAT_APPID,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        })
        data = resp.json()

    if "errcode" in data:
        raise HTTPException(
            status_code=400,
            detail=f"Refresh error: {data['errmsg']}"
        )

    return {
        "access_token": data["access_token"],
        "expires_in": data["expires_in"],
        "refresh_token": data["refresh_token"],
        "openid": data["openid"],
    }
```

---

## Token 刷新策略

### 推荐方案

```
refresh_token 有效期 30 天（不可续期）
access_token 有效期 2 小时（可通过 refresh_token 续期）

推荐策略：
1. 后端存储 refresh_token 到数据库（关联用户）
2. 设置定时任务在 access_token 过期前主动刷新
3. 或在接口调用时检查 access_token 是否过期，过期则先刷新
4. refresh_token 失效（30天过期或用户撤回授权） -> 引导用户重新授权
```

### 数据库存储建议

```sql
CREATE TABLE wechat_user_tokens (
    id SERIAL PRIMARY KEY,
    unionid VARCHAR(64),
    openid VARCHAR(64) NOT NULL,
    access_token VARCHAR(256),
    access_token_expires_at TIMESTAMP,
    refresh_token VARCHAR(256),
    refresh_token_expires_at TIMESTAMP,  -- 创建时间 + 30天
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 登录态管理方案

```python
# 生成业务 JWT，不依赖微信 token
import jwt
from datetime import datetime, timedelta, timezone

def create_business_token(user_id: str, secret_key: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, secret_key, algorithm="HS256")
```

**建议的业务登录态有效期：** 7-30 天，配合 refresh_token 机制，用户无需频繁重新授权。

---

## 消息推送服务器完整实现

### 服务器验证（GET）

```python
from fastapi import APIRouter, Query
import hashlib

router = APIRouter()

@router.get("/wechat/message")
async def verify_server(
    signature: str = Query(...),
    timestamp: str = Query(...),
    nonce: str = Query(...),
    echostr: str = Query(...),
):
    """微信服务器验证"""
    token = "YOUR_TOKEN"  # 从配置读取
    params = sorted([token, timestamp, nonce])
    sha1 = hashlib.sha1("".join(params).encode()).hexdigest()
    if sha1 == signature:
        return echostr
    raise HTTPException(status_code=403, detail="Invalid signature")
```

### 消息接收（POST - 明文模式）

```python
from fastapi import Request
from pydantic import BaseModel

class WeChatEvent(BaseModel):
    ToUserName: str
    FromUserName: str
    CreateTime: int
    MsgType: str
    Event: str
    OpenID: str
    AppID: str
    RevokeInfo: str | None = None

@router.post("/wechat/message")
async def handle_message(request: Request, event: WeChatEvent):
    """处理微信推送事件"""
    if event.Event == "user_info_modified":
        # 重新获取并更新用户信息
        pass
    elif event.Event == "user_authorization_revoke":
        # 删除用户授权数据
        pass
    elif event.Event == "user_authorization_cancellation":
        # 依法删除用户所有个人信息
        pass

    return "success"
```

---

## 安全最佳实践清单

| 项目 | 要求 | 严重性 |
|------|------|--------|
| AppSecret 存储 | 仅存放在服务端环境变量/密钥管理服务中 | **致命** |
| access_token 存储 | 存放在服务端，禁止传到前端 | **致命** |
| refresh_token 存储 | 存放在服务端数据库，关联用户 | **致命** |
| redirect_uri 校验 | 使用白名单严格校验，防止开放重定向 | **高** |
| state 参数 | 使用随机数 + session 校验防 CSRF | **高** |
| code 使用 | 一次性，成功换 token 后立即失效，不可重复使用 | **中** |
| 头像保存 | 获取后主动下载保存到自有存储，不依赖微信 URL | **中** |
| 用户数据清理 | 监听撤回/注销事件，及时删除用户数据 | **高** |
| HTTPS 强制 | 所有对外接口必须使用 HTTPS | **高** |
| 接口频率 | 遵守微信频率限制，做好本地限流 | **中** |
| 日志脱敏 | access_token、openid 等敏感信息在日志中脱敏 | **中** |
