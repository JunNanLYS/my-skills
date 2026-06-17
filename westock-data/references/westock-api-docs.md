# westock-data 接口逆向文档（完整版 · 49 命令）

> 逆向来源：`C:\Users\18906\.claude\skills\westock-data\scripts\index.js`（3.2MB bundle）
> 逆向时间：2026-06-17
> 逆向方法：Node `--import=prehook.mjs` 注入 prehook，拦截 `http`/`https`/`fetch` 模块
> 覆盖范围：49 个命令（westock-data 全部命令）
> 抓包文件：73 个（位于 `captures/`），见 §10「抓包文件索引」

---

## 0. 通用鉴权

所有请求 URL 共享以下 query：

| 参数 | 值 |
|------|---|
| `app` | `openclaw` |
| `token` | `99359fcc033b30b5f33a5c825ad9de81fd66a6337781834040af835a2099a553`（**硬编码、无过期**） |
| `skill_channel` | `workbuddy` |

**装饰性 Header（服务端不校验）**：

| Header | 实测 |
|--------|------|
| `x-nonce` | 任意数字串；省略也行 |
| `x-timestamp` | 任意毫秒；省略也行 |
| `x-signature` | 任意 64 字符；省略也行 |

bundle 3.2MB 中**没有** `crypto` / `subtle` / `sha256` / `hmac` 关键字。已用 `deadbeef` 签名 / 完全省略签名 验证过：3 个域名、12 个端点**均返回 200**。

---

## 1. 全局架构：3 域名 × 19 端点

| # | 域名 | Method | Path | 对应命令 |
|---|------|--------|------|----------|
| 1 | `proxy.finance.qq.com` | POST | `/cgi/cgi-bin/openai/openclaw/proxy` | **28 个命令**走 route 区分 |
| 2 | `proxy.finance.qq.com` | GET  | `/cgi/cgi-bin/smartbox/search` | `search` |
| 3 | `proxy.finance.qq.com` | GET  | `/ifzqgtimg/appstock/app/minute/query` | `minute` |
| 4 | `proxy.finance.qq.com` | GET  | `/ifzqgtimg/appstock/app/board/index` | `board` |
| 5 | `proxy.finance.qq.com` | GET  | `/ifzqgtimg/appstock/app/FinanceCalendar/query` | `calendar` |
| 6a| `proxy.finance.qq.com` | GET  | `/ifzqgtimg/appstock/app/HotStock/getHotStockDetail` | `hot stock` |
| 6b| `proxy.finance.qq.com` | GET  | `/ifzqgtimg/appstock/app/HotStock/getWxHotStock` | `hot wx` |
| 6c| `proxy.finance.qq.com` | GET  | `/ifzqgtimg/appstock/app/HotStock/getHotRankBK` | `hot board` |
| 6d| `proxy.finance.qq.com` | GET  | `/ifzqgtimg/mktJJ/hotFund` | `hot etf` |
| 6e| `proxy.finance.qq.com` | GET  | `/ifzqgtimg/appstock/app/HotStock/getHotNews` | `hot news` |
| 7a| `proxy.finance.qq.com` | GET  | `/ifzqfinance/stock/notice/ipo/search` | `ipo hs/hk` |
| 7b| `proxy.finance.qq.com` | GET  | `/ifzqfinance/stock/notice/ipo/getIpo2` | `ipo us` |
| 8a| `proxy.finance.qq.com` | GET  | `/cgi/cgi-bin/watchlist/rank` | `watchlist rank` |
| 8b| `proxy.finance.qq.com` | GET  | `/cgi/cgi-bin/watchlist/detail` | `watchlist detail` |
| 9 | `proxy.finance.qq.com` | GET  | `/ifzqgtimg/appstock/news/content/content` | `ncontent` |
| 10| `ifzq.gtimg.cn` | GET  | `/appstock/news/info/search` | `news`, `marketnews` |
| 11| `ifzq.gtimg.cn` | GET  | `/appstock/news/NewsProxy/get` | `newsdetail` |
| 12| `ifzq.gtimg.cn` | GET  | `/appstock/news/noticeList/searchByType` | `notice` |
| 13| `ifzq.gtimg.cn` | GET  | `/appstock/app/investRate/getReport` | `report` |
| 14| `wzq.tenpay.com` | GET  | `/cgi/cgi-bin/longhubang/lhbDetail` | `lhb` |

每个命令 → 端点对应关系见后文 §3 「命令清单」。

---

## 2. 主端点：openclaw proxy 的 5 个 route

`POST /cgi/cgi-bin/openai/openclaw/proxy` 承担 28 个命令，靠 `body.route` 字段区分。

### 公共请求结构

```json
POST https://proxy.finance.qq.com/cgi/cgi-bin/openai/openclaw/proxy?app=openclaw&token=<TOKEN>&skill_channel=workbuddy
Headers:
  content-type: application/json
  user-agent: Mozilla/5.0
  (x-nonce / x-timestamp / x-signature — 装饰性，可省)

Body:
{
  "token": "<TOKEN>",
  "route": "<route 名称>",
  "params": { ... 业务参数 ... }
}
```

### 5 个 route 一览

| route | 命令数 | 说明 |
|-------|--------|------|
| `stock_quote_snapshot` | 20 | 即时快照型：quote / rating / consensus / chip / asfund / hkfund / usfund / margintrade / blocktrade / profile / reserve / exdiv / shareholder / risk / etf / etf-holdings / etf-holders / etf-company / etf-financial / suspension |
| `stock_quote_history` | 8 | 时序型：kline / finance / dividend / buyback / etf-nav / risk（日期型 risk）/ shareholder（SHNum A股） / usfund |
| `query_list_data_by_date` | 4 | 列表/成份股：sector / lgt / index / macro |
| `stock_filter_query` | 2 | 过滤型：changedist / suspension |
| `research_report_list_get` | 1 | 研报列表：dehydrated |
| `research_report_detail_get` | 1 | 研报详情：dehydrated detail |

---

## 3. 完整命令清单（49 个）

### 类别 A：行情 (4)

#### `quote`（实时行情） — route=`stock_quote_snapshot`

**params**：
```json
{ "codes": "sh600519,sz000001", "fields": "ClosePrice,OpenPrice,..." }
```

**fields 完整列表**（34 项）：
```
ClosePrice, OpenPrice, PrevClosePrice, HighPrice, LowPrice,
ChangePCT, ChangePrice, RangePCT,
TurnoverVolume, TurnoverValue, TurnoverRate, VolumeRatio,
PE_TTM, PE_Fwd, PE_Lyr, PB, PS_TTM, PCF_TTM,
TotalMV, NegotiableMV, TotalShares, FloatShares,
DividendRatioTTM, Week52High, Week52Low,
Chg5D, Chg10D, Chg20D, Chg60D, ChgYtd,
PeTTM, PbLF, PsTTM, PcfTTM, DivTTM, DivTTM2
```

**响应 data**：
```json
{ "stocks": [{ "code": "sh600519", "name": "贵州茅台", "data": {...} }] }
```

**注意**：港股代码 `hk00700` 走 HKD；美股 `usAAPL` 走 USD。

---

#### `kline`（K线） — route=`stock_quote_history`

**params**：
```json
{
  "code": "sh600519",
  "start_date": "2026-06-04",
  "end_date": "2026-06-17",
  "fields": "OpenPrice,ClosePrice,HighPrice,LowPrice,
             FwdOpenPrice,FwdClosePrice,FwdHighPrice,FwdLowPrice,
             BwdOpenPrice,BwdClosePrice,BwdHighPrice,BwdLowPrice,
             TurnoverVolume,TurnoverValue,TurnoverRate"
}
```

- 周期：day / week / month / season / year
- A股 `Fwd*Price` 是**前复权**价格（脚本默认 `qfq`）
- `Bwd*Price` A股返回无意义小数；港股美股**所有价格字段都不复权**
- 复权字段：脚本传 `qfq` 时 `Fwd*` 有值；`hfq` 时 `Bwd*` 有值；`bfq` 时只有 `OpenPrice`/`ClosePrice` 等

**响应 data**：
```json
{ "code": "sh600519", "name": "贵州茅台",
  "series": [{ "data": { "EndDate": "2026-06-04", "ClosePrice": "...", ... } }, ...] }
```

---

#### `minute`（分时） — GET `/ifzqgtimg/appstock/app/minute/query`

**Query**：`?code=sh600519&p=1`（p=1 当日 / p=5 五日）

**响应**：
```json
{ "code": 0, "data": { "sh600519": { "data": { "data": [
  "0930 1258.00 307 38620600.00",   // HHMM 价格(元) 成交量(手) 成交额(元)
  "0931 1258.49 1166 146719100.94",
  ...
] } } } }
```

---

#### `changedist`（涨跌区间分布） — route=`stock_filter_query`

**params**（每个区间一个请求）：
```json
{
  "selector": {
    "expression": "intersect([ClosePrice = PriceCeiling, PriceCeiling > 0])",
    "date": "2026-06-17",
    "limit": 1
  },
  "fields": [{ "metric": "SecuCode", "name": "代码" }]
}
```

**实测脚本发出的 10 个 expression**：
```
TotalMV > 0                                       (全市场)
intersect([ClosePrice = PriceCeiling, PriceCeiling > 0])  (涨停)
intersect([ClosePrice = PriceFloor, PriceFloor > 0])      (跌停)
intersect([ClosePrice = PrevClosePrice])          (平盘)
intersect([ChangePCT >= 0.05, ChangePCT < 0.099])  (5~10% 涨)
intersect([ChangePCT >= 0])                        (上涨)
intersect([ChangePCT < 0, ChangePCT >= -0.05])     (-5~0% 跌)
intersect([ChangePCT < -0.05])                     (-10~-5% 跌)
intersect([ChangePCT >= 0.099])                    (>=10% 涨)
intersect([ChangePCT <= -0.099])                   (<=-10% 跌)
```

**响应**：`data.count` 字段是股票数。

---

### 类别 B：财务 (2)

#### `finance`（财报） — route=`stock_quote_history`

**3 套 fields（按市场区分）**：

| 市场 | CLI `--type` | 字段集起始 |
|------|--------------|------------|
| A 股 | `lrb` / `zcfz` / `xjll` | `InfoPublDate, EnterpriseType, TotalOperatingRevenue, ...` |
| 港股 | `zhsy` / `zcfz` / `xjll` | `InfoPublDate, EnterpriseType, CurrencyType, CurrencyUnit, PeriodMark, ReportType, OperatingIncome, ...` |
| 美股 | `income` / `balance` / `cashflow` | `SecuCodeSurfix, DisclosureCurrency, ShowCurrency, FinancialYear, Sales, Cogs, GrossIncome, ...` |

**注意**：**fields 长度差异巨大**（A 股 36 项、港股 ~150 项、美股 ~140 项），关键字段命名也不同：
- A 股用 `OperatingRevenue` / `TotalOperatingCost` / `NPParentCompanyOwners`
- 港股用 `OperatingIncome` / `OperExpenses`（注意 `OperatingIncome` ≠ A 股的同名字段）
- 美股用 `Sales` / `Cogs` / `GrossIncome` / `EBIT` / `PretaxIncome` / `IncomeTa...`

**params**（A 股示例）：
```json
{
  "code": "sh600519",
  "start_date": "2025-09-30",
  "end_date": "2025-12-31",
  "fields": "InfoPublDate,EnterpriseType,TotalOperatingRevenue,TotalOperatingCost,OperatingRevenue,OperatingCost,OperatingPayout,TotalAdminExpense,OperatingExpense,RAndD,FinancialExpense,OperatingProfit,TotalProfit,NPParentCompanyOwners,BasicEPS,DilutedEPS,PremiumsEarned,NetProxySecuIncome,NetSubIssueSecuIncome,NetTrustIncome,TotalOperatingRevenue_Q,TotalOperatingCost_Q,OperatingRevenue_Q,OperatingCost_Q,OperatingPayout_Q,TotalAdminExpense_Q,OperatingExpense_Q,RAndD_Q,FinancialExpense_Q,OperatingProfit_Q,TotalProfit_Q,NPParentCompanyOwners_Q,BasicEPS_Q,GrossProfitTTM,GrossProfit_TTM"
}
```

- `--num N` 控制返回多少期（按 `EndDate` 倒序）
- 货币单位在 fields 里用 `CurrencyType` / `CurrencyUnit`（港股）、`DisclosureCurrency` / `ShowCurrency`（美股）显式标记

---

#### `profile`（公司简况） — route=`stock_quote_snapshot`

**fields**：
```
SecuName, CompanyName, ListedDate, MainBusiness, Website,
SW1Name, SW2Name, SW3Name,
IssuePrice, RegCapital, EstablishDate,
LegalRep, RegAddress, OfficeAddress,
ContactTel, ContactEmail
```

---

### 类别 C：资讯与研究 (8)

#### `rating`（机构评级） — route=`stock_quote_snapshot`

**fields**：
```
ResearchReport, ForecastInstitutions,
TargetPriceAvg, TargetPriceMax, TargetPriceMin,
RatingBuyCnt, RatingIncCnt, RatingHoldCnt, RatingDecCnt, RatingSellCnt, RatingCnt
```

#### `consensus`（一致预期） — route=`stock_quote_snapshot`

**fields**：`ConEarningsForecast, ConTargetPrice`

#### `report`（研报列表） — GET `ifzq.gtimg.cn/appstock/app/investRate/getReport`

**Query**：`?symbol=sh600519&n=20&page=1&withConference=1`

- `withConference=1` 含业绩会，`0` 不含
- 响应 `data.data[]` 每项含 `id`（格式 `resXXXXXXXXXXX`）、`title`、`time` 等

#### `dehydrated`（脱水研报） — route=`research_report_list_get`

**params**：
```json
{ "page": 1, "size": 20, "type": 1 }
```

- `type=1` 列表模式
- 响应 `data.data[]` 含 `id`（数字串，如 `1183`）、`title`、`report_time`、`author` 等

#### `dehydrated detail <id>`（脱水研报详情） — route=`research_report_detail_get`

**params**：
```json
{ "id": "1183" }
```

- 响应 `data.data.content` 字段为**HTML 字符串**正文（含图片标签 `<img src="https://zixuntong-...">`）
- 响应 `data.full_text` 也是正文字段（可能与 content 重复或为不同来源）
- 响应 `data.data` 还含 `author`、`title` 等元信息

#### `news`（个股新闻） — GET `ifzq.gtimg.cn/appstock/news/info/search`

**Query**：`?symbol=sh600519&n=20&page=1&type=2`

- `type=0` 公告 / `type=1` 研报 / `type=2` 新闻 / `type=3` 全部
- 响应项含 `id`（如 `nesSN20260617161512a6aa777a`）、`time`、`title`、`source` 等

#### `marketnews`（市场资讯） — 同 `news` 端点

- `symbol=sh000001` 沪深 / `sz399001` 深成 / `hkHSI` 恒生 / `us.IXIC` 纳指
- 或 `symbol=hs` 沪深整体 / `hk` 港股整体 / `us` 美股整体

#### `newsdetail`（新闻详情） — GET `ifzq.gtimg.cn/appstock/news/NewsProxy/get`

**Query**：`?ids=<news_id>&nkey=getQQNewsListItems`

- `news_id` 来自 `news` 命令响应项的 `id` 字段（格式 `nesSN...`）
- 响应 `data.data[]`：每项含 `title`、`content`、`time`、`source` 等
- **注意**：本端点也支持 `ids=id1,id2,id3` 批量查询

**响应字段**：
```json
{
  "code": 0, "data": {
    "data": [{
      "id": "nesSN...", "title": "...", "content": "正文 HTML ...",
      "time": "2026-06-17 16:15:12", "source": "...",
      "symbol": "sh600519", "type": 2
    }]
  }
}
```

#### `notice`（公告列表） — GET `ifzq.gtimg.cn/appstock/news/noticeList/searchByType`

**Query**：`?symbol=sh600519&n=20&page=1&noticeType=0`

- `noticeType`: 0=全部 1=财务 2=配股 3=增发 4=股权变动 5=重大事项 6=风险 7=其他
- 响应项含 `id`（如 `nos1225366265`）、`title`、`time`

#### `ncontent`（公告内容） — GET `proxy.finance.qq.com/ifzqgtimg/appstock/news/content/content`

**Query**：`?id=<notice_id>`

- 沪深 `nos<id>`：返回 `data[]` 数组，含 `url` 跳转到详情页 + `pdf` 字段为 PDF URL
- 港股 `nok<id>` / 美股 `nou<id>`：返回 PDF URL 字段
- 响应项的 `url` 字段形如 `http://stockhtm.finance.qq.com/sstock/quotpage/q/600519.htm#notice-detail?id=...`

**响应字段**：
```json
{
  "code": 0, "data": [{
    "id": "1225366265", "title": "...",
    "time": "2026-06-11 20:55:04",
    "url": "http://stockhtm.finance.qq.com/.../notice-detail?id=...",
    "pdf": "http://file.finance.qq.com/finance/hs/pdf/..."
  }]
}
```

---

### 类别 D：资金分析 (6)

#### `asfund`（A股主力资金） — route=`stock_quote_snapshot`

**fields**：
```
MainNetFlow, JumboNetFlow, BlockNetFlow, MidNetFlow, SmallNetFlow,
MainInFlow, MainOutFlow, RetailInFlow, RetailOutFlow,
MainNetFlow5D, MainNetFlow10D, MainNetFlow20D,
MainInflowRank, MainInflowCircRate, MainInflowIndustryRank,
MarginTradeInfos, BlockTradingInfos, ClosePrice
```

**params**：
```json
{ "codes": "sh600519", "date": "2026-06-10", "fields": "..." }
```

也支持 `start_date` / `end_date` 区间。

#### `hkfund`（港股资金） — route=`stock_quote_snapshot`

**fields**：
```
TotalNetFlow, MainNetFlow, RetailNetFlow,
MainIn, MainOut, RetailIn, RetailOut,
AvgDealPrice, MainAvgDealPrice, RetailAvgDealPrice,
ShortShares, ShortAmount, ShortRatio, LgtHoldInfo, ClosePrice
```

#### `usfund`（美股卖空） — route=`stock_quote_history` ⚠

**fields**：`ShortRatio, ShortShares, ShortRecoverDays, ClosePrice`

**注意**：用 history route（不是 snapshot）。**响应** `data.series[]`。

#### `blocktrade`（大宗交易） — route=`stock_quote_snapshot`

**fields**：`SecuCode, SecuName, EndDate, ClosePrice, ChangePCT, BlockTradingInfos`

#### `margintrade`（融资融券） — route=`stock_quote_snapshot`

**fields**：`SecuCode, SecuName, EndDate, ClosePrice, ChangePCT, MarginTradeInfos`

#### `buyback`（公司回购） — route=`stock_quote_history`

**fields**：`BuybackAttach, ClosePrice`

---

### 类别 E：技术 & 筹码 (2)

#### `technical`（技术指标） — route=`stock_quote_snapshot`

**fields**（按 group 拼接）：
- `ma`：`MA5, MA10, MA20, MA60`
- `macd`：`DIF, DEA, MACD`
- `kdj`：`KDJ_K, KDJ_D, KDJ_J`
- `rsi`：`RSI6, RSI12, RSI24`
- `boll`：`BOLL_UP, BOLL_MID, BOLL_LOW`
- `bias`：`BIAS6, BIAS12, BIAS24`
- `wr`：`WR10, WR6`
- `dmi`：`DMI_PDI, DMI_MDI, DMI_ADX, DMI_ADXR`
- `all` 全部

**params**：
```json
{ "codes": "sh600519", "fields": "ClosePrice,DIF,DEA,MACD", "date": "2026-06-17" }
```

#### `chip`（筹码成本，仅 A股） — route=`stock_quote_snapshot`

**fields**：`SecuName, ClosePrice, ChipProfitRate, ChipAvgCost, ChipConcentration90, ChipConcentration70`

---

### 类别 F：基本面 (5)

#### `shareholder`（股东研究） — A股 2 个请求；港股 1 个；美股不支持

- **A 股**：
  1. `stock_quote_snapshot` + fields `Top10Shareholder, Top10FloatShareholder`（十大股东+流通股东）
  2. `stock_quote_history` + fields `SHNum`（股东户数，start_date/end_date 区间）
- **港股**：`stock_quote_snapshot` + fields `ShareholderInfo, ShareholderDist, InstHoldingStats`（机构持仓统计）
- **美股**：脚本直接拒绝，提示 "美股无数据源"

#### `dividend`（分红） — route=`stock_quote_history`

**fields**：`DividendPlans`（A/港/美通用）

**params**：
```json
{ "code": "sh600519", "start_date": "2024-06-17", "end_date": "2026-06-17" }
```

#### `exdiv`（分红除权日） — route=`stock_quote_snapshot`

**fields**：根据市场区分
- A/港股：`DividendPlans`
- 美股：`DividendInfo`

**params**：
```json
{ "codes": "sh600519,usAAPL,hk00700", "fields": "DividendPlans" }
```
（多市场混合时，按是否包含美股决定 fields）

#### `reserve`（业绩预告/财报披露日） — route=`stock_quote_snapshot`

**fields**：`PerformanceReserve`

#### `suspension`（停复牌列表） — route=`stock_filter_query`

**params**：
```json
{
  "selector": {
    "date": "2026-06-17",
    "expression": "intersect([Ifsuspend = 1])",
    "limit": 5000
  },
  "fields": [{ "metric": "StockName", "name": "股票名称" }]
}
```

**注意**：market 参数 `hs` / `hk` / `us` 由客户端**额外发出**不同 market 的查询。

---

### 类别 G：市场发现 (6)

#### `search`（股票搜索） — GET `/cgi/cgi-bin/smartbox/search`

**Query**：
```
?stockFlag=1&fundFlag=0&ptFlag=0
&ManagerFlag=0&correctFlag=0&eduFlag=0&funcFlag=0
&labelFlag=0&mixFlag=0&newsFlag=0&outerFundFlag=0
&userFlag=0&xuanguFlag=0
&query=茅台
```

**响应**（顶层 6 个并列字段）：
```json
{
  "stock":     [{ "code": "sh600519", "name": "贵州茅台", "type": "GP-A", ... }],
  "sector":    [...],   // 仅名称+代码
  "news":      { "news_list": [...], "has_next": 0 },
  "fund":      [...],
  "function":  [...],
  "manager":   [...],
  "relatedFund": {...}
}
```

**`--sector`** 只设 `ptFlag=1`；**`--fund`** 只设 `fundFlag=1`。

---

#### `hot`（热搜） — 5 个端点，按 kind 区分

| CLI  | Endpoint |
|------|----------|
| `hot stock` | `/ifzqgtimg/appstock/app/HotStock/getHotStockDetail` |
| `hot wx` | `/ifzqgtimg/appstock/app/HotStock/getWxHotStock` |
| `hot board` | `/ifzqgtimg/appstock/app/HotStock/getHotRankBK` |
| `hot etf` | `/ifzqgtimg/mktJJ/hotFund` |
| `hot news` | `/ifzqgtimg/appstock/app/HotStock/getHotNews` |

**Query**（所有 5 个端点）：`?num=20`

- 响应 `data.stock[]`（stock/wx）或 `data.board[]`（board）或 `data.fund[]`（etf）或 `data.news[]`（news）
- 字段：`code`, `name`, `zdf` (涨跌幅%), `zxj` (最新价), `status`, `stock_type`

---

#### `watchlist rank`（股单列表） — GET `/cgi/cgi-bin/watchlist/rank`

**Query**：`?board_type=all&count=20&offset=0&sort_type=updateTime&direct=down`

- 列表：`data.list[]`，每项 `info.id`（如 `gd000931`）可用于查详情
- `sort_type`: `updateTime` / `viewNum` / `followerCnt` 等
- `direct`: `down` / `up`

#### `watchlist <id>`（股单详情） — GET `/cgi/cgi-bin/watchlist/detail`

**Query**：`?id=gd000931&curvetype=day`

- 响应 `data.detail.info`：含 `id`、`name`、`desc`、`smallImg`、`bigImg`、`createTime`、`modifyTime`
- 响应 `data.detail.userData`：含 `watched`、`watchedNum`、`shareCount` 等
- 响应 `data.detail.holdings[]`：股单中的股票列表
- `curvetype=day` 是默认曲线类型，响应 `data.detail.curve` 可能含走势图数据

---

#### `board`（行业板块首页） — GET `/ifzqgtimg/appstock/app/board/index`

无参数。响应 `data.fundflow.plate.top[]`（按资金流入排序的板块）。

---

#### `calendar`（投资日历） — GET `/ifzqgtimg/appstock/app/FinanceCalendar/query`

**Query**：`?date=2026-06-17&limit=30&country=1&indicator=1`

- `country`: 1=中国 2=美国 3=港股
- `indicator`: 1=经济 2=央行 3=事件 4=休市

---

#### `ipo`（新股日历） — 不同 market 走不同端点

| CLI | Endpoint |
|-----|----------|
| `ipo hs` / `ipo hk` | `/ifzqfinance/stock/notice/ipo/search` |
| `ipo us` | `/ifzqfinance/stock/notice/ipo/getIpo2` |

**Query（A 股/港股）**：`?market=hs&period=30&sgrq=1&detail=1`

- `market`: hs / hk
- `period`: 天数
- `sgrq=1` 申购日；`sgrq=0` 上市日
- 响应 `data.sgok[]`（已申购）、`data.sgrq[]`（申购中）、`data.ssrq[]`（已上市）、`data.zqh[]`（即将）

**Query（美股）**：无参数

- 响应 `data.list[]`：含 `symbol`、`name`、`price`、`syl`（市盈率）、`volume`、`sgdm`、`ssrq`、`zjjdr` 等

---

### 类别 H：市场数据 (3)

#### `lgt`（陆股通成份股） — route=`query_list_data_by_date`

**params**：
```json
{ "list_codes": ["sh_connected_stocks"], "date": "2026-06-17" }
// 或
{ "list_codes": ["sz_connected_stocks"], "date": "2026-06-17" }
```

**响应 data.data[list_code].list_data**：JSON 字符串，含 `StockCode`, `StockName`, `SecuCode`。

---

#### `lhb`（龙虎榜） — GET `wzq.tenpay.com/cgi/cgi-bin/longhubang/lhbDetail`

**Query**：`?tab=jg&date=2026-06-17`（也支持 `stockType=` 等可选参数）

- `tab`:
  - `jg` 机构榜
  - `yzb` 游资榜
  - `yyb` 活跃营业部
  - `gslmr` 高胜率买入
  - `gslxw` 高胜率席位
  - `all` 全部

**响应**：
```json
{ "code": 0, "data": { "date": "2026-06-17",
  "all": null, "jg": [["sz300285","国瓷材料","3",4,1052603246.21,16.42,2894367650.84,1841764404.63,20.58,1,{"hotMoney":[]}]],
  "yyb": null, "gslmr": null, "gslxw": null, "yzb": null } }
```

`jg[]` 每项是数组：`[code, name, ?, count, netBuy, changePct, totalAmt, totalAmtBuy, ratio, ?, {hotMoney}]`

---

#### `sector`（板块） — route=`query_list_data_by_date`

**`--list` / `--types` / `--search` / `--rank` 都是本地 hardcoded**（不发网络请求），从内置表里读取可用清单名。真正发请求的只有 `sector <code>` 查成份股。

**`sector <code>` 的真实行为**：
1. 客户端先发 1 个请求：拉取 6 个 list 的板块清单
   ```json
   { "list_codes": ["industry_list_sw1","industry_list_sw2","industry_list_sw3",
                    "concept_list_area","concept_list_industry","concept_list_style"],
     "date": "2026-06-17" }
   ```
2. 客户端本地查找 `code` 属于哪个清单，按下表加前缀
3. 客户端再发 1 个请求：`list_codes=["comp_<前缀><code>"]`

**板块代码 → `comp_` 前缀映射（实测，可能与 `--types` 文档不一致）**：

| 清单 | 数量 | 前缀 | 示例 |
|------|------|------|------|
| `industry_list_sw1` (申万一级) | 31  | `comp_sw1_` | `pt01801750` 计算机 |
| `industry_list_sw2` (申万二级) | 124 | `comp_sw2_` | `pt01801081` 半导体 |
| `industry_list_sw3` (申万三级) | 259 | `comp_sw3_` | `pt01850716` |
| `concept_list_area` (地域) | 31  | `comp_area_` | `pt03001170` 重庆 |
| `concept_list_industry` (产业) | 719 | **`comp_indus_`** ⚠ | `pt02GN2266` 华为算力 |
| `concept_list_style` (风格) | 78  | `comp_indus_` ⚠ | `pt02031027` MSCI概念 |

⚠️ **注意**：`concept_list_industry` 和 `concept_list_style` 共用 `comp_indus_` 前缀（脚本命名混乱，与 `--types` 文档说的 `comp_industry_` / `comp_indus_` 并不一致）。**别用 `--types` 输出推断实际请求**。

**`sector --search <kw>`** 的行为：发 1 个请求拉所有 6 个清单 → 本地匹配 `SectorName` 包含关键词的板块 → 输出表格。
**`sector --rank <list>`** 的行为：发 1 个请求 `list_codes=["interval_chg_rank_sw1"]`（或 sw2/sw3/industry/style/area），`sort` 参数**不**透传给服务端。

**响应 data.data[list_code].list_data**：JSON 字符串，含 `SectorCode`, `StockCode`, `StockName`。

---

#### `sector --list`（板块清单代码列表，本地输出）

```
industry_list_sw1                申万一级行业清单
industry_list_sw2                申万二级行业清单
industry_list_sw3                申万三级行业清单
concept_list_area                聚源地域概念清单
concept_list_industry            聚源产业概念清单
concept_list_style               聚源风格概念清单
```

#### `sector --types`（板块代码前缀格式，本地输出）

```
comp_sw1_XXXX                    申万一级行业
comp_sw2_XXXX                    申万二级行业
comp_sw3_XXXX                    申万三级行业
comp_area_XXXX                   地域概念
comp_style_XXXX                  产业概念    ← 文档是 comp_style_，实测 comp_indus_
comp_indus_XXXX                  风格概念    ← 文档是 comp_indus_，实测也是 comp_indus_
```

#### `sector --rank`（排行清单代码列表，本地输出）

```
interval_chg_rank_sw1            申万一级行业区间涨幅榜
interval_chg_rank_sw2            申万二级行业区间涨幅榜
interval_chg_rank_sw3            申万三级行业区间涨幅榜
interval_chg_rank_industry       聚源产业概念区间涨幅榜
interval_chg_rank_style          聚源风格概念区间涨幅榜
interval_chg_rank_area           聚源地域概念区间涨幅榜
```

---

#### `index`（指数） — route=`query_list_data_by_date`

**`index <code>`**（指数成份股）**`index --list`**（指数清单）**`index --search`**（本地 filter）三类操作。

**`index --list` 实际请求**：
```json
{ "list_codes": ["index_list"], "date": "2026-06-17" }
```
返回所有指数的代码/名称列表。

**`index --search <kw>`** 行为：先发 `--list` 拉清单 → 本地 filter `IndexName`/`IndexCode` 包含关键词的。

**`index <code>`**（如 `sh000300`）的请求：
```json
{ "list_codes": ["comp_index_sh000300"], "date": "2026-06-17" }
```
返回成份股列表。**实测前缀固定为 `comp_index_`**。

---

### 类别 I：ETF (6)

所有 ETF 命令均走 `route=stock_quote_snapshot`，**仅 fields 不同**。

#### `etf`（ETF 详情）

**fields**（58 项）：
```
SecuName, ClosePrice, ChangePCT, TurnoverVolume, TurnoverValue, TurnoverRate, TotalMV,
EtfType, EtfEstablishDate, EtfPriceLimit,
EtfManageInstitution, EtfTrusteeInstitution,
EtfTrackIndexCode, EtfTrackIndexName,
EtfPurchaseStatus, EtfRedemptionStatus,
EtfInvestScope, EtfInvestStrategy,
EtfManagerInfo, EtfBaseInfo,
SubscriptionFee, ManagementFee, CustodyFee, ServiceFee,
EtfNav, EtfDisc, EtfSize,
EtfShares, EtfSharesChg, EtfSharesChgRatio,
EtfDiscountRatioCurve, EtfAvgDiscountRatioCurve,
EtfIndexDailyChange, EtfIndex1YReturn,
EtfPrlistDate, EtfPrlistTope20Ratio, EtfPrlistCashBalance, EtfPrlistMarket
```

#### `etf-holdings`（ETF 持仓明细）

**fields**：`EtfPrlistDetail, EtfPrlistDate, SecuName`

**响应**：`data.stocks[].data.EtfPrlistDetail` 字段是字符串化的成分股列表。

#### `etf-nav`（ETF 净值历史） — route=`stock_quote_history`

**params**：
```json
{ "code": "sh510300", "start_date": "2026-01-01", "end_date": "2026-06-17",
  "fields": "EndDate, ClosePrice, ChangePCT" }
```

#### `etf-company`（ETF 公司信息）

**fields**：`SecuName, EtfManageInstitution, EtfTrusteeInstitution, EtfManagerInfo, EtfTrackIndexCode, EtfTrackIndexName`

#### `etf-holders`（ETF 持有人结构）

**fields**：`SecuName, EtfHolderAccount, EtfIndividialHolderShare, EtfIndividialHolderRatio, EtfInstitutionHolderShare, EtfInstitutionHolderRatio, EtfTop10Share, EtfTop10Ratio`

#### `etf-financial`（ETF 财务指标）

**fields**：`SecuName, EtfTotalAssets, EtfStockRatio, EtfBondRatio, EtfCommodityRatio, EtfFundRatio, EtfKeyAssetRatio`

---

### 类别 J：宏观 (1)

#### `macro`（宏观经济） — route=`query_list_data_by_date`

**params**：
```json
{ "list_codes": ["macro_gdp"], "date": "2025-01-01" }
// 或 ["macro_pmi"] / ["macro_cpi_ppi"] / ["macro_m2"] / ["core_indicatros_cur"] 等
```

- 已知指标：`gdp`, `cpi_ppi`, `pmi`, `m2`, `fxrb`, `loan`, `core_indicatros_cur`, `industrial_profit`, `fixed_asset`, `retail_sales`, `fdi`, `import_export`, `household_income`, `population`, `passenger_car`, `real_estate`, `tourism`, `macro_synthetical`, `macro_synthetical_curve`
- `date` 形如 `2025-01-01`（按年取）或具体日期（用于 `core_indicatros_cur`）
- `list_data` 是 JSON 字符串，字段命名规则：`GDP_*` / `CPI_*` / `PMI_*` / `M2_*` 等

---

### 类别 K：风险监控 (1)

#### `risk`（风险事件，仅 A股）

脚本**对每个 type 发出一个独立请求**（不是单次多 type）。

| type | route | fields |
|------|-------|--------|
| `specialtrade` (特别交易) | `stock_quote_snapshot` | `SpecialTrade` |
| `pledge` (股权质押) | `stock_quote_snapshot` | `SharesPledge` |
| `addition` (增发) | `stock_quote_snapshot` | `Addition` |
| `st` (ST 警示) | `stock_quote_snapshot` | `ST` |
| `unlock` (解禁) | `stock_quote_history` | `SharesUnlock` |
| `lawsuit` (诉讼) | `stock_quote_history` | `LawSuit` |

**`stock_quote_snapshot` 类 risk params 形态**：
```json
{ "codes": "sh600519", "fields": "SharesPledge" }
```

**`stock_quote_history` 类 risk params 形态**（注意参数名是 `start`/`end`，**不是** `start_date`/`end_date`）：
```json
{ "code": "sh600519", "start": "2026-06-17", "end": "2026-06-17", "fields": "SharesUnlock" }
```

---

## 4. 货币单位

| 市场 | 货币 | 示例 |
|------|------|------|
| A股 (sh/sz/bj) | CNY | `ClosePrice=1240` |
| 港股 (hk) | HKD | `ClosePrice=395.6` |
| 美股 (us) | USD | `ClosePrice=210.3` |

**展示时禁止用 ¥**。

---

## 5. 响应结构速查

| 命令 | 响应顶层 data 字段 |
|------|---------------------|
| `quote` / `profile` / `rating` / `consensus` / `reserve` / `exdiv` / `shareholder` / `chip` / `asfund` / `hkfund` / `margintrade` / `blocktrade` / `risk` / `etf*` | `data.stocks[]`（每个股票一对象） |
| `kline` / `finance` / `dividend` / `buyback` / `usfund` / `etf-nav` | `data.series[]`（每期一对象，含 `data` 子对象） |
| `minute` | `data[<code>].data.data[]`（字符串数组） |
| `news` / `marketnews` / `notice` / `report` | `data.data[]` 或 `data.news_list[]` |
| `newsdetail` | `data.data[]`（含 `content` 字段） |
| `ncontent` | `data[]`（含 `url` / `pdf` 字段） |
| `sector` / `lgt` / `index` / `macro` | `data.data[list_code].list_data`（JSON 字符串） |
| `changedist` / `suspension` | `data.count` |
| `search` | 顶层 `stock` / `sector` / `fund` / `news` / `function` / `manager` |
| `board` | `data.fundflow.plate.top[]` |
| `calendar` | `data[]`（每天一项，含 `date`, `list[]`） |
| `hot` | `data.stock[]` / `data.wx[]` / `data.board[]` / `data.fund[]` / `data.news[]` |
| `ipo` A/港股 | `data.sgok[]` / `data.sgrq[]` / `data.ssrq[]` / `data.zqh[]` |
| `ipo` 美股 | `data.list[]` |
| `watchlist rank` | `data.list[]` |
| `watchlist detail` | `data.detail.{info, userData, holdings, curve}` |
| `lhb` | `data.jg[]` / `data.yzb[]` / `data.yyb[]` / `data.gslmr[]` / `data.gslxw[]` |
| `dehydrated` | `data.data[]` |
| `dehydrated detail` | `data.data.{content, full_text, author, title}` |
| `report` | `data.data[]` |

---

## 6. 已知限制

| 限制项 | 范围 |
|--------|------|
| 风险事件 / 龙虎榜 / 大宗交易 / 融资融券 / 筹码成本 | **仅 A股** |
| 股东结构 | 仅 A股、港股 |
| `search` / `minute` | 不支持批量 |
| K线复权 | 港股、美股 K线**无复权**（接口无复权概念） |
| 分钟 K线 | `kline` 不支持分钟周期，用 `minute` 命令 |

---

## 7. 抓包环境

```bash
# prehook.mjs 拦截 http/https/fetch
# 用法：node --import=<prehook> <westock-data 脚本> <子命令> [args...]

node --import="file:///D:/Project/Nono/prehook.mjs" \
     "C:/Users/18906/.claude/skills/westock-data/scripts/index.js" \
     quote sh600519
```

抓到的请求写入 `D:/Project/Nono/sniffed.jsonl`，每行一条 JSON。

**小坑**：某些长连接（如 `lhb`）的 resp 可能在 `process.exit` 之前没写完——遇到这种情况直接用 Python 复测即可，Python 端没这个问题。

---

## 8. 配套文件

- `prehook.mjs` — 抓包 prehook（注入 Node 拦截 `http`/`https`/`fetch`）
- `westock_client.py` — 49 命令的纯 Python `requests` 重写
- `sniffed.jsonl` / `captures/*.jsonl` — 抓包原始数据

---

## 10. 抓包文件索引（`captures/`）

73 个抓包文件，按命令 / 子命令命名：

**核心命令（单次抓包）**：quote / kline / minute / finance / finance_hk / finance_us / profile / rating / consensus / report / dehydrated / dehydrated_p2 / dehydrated_detail / news / news_all / marketnews / newsdetail / notice / ncontent / asfund / hkfund / usfund / blocktrade / margintrade / buyback / technical / chip / shareholder / shareholder_hk / dividend / dividend_us / exdiv / reserve / suspension / suspension_hk / suspension_us / search / hot_stock / hot_wx / hot_board / hot_etf / hot_news / watchlist / watchlist_detail / board / calendar / calendar 默认 / ipo / ipo_hk / ipo_us / lgt / lhb / sector / index / etf / etf-company / etf-financial / etf-holders / etf-holdings / etf-nav / etf-nav-2024 / macro / risk / risk_multi / changedist / changedist_hk / sector_list / sector_search / sector_rank / sector_rank_sw1 / index_list / index_search / macro_list

每个文件每行一条 JSON 记录，含 `id` / `method` / `url` / `headers` / `body` / `respStatus` / `respBody` 字段。

---

---

## 9. 合规声明

> ⚠️ 本逆向仅用于**个人学习研究**，目的是脱离 Node 运行时。
> 原始数据归腾讯自选股所有，token 失效、接口下线、签名校验上线等风险**随时可能发生**。
> **请勿用于商业爬取或转售**。如官方接口下线，请停止使用。
