# 艾联猫 API 接口文档

> 版本：v1.0  
> 最后更新：2026-08-05  
> 基础地址：`http://localhost:8080`  
> 统一响应格式：`Result<T>`

---

## 目录

1. [统一说明](#1-统一说明)
2. [认证模块](#2-认证模块-apiauth)
3. [用户模块](#3-用户模块-apiuser)
4. [主题包模块](#4-主题包模块-apitheme)
5. [分类与标签](#5-分类与标签-apicategory--apitag)
6. [积分模块](#6-积分模块-apipoints)
7. [会员模块](#7-会员模块-apimember)
8. [工单模块](#8-工单模块-apiticket)
9. [附录：状态码说明](#9-附录状态码说明)

---

## 1. 统一说明

### 1.1 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "timestamp": 1690000000000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | int | 状态码，200 成功，其他失败 |
| `message` | string | 提示信息 |
| `data` | T | 响应数据 |
| `timestamp` | long | 时间戳 |

### 1.2 认证方式

使用 **Bearer Token** 认证，在请求头中携带：

```
Authorization: Bearer <access_token>
```

### 1.3 登录流程

1. `POST /api/auth/login` → 获取 `accessToken` + `refreshToken`
2. 后续请求在 Header 中携带 `Authorization: Bearer <accessToken>`
3. 令牌过期时调用 `POST /api/auth/refresh` 刷新
4. 登出时调用 `POST /api/auth/logout`

### 1.5 安全说明

| 原则 | 说明 |
|------|------|
| 最小权限 | 每个接口只暴露必要的数据，不返回角色等敏感信息 |
| 登录不暴露角色 | 登录接口仅对管理员返回 `role` 字段，普通用户登录响应中 `role` 为 `null`，防止权限等级泄露 |
| 用户列表隔离 | 管理员和普通用户的 API 接口分离，避免越权访问 |
| 服务端鉴权 | 所有操作权限在服务端通过 `@PreAuthorize` 校验，前端不可信 |
| 公开接口限制 | 公开接口仅返回已发布的数据，不泄露未审核内容 |
| 敏感操作 | 修改密码、积分兑换、工单创建等操作均需登录认证 |

### 1.4 分页响应格式

```json
{
  "code": 200,
  "data": {
    "records": [ ... ],
    "total": 100,
    "size": 10,
    "current": 1,
    "pages": 10
  }
}
```

---

## 2. 认证模块 `/api/auth`

### 2.1 用户注册

> `POST /api/auth/register` — 公开

**请求体：**

```json
{
  "username": "string (必填, 3-50字符)",
  "password": "string (必填, 6-100字符)",
  "email": "string (可选)",
  "phone": "string (可选)",
  "nickname": "string (可选)"
}
```

**响应：** `Result<Void>`

### 2.2 用户登录

> `POST /api/auth/login` — 公开

**请求体：**

```json
{
  "username": "string (必填)",
  "password": "string (必填)"
}
```

**响应：**

```json
{
  "code": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "userId": 1,
    "username": "admin",
    "role": "ADMIN"
  }
}
```

> **安全说明：** `role` 字段仅在用户为管理员（`ADMIN`）时返回，普通用户登录时此字段为 `null`，防止权限等级泄露。前端通过 `GET /api/user/profile` 获取完整用户信息（含角色）。

### 2.3 刷新令牌

> `POST /api/auth/refresh` — 公开

**请求体：**

```json
{
  "refreshToken": "string (必填)"
}
```

**响应：** 同上登录响应

### 2.4 用户登出

> `POST /api/auth/logout` — 公开

**响应：** `Result<Void>`

---

## 3. 用户模块 `/api/user`

> 所有接口需登录

### 3.1 获取个人信息

> `GET /api/user/profile`

**响应：**

```json
{
  "code": 200,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "phone": "13800138000",
    "avatar": "https://...",
    "nickname": "管理员",
    "signature": "这个人很懒",
    "address": "北京市朝阳区",
    "country": "China",
    "province": "北京市",
    "city": "朝阳区",
    "profile": "个人简介",
    "roleId": 1,
    "roleName": "管理员",
    "roleCode": "ADMIN",
    "createdAt": "2025-01-01T00:00:00"
  }
}
```

### 3.2 更新个人信息

> `PUT /api/user/profile`

**请求体：**

```json
{
  "email": "string (可选)",
  "phone": "string (可选)",
  "avatar": "string (可选)",
  "nickname": "string (可选)",
  "signature": "string (可选)",
  "address": "string (可选)",
  "country": "string (可选)",
  "province": "string (可选)",
  "city": "string (可选)",
  "profile": "string (可选)"
}
```

**响应：** 同上个人信息

### 3.3 修改密码

> `PUT /api/user/password`

**请求体：**

```json
{
  "oldPassword": "string (必填)",
  "newPassword": "string (必填)"
}
```

**响应：** `Result<Void>`

---

## 4. 主题包模块 `/api/theme`

### 4.1 上传主题包

> `POST /api/theme/upload` — 需登录

**请求格式：** `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 主题包名称 |
| `version` | string | 是 | 版本号 |
| `author` | string | 否 | 作者 |
| `description` | string | 否 | 描述 |
| `category` | string | 否 | 分类 |
| `tags` | string | 否 | 标签（逗号分隔） |
| `file` | file | 是 | .alc 文件 |
| `cover` | file | 否 | 封面图片 |
| `source` | int | 否 | 0用户上传 1官方上传（默认0） |

**响应：** `Result<ThemeItem>`

### 4.2 主题包列表

> `GET /api/theme/list` — 公开

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | int | 否 | 页码，默认1 |
| `size` | int | 否 | 每页条数，默认10 |
| `keyword` | string | 否 | 关键词搜索 |
| `category` | string | 否 | 分类筛选 |
| `status` | int | 否 | 状态筛选 |
| `sortBy` | string | 否 | 排序字段 |
| `sortOrder` | string | 否 | asc/desc |

**响应：** `PageResult<ThemeItem>`

### 4.3 主题包详情

> `GET /api/theme/{id}` — 公开

**响应：**

```json
{
  "id": 1,
  "themeId": "uuid",
  "userId": 1,
  "username": "admin",
  "name": "蓝色主题",
  "version": "1.0.0",
  "author": "作者",
  "description": "描述",
  "category": "desktop",
  "tags": "简约,蓝色",
  "coverUrl": "/uploads/cover/...",
  "fileUrl": "/uploads/theme/...",
  "fileSize": 1024000,
  "fileHash": "sha256...",
  "source": 0,
  "ossUrl": "https://r2.dev/theme/...",
  "ossCoverUrl": "https://r2.dev/cover/...",
  "status": 1,
  "viewCount": 100,
  "downloadCount": 50,
  "rating": 4.5,
  "ratingCount": 10,
  "createdAt": "2025-01-01T00:00:00",
  "updatedAt": "2025-01-01T00:00:00",
  "publishedAt": "2025-01-01T00:00:00",
  "reviewComment": "审核通过",
  "reviewedAt": "2025-01-01T00:00:00"
}
```

### 4.4 下载主题包

> `POST /api/theme/{id}/download` — 公开

**说明：** 增加下载计数，前端通过 `oss_url` 或 `file_url` 直接下载

**响应：** `Result<Void>`

### 4.5 我的主题包

> `GET /api/theme/my` — 需登录

**请求参数：** 同列表接口

**响应：** `PageResult<ThemeItem>`

---

## 5. 分类与标签 `/api/category` + `/api/tag`

### 5.1 获取所有分类

> `GET /api/category/list` — 公开

**响应：**

```json
{
  "code": 200,
  "data": [
    { "id": 1, "name": "桌面", "icon": "desktop", "sortOrder": 1, "status": 1 }
  ]
}
```

### 5.2 热门标签

> `GET /api/tag/hot` — 公开

**响应：**

```json
{
  "code": 200,
  "data": [
    { "id": 1, "tagName": "简约", "useCount": 100, "createdAt": "..." }
  ]
}
```

---

## 6. 积分模块 `/api/points`

> 所有接口需登录

### 6.1 获取积分余额

> `GET /api/points/balance`

**响应：**

```json
{
  "code": 200,
  "data": {
    "balance": 1234,
    "totalEarned": 5000,
    "totalSpent": 3766,
    "monthlyEarned": 200,
    "monthlySpent": 50,
    "checkedInToday": false,
    "checkinStreak": 3
  }
}
```

### 6.2 积分流水

> `GET /api/points/records`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | int | 否 | 默认1 |
| `size` | int | 否 | 默认20 |
| `type` | int | 否 | 类型筛选：1上传 2下载 3收藏 4好评 5签到 6分享 7邀请 8兑换 9系统 |

**响应：** `PageResult<PointsRecord>`

```json
{
  "id": 1,
  "userId": 1,
  "amount": 50,
  "type": 1,
  "sourceId": 100,
  "description": "主题包审核通过",
  "balance": 1050,
  "createdAt": "2025-01-01T00:00:00"
}
```

### 6.3 每日签到

> `POST /api/points/checkin`

**响应：**

```json
{
  "code": 200,
  "data": {
    "points": 5,
    "total": 1234,
    "streak": 3
  }
}
```

### 6.4 积分兑换

> `POST /api/points/exchange`

**请求体：**

```json
{
  "exchangeType": 1,
  "targetId": null
}
```

| exchangeType | 说明 | 所需积分 |
|:---:|------|:---:|
| 1 | 高级会员(月) | 2000 |
| 2 | 高级会员(年) | 20000 |
| 3 | 下载次数×10 | 50 |
| 4 | AI生成×10 | 30 |

**响应：**

```json
{
  "code": 200,
  "data": {
    "success": true,
    "newBalance": 1000,
    "message": "兑换成功，已扣除2000积分"
  }
}
```

### 6.5 兑换记录

> `GET /api/points/exchange/history`

**请求参数：** `page`, `size`

**响应：** `PageResult<PointsExchange>`

### 6.6 积分规则

> `GET /api/points/rules` — 公开

**响应：**

```json
{
  "code": 200,
  "data": [
    { "id": 1, "actionType": 1, "basePoints": 50, "dailyLimit": 150, "multiplier": 1, "status": 1 }
  ]
}
```

### 6.7 积分排行榜

> `GET /api/points/rank` — 公开

**请求参数：** `limit`（默认10）

**响应：**

```json
{
  "code": 200,
  "data": [
    { "id": 1, "username": "admin", "balance": 5000 }
  ]
}
```

### 6.8 商城商品列表

> `GET /api/points/mall/list` — 公开

**说明：** 获取可兑换的商品列表（仅已上架）

**响应：** `PageResult<PointsMallItem>`

---

## 7. 会员模块 `/api/member`

### 7.1 可购买套餐列表

> `GET /api/member/plans` — 公开

**响应：**

```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "高级会员(月)",
      "description": "解锁所有高级主题包",
      "price": 9.90,
      "durationDays": 30,
      "level": 1,
      "benefits": "...",
      "status": 1
    }
  ]
}
```

### 7.2 卡密兑换

> `POST /api/member/card/redeem` — 需登录

**请求体：**

```json
{
  "code": "ALCX7K2M9F4R1Q3"
}
```

**响应：** `Result<Void>`

### 7.3 创建订单（购买会员）

> `POST /api/member/order/create` — 需登录

**请求体：**

```json
{
  "planId": 1,
  "method": "easypay"
}
```

| method | 说明 |
|--------|------|
| `easypay` | 易支付（直接完成支付并激活） |
| `alipay` | 支付宝（返回订单，等待支付回调） |
| `wxpay` | 微信支付（同上） |

**响应：**

```json
{
  "code": 200,
  "data": {
    "id": 1,
    "orderNo": "ORD...",
    "amount": 9.90,
    "paymentMethod": "easypay",
    "status": 1,
    "paidAt": "2025-01-01T00:00:00"
  }
}
```

### 7.4 当前会员信息

> `GET /api/member/my` — 需登录

**响应：**

```json
{
  "code": 200,
  "data": {
    "id": 1,
    "userId": 1,
    "planId": 1,
    "level": 1,
    "startDate": "2025-01-01T00:00:00",
    "endDate": "2025-01-31T00:00:00",
    "source": 1,
    "sourceId": 1
  }
}
```

### 7.5 我的订单

> `GET /api/member/my/orders` — 需登录

**请求参数：** `page`, `size`

**响应：** `PageResult<PaymentOrder>`

---

## 8. 工单模块 `/api/ticket`

### 8.1 创建工单

> `POST /api/ticket` — 需登录

**请求体：**

```json
{
  "title": "无法下载主题包",
  "content": "点击下载按钮无反应",
  "category": "bug",
  "priority": 2,
  "images": "[\"https://...\"]"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 标题 |
| `content` | string | 是 | 内容 |
| `category` | string | 否 | feature/bug/question/other |
| `priority` | int | 否 | 1低 2中 3高 4紧急 |
| `images` | string | 否 | 图片URL数组JSON |

### 8.2 工单列表

> `GET /api/ticket/list` — 公开

**请求参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | int | 默认1 |
| `size` | int | 默认10 |
| `status` | int | 0待处理 1处理中 2已回复 3已关闭 |
| `keyword` | string | 关键词搜索 |

### 8.3 我的工单

> `GET /api/ticket/my` — 需登录

**请求参数：** `page`, `size`, `status`

### 8.4 工单详情

> `GET /api/ticket/{id}` — 公开

### 8.5 回复工单

> `POST /api/ticket/{id}/reply` — 需登录

**请求体：**

```json
{
  "content": "已解决，请确认",
  "images": "[\"https://...\"]"
}
```

### 8.6 获取回复列表

> `GET /api/ticket/{id}/replies` — 公开

**响应：**

```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "ticketId": 1,
      "userId": 1,
      "content": "回复内容",
      "images": "[\"https://...\"]",
      "isStaff": 1,
      "createdAt": "2025-01-01T00:00:00"
    }
  ]
}
```

---

## 9. 附录：状态码说明

### 9.1 通用状态码

| code | 说明 |
|:---:|------|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | 未认证/令牌过期 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 9.2 主题包状态

| status | 说明 |
|:---:|------|
| 0 | 待审核 |
| 1 | 已发布 |
| 2 | 已驳回 |
| 3 | 已下架 |

### 9.3 工单状态

| status | 说明 |
|:---:|------|
| 0 | 待处理 |
| 1 | 处理中 |
| 2 | 已回复 |
| 3 | 已关闭 |

### 9.4 积分类型

| type | 说明 |
|:---:|------|
| 1 | 上传主题包 |
| 2 | 主题包被下载 |
| 3 | 主题包被收藏 |
| 4 | 获得好评 |
| 5 | 每日签到 |
| 6 | 分享 |
| 7 | 邀请好友 |
| 8 | 兑换消耗 |
| 9 | 系统赠送 |

### 9.5 会员等级

| level | 说明 |
|:---:|------|
| 1 | 高级会员 |
| 2 | 专业版 |

### 9.6 主题包来源

| source | 说明 |
|:---:|------|
| 0 | 用户上传 |
| 1 | 官方上传 |