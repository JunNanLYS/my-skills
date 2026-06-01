# CRUD 代码模板

> 核心规则请参考 `SKILL.md`。

---

## 使用方式

新增业务模块时，将以下 `{Module}` / `{module}` / `{模块中文名}` 替换为实际名称，生成 4 个文件。

---

## 1. Model 模板

```python
# app/models/{module}.py
from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional
import uuid


class {ModelName}(SQLModel, table=True):
    """{模块中文名}数据模型"""
    __tablename__ = "{table_name}"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    # ========== 业务字段 ==========
    name: str = Field(max_length=100, index=True)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)
    # ========== 时间戳 ==========
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

---

## 2. Schema 模板

```python
# app/schemas/{module}.py
from sqlmodel import BaseModel
from datetime import datetime
from typing import Optional


class {ModelName}Create(BaseModel):
    """创建{模块中文名}"""
    name: str
    description: Optional[str] = None


class {ModelName}Update(BaseModel):
    """更新{模块中文名}（所有字段可选）"""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class {ModelName}Response(BaseModel):
    """{模块中文名}响应"""
    id: str
    name: str
    description: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class {ModelName}ListResponse(BaseModel):
    """{模块中文名}列表响应（带分页）"""
    items: list[{ModelName}Response]
    total: int
    page: int
    page_size: int
```

---

## 3. Service 模板

```python
# app/services/{module}.py
from sqlmodel import Session, select, func
from typing import Optional
from app.models.{module} import {ModelName}
from app.schemas.{module} import {ModelName}Create, {ModelName}Update


class {ModelName}Service:
    """{模块中文名}业务逻辑"""

    @staticmethod
    def create(session: Session, data: {ModelName}Create) -> {ModelName}:
        """创建{模块中文名}"""
        obj = {ModelName}(**data.model_dump())
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    @staticmethod
    def get_by_id(session: Session, obj_id: str) -> Optional[{ModelName}]:
        """根据 ID 获取"""
        return session.get({ModelName}, obj_id)

    @staticmethod
    def get_list(
        session: Session,
        page: int = 1,
        page_size: int = 10,
        keyword: Optional[str] = None,
    ) -> tuple[list[{ModelName}], int]:
        """获取列表（带分页和搜索）"""
        query = select({ModelName})
        count_query = select(func.count({ModelName}.id))

        if keyword:
            query = query.where({ModelName}.name.contains(keyword))
            count_query = count_query.where({ModelName}.name.contains(keyword))

        total = session.exec(count_query).one()
        items = session.exec(
            query.offset((page - 1) * page_size).limit(page_size)
        ).all()
        return items, total

    @staticmethod
    def update(
        session: Session, obj_id: str, data: {ModelName}Update
    ) -> Optional[{ModelName}]:
        """更新"""
        obj = session.get({ModelName}, obj_id)
        if not obj:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(obj, key, value)
        obj.updated_at = datetime.utcnow()
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    @staticmethod
    def delete(session: Session, obj_id: str) -> bool:
        """删除"""
        obj = session.get({ModelName}, obj_id)
        if not obj:
            return False
        session.delete(obj)
        session.commit()
        return True
```

---

## 4. Router 模板

```python
# app/routers/{module}.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from typing import Optional
from app.database import get_session
from app.schemas.{module} import (
    {ModelName}Create, {ModelName}Update,
    {ModelName}Response, {ModelName}ListResponse,
)
from app.services.{module} import {ModelName}Service

router = APIRouter(prefix="/{module_name}s", tags=["{模块中文名}管理"])


@router.post("/", response_model={ModelName}Response, status_code=201)
def create(
    data: {ModelName}Create,
    session: Session = Depends(get_session),
):
    """创建{模块中文名}"""
    try:
        return {ModelName}Service.create(session, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model={ModelName}ListResponse)
def get_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    session: Session = Depends(get_session),
):
    """获取{模块中文名}列表"""
    items, total = {ModelName}Service.get_list(session, page, page_size, keyword)
    return {ModelName}ListResponse(
        items=items, total=total, page=page, page_size=page_size,
    )


@router.get("/{{item_id}}", response_model={ModelName}Response)
def get_by_id(
    item_id: str,
    session: Session = Depends(get_session),
):
    """根据 ID 获取"""
    obj = {ModelName}Service.get_by_id(session, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="资源不存在")
    return obj


@router.put("/{{item_id}}", response_model={ModelName}Response)
def update(
    item_id: str,
    data: {ModelName}Update,
    session: Session = Depends(get_session),
):
    """更新"""
    obj = {ModelName}Service.update(session, item_id, data)
    if not obj:
        raise HTTPException(status_code=404, detail="资源不存在")
    return obj


@router.delete("/{{item_id}}", status_code=204)
def delete(
    item_id: str,
    session: Session = Depends(get_session),
):
    """删除"""
    if not {ModelName}Service.delete(session, item_id):
        raise HTTPException(status_code=404, detail="资源不存在")
```

---

## 5. 注册路由

```python
# app/main.py 中添加
from app.routers import {module}
app.include_router({module}.router, prefix="/api/v1")
```

---

## 6. 快速替换清单

生成新模块时，批量替换以下占位符：

| 占位符 | 示例（用户模块） |
|--------|----------------|
| `{module}` | `user` |
| `{ModelName}` | `User` |
| `{table_name}` | `users` |
| `{module_name}` | `user` |
| `{模块中文名}` | `用户` |
