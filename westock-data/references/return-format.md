# WeStock Data - 返回格式参考手册

> **说明**：本文档通过实际运行每个 westock-data 命令采集的真实输出。所有命令默认输出 **Markdown 表格** 格式（AI 直接读取表格数据进行分析）。失败时输出 JSON 错误信息或文本提示。
>
> **通用规范**：
> - 单股查询 → 1 个表格
> - 批量查询 → 顶部 `[Batch] 状态` 摘要行 + 每个 symbol 独立表格
> - 货币单位：港股港元/美元，美股美元，A股元（展示时需标注单位）
> - 数据来源：腾讯自选股

---

## 目录

- [一、行情数据](#一行情数据)
  - [quote 实时行情](#1-quote-实时行情)
  - [minute 分时数据](#2-minute-分时数据)
  - [kline K线](#3-kline-k线)
  - [changedist 涨跌区间分布](#4-changedist-涨跌区间分布)
- [二、财务数据](#二财务数据)
  - [finance 财务报表](#5-finance-财务报表)
  - [profile 公司简况](#6-profile-公司简况)
- [三、资讯与研究](#三资讯与研究)
  - [rating 机构评级](#7-rating-机构评级)
  - [consensus A股一致预期](#8-consensus-a股一致预期)
  - [report 研报列表](#9-report-研报列表)
  - [dehydrated 脱水研报](#10-dehydrated-脱水研报)
  - [news 个股新闻](#11-news-个股新闻)
  - [marketnews 市场资讯](#12-marketnews-市场资讯)
  - [newsdetail 新闻详情](#13-newsdetail-新闻详情)
  - [notice 公告列表](#14-notice-公告列表)
  - [ncontent 公告全文](#15-ncontent-公告全文)
- [四、资金分析](#四资金分析)
  - [asfund A股主力资金](#16-asfund-a股主力资金)
  - [hkfund 港股资金](#17-hkfund-港股资金)
  - [usfund 美股卖空](#18-usfund-美股卖空)
  - [blocktrade 大宗交易](#19-blocktrade-大宗交易)
  - [margintrade 融资融券](#20-margintrade-融资融券)
  - [buyback 公司回购](#21-buyback-公司回购)
- [五、技术分析](#五技术分析)
  - [technical 技术指标](#22-technical-技术指标)
  - [chip 筹码成本](#23-chip-筹码成本)
- [六、基本面](#六基本面)
  - [shareholder 股东结构](#24-shareholder-股东结构)
  - [dividend 分红数据](#25-dividend-分红数据)
  - [exdiv 分红除权日](#26-exdiv-分红除权日)
  - [reserve 业绩预告/财报披露日](#27-reserve-业绩预告财报披露日)
  - [suspension 停复牌](#28-suspension-停复牌)
- [七、市场发现](#七市场发现)
  - [search 搜索](#29-search-搜索)
  - [hot 热搜](#30-hot-热搜)
  - [watchlist 股单](#31-watchlist-股单)
  - [board 行业板块](#32-board-行业板块)
  - [calendar 投资日历](#33-calendar-投资日历)
  - [ipo 新股日历](#34-ipo-新股日历)
- [八、市场数据](#八市场数据)
  - [lgt 陆股通成份股](#35-lgt-陆股通成份股)
  - [lhb 龙虎榜](#36-lhb-龙虎榜)
  - [sector 板块成份股](#37-sector-板块成份股)
  - [index 指数数据](#38-index-指数数据)
- [九、ETF 基金](#九etf-基金)
  - [etf ETF详情](#39-etf-etf详情)
  - [etf-holdings ETF持仓](#40-etf-holdings-etf持仓)
  - [etf-nav ETF净值历史](#41-etf-nav-etf净值历史)
  - [etf-company ETF公司信息](#42-etf-company-etf公司信息)
  - [etf-holders ETF持有人结构](#43-etf-holders-etf持有人结构)
  - [etf-financial ETF财务指标](#44-etf-financial-etf财务指标)
- [十、宏观数据](#十宏观数据)
  - [macro 宏观经济](#45-macro-宏观经济)
- [十一、风险监控](#十一风险监控)
  - [risk 风险事件](#46-risk-风险事件)

---

## 一、行情数据

### 1. quote 实时行情

**支持**：个股、指数、板块、ETF（A/HK/US/指数/板块）

**输出表格列**（共 38 列）：
```
code | market_type | market_name | name | symbol | price | prev_close | open |
volume | bid1 | bid1_vol | ask1 | ask1_vol | time | change | change_percent |
high | low | amount | turnover_rate | volume_ratio | range_pct | pe_ratio |
pe_fwd | pe_lyr | pb_ratio | ps_ttm | pcf_ttm | dividend_ratio_ttm |
total_market_cap | circulating_market_cap | total_shares | float_shares |
high_52week | low_52week | chg_5d | chg_10d | chg_20d | chg_60d | chg_ytd
```

**批量输出前缀**：
```
[Batch] 状态: success | 总数: 3 | 成功: 3 | 失败: 0
```

**示例**：
```bash
$ westock-data quote sh600519
| code | market_type | market_name | name | ... |
| --- | --- | --- | --- | --- |
| sh600519 | 1 | 上海主板 | 贵州茅台 | ... |
```

**关键字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `market_type` | int | 1=沪A，51=深A，100=港股，200=美股 |
| `price` | float | 当前价格（港股港元，美股美元） |
| `amount` | float | 成交额（A股元，港股港元，美股美元） |
| `pe_ratio` | float | 市盈率TTM |
| `pe_fwd` | float | 动态市盈率 |
| `total_market_cap` | float | 总市值（亿元） |
| `chg_5d/10d/20d/60d/ytd` | float | 多日涨跌幅(%) |

---

### 2. minute 分时数据

**支持**：个股、指数、板块（**不支持批量查询**）

**输出表格列**：
- 1日：`code | time | price | volume | amount`
- 多日（`--days N`）：`code | date | time | price | volume | amount`

**示例**（5日分时）：
```
| code | date | time | price | volume | amount |
| --- | --- | --- | --- | --- | --- |
| sh600519 | 20260616 | 0930 | 1267.01 | 337 | 42698236.76 |
```

---

### 3. kline K线

**支持**：个股、指数、板块、ETF

**输出表格列**：
```
date | open | last | high | low | volume | amount | exchange
```

**示例**：
```
| date | open | last | high | low | volume | amount | exchange |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-16 | 1292.7 | 1255.67 | 1292.7 | 1255 | 76556 | 9703617625 | 0.61 |
```

**关键字段说明**：
- `exchange`：换手率(%)，非交易所
- `volume`：成交量（手），÷10000=万手
- `amount`：成交额（元）
- `last`：收盘价

**批量查询输出**（K线批量是单表内多股分组）：
```
[Batch] 状态: success | 总数: 2 | 成功: 2 | 失败: 0
| symbol | date | open | last | ... |
| sz000001 | 2026-06-16 | 11.05 | 10.94 | ... |
| sh600519 | 2026-06-16 | 1267.01 | 1255.67 | ... |
```

---

### 4. changedist 涨跌区间分布

**支持**：沪深（`hs`）/港股（`hk`）

**输出结构**（2个表格）：
1. 概况表：`市场 | 日期 | 总数 | 上涨 | 下跌 | 平盘 | 涨停 | 跌停`
2. 区间分布表：`min | max | label | type | count | percent`

**示例**（沪深）：
```
| 市场 | 日期 | 总数 | 上涨 | 下跌 | 平盘 | 涨停 | 跌停 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 沪深 | 2026-06-16 | 4984 | 2498 | 2391 | 98 | 118 | 7 |

| min | max | label | type | count | percent |
| --- | --- | --- | --- | --- | --- |
| - | - | 涨停 | limitUp | 118 | 2.36 |
| 5 | 7 | 5%~7% | - | 165 | 3.31 |
| ... |
```

**港股差异**：港股无涨停跌停字段，分布区间为 `>7%`、`5%~7%`、`2%~5%`、`0%~2%`、`平`、`0%~-2%`、`-2%~-5%`、`-5%~-7%`<-7%`。

---

## 二、财务数据

### 5. finance 财务报表

**支持**：A股/港股/美股

**输出表格列**：每行一期数据，列为具体财务指标（**字段名因报表类型而异**，无固定列）

**A股类型**：
- `lrb`：利润表（OperatingRevenue、OperatingCost、OperatingProfit、NPParentCompanyOwners、BasicEPS 等）
- `zcfz`：资产负债表（TotalAssets、TotalLiability、TotalShareholderEquity、Inventories、CashEquivalents 等）
- `xjll`：现金流量表（NetOperateCashFlow、NetInvestCashFlow、NetFinanceCashFlow、FCFF、FCFE 等）

**港股类型**：
- `zhsy`：综合损益表（OperatingIncome、EarningBeforeTax、EarningAfterTax、ROA、RoeWeighted 等，**带 MainOperIncomeIndustry/Product/Region JSON 数组**）
- `zcfz`：资产负债表
- `xjll`：现金流量表

**美股类型**：
- `income` / `balance` / `cashflow`

**关键通用字段**：

| 字段 | 说明 |
|------|------|
| `_date` / `EndDate` | 报告期 |
| `InfoPublDate` | 公告日期 |
| `SecuCode` | 证券代码 |
| `EnterpriseType` | 企业类型 |
| `CurrencyType` / `CurrencyUnit` | 货币类型/单位（港股：港币/港元，美股：美元） |
| `_Q` / `TTM` 后缀 | 单季 / 滚动12个月 |

**示例**（A股 lrb）：
```
| _date | BasicEPS | DilutedEPS | EndDate | OperatingRevenue | ... |
| --- | --- | --- | --- | --- | --- |
| 2025-12-31 | 65.66 | 65.66 | 2025-12-31 | 168838102514.79 | ... |
```

---

### 6. profile 公司简况

**输出表格列**：
```
code | name | listedDate | business | website | industry | sector | issuePrice |
regCapital | establishDate | chairman | regAddress | officeAddress | tel | email |
introduction | exchange
```

**示例**：
```
| code | name | listedDate | business | website | industry | sector | ... |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sh600519 | 贵州茅台 | 2001-08-27 | 贵州茅台酒系列产品的生产与销售... | http://www.moutaichina.com/ | 食品饮料 | 食品饮料 | ... |
```

**关键字段说明**：
- `listedDate`：上市日期（YYYY-MM-DD）
- `establishDate`：成立日期（带时区）
- `regCapital`：注册资本（万元）
- `business`：主营业务描述
- `industry/sector`：所属行业

---

## 三、资讯与研究

### 7. rating 机构评级

**支持**：A股/港股/美股

**输出表格列**：
```
code | name | forecastInstitutions | targetPriceAvg | targetPriceMax | targetPriceMin |
ratingBuyCnt | ratingIncCnt | ratingHoldCnt | ratingDecCnt | ratingSellCnt | ratingCnt
```

**港股/美股额外字段**：港股/美股额外带 **盈利预测** 子表：
```
| period | dataSource | currencyUnit | netProfit | roe | eps | pe | revenue | ps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026Q1 | 5名分析师 | 亿港币 | 767.134 | 23.12 | 8.47 | 17.20 | 2210.35 | 5.88 |
```

**示例**（A股）：
```
| code | name | forecastInstitutions | ratingBuyCnt | ... |
| --- | --- | --- | --- | --- |
| sh600519 | 贵州茅台 | 2 | 2 | ... |
```

**关键字段说明**：
- `targetPriceAvg/Max/Min`：目标均价/最高/最低（A股可能为空）
- `ratingBuyCnt/IncCnt/HoldCnt/DecCnt/SellCnt`：买入/增持/持有/减持/卖出评级数
- `forecastInstitutions`：预测机构数

---

### 8. consensus A股一致预期

**支持**：仅A股

**输出结构**：
1. 标题：`#### sh600519 贵州茅台` + `目标价: 1750.926`
2. 年度预测表：`year | revenue | netProfit | eps | pb | ps | pe | revenueYoy | netProfitYoy | institutionCnt`

**示例**：
```
#### sh600519 贵州茅台

目标价: 1750.926

| year | revenue | netProfit | eps | pb | ps | pe | revenueYoy | netProfitYoy | institutionCnt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2028 | 19893913.83 | 9525830.76 | 76.2 | 3.09 | 7.99 | 16.68 | 5.56 | 6.06 | 0 |
| 2027 | 18845629.58 | 8981241.79 | 71.84 | 3.8 | 8.43 | 17.69 | 5.07 | 5.54 | 0 |
| 2026 | 17936781.38 | 8509820.68 | 68.07 | 4.83 | 8.86 | 18.67 | 4.25 | 3.37 | 0 |
```

**关键字段说明**：
- `revenue`/`netProfit`：营收/净利润（万元）
- `eps`：每股收益（元）
- `pe/pb/ps`：估值倍数
- `revenueYoy/netProfitYoy`：同比增速(%)
- `institutionCnt`：覆盖机构数

---

### 9. report 研报列表

**输出表格列**：
```
id | img | preview | publish_time | title | type
```

**示例**：
```
| id | img | preview | publish_time | title | type |
| --- | --- | --- | --- | --- | --- |
| 1179 | https://...jpg | 光纤光缆价格大涨... | 1780966800000 | 机构调研\|... | 1 |
```

**关键字段说明**：
- `id`：研报ID（用于 `dehydrated detail <id>`）
- `publish_time`：Unix时间戳(ms)
- `type`：类型（1=研报，2=业绩会）
- `img`：封面图URL
- `preview`：预览摘要

---

### 10. dehydrated 脱水研报

**列表输出表格列**：与 `report` 类似
```
id | img | preview | publish_time | title | type
```

**详情输出（`dehydrated detail <id>`）**：返回完整 JSON，包含 `data.author`、`data.content`（HTML格式正文）、`data.invest_points[]`、`data.content_url`、`data.id` 等字段。

**关键字段说明**：
- `content`：HTML格式正文（含 `<img>` 图片）
- `invest_points`：投资要点（字符串数组）
- `author`：作者

---

### 11. news 个股新闻

**输出表格列**（24列）：
```
time | id | type | symbol | title | url | newstype | news_type | cont_type |
src | articletype | needKey | private | summary | predictTimestamp | typeStr |
llm_content | importance | title_mention | body_mention | newsThumbImage |
app_detail_link | has_translation | special_type
```

**分页标识**：
```
共 9999 条（第 1 页，每页 5 条，共 2000 页）
```

**关键字段说明**：
- `type`：新闻类型（0=公告，1=研报，2=新闻，3=全部）
- `symbol`：相关股票代码
- `src`：来源
- `title_mention/body_mention`：标题/正文中提及的代码（逗号分隔）
- `predictTimestamp`：Unix时间戳

---

### 12. marketnews 市场资讯

**输出格式**：与 `news` 相同（24列表格）

**预设市场参数**：
- `hs`：沪深（默认）
- `hk`：港股
- `us`：美股
- 也支持自定义指数代码（如 `sh000001,sz399001`）

---

### 13. newsdetail 新闻详情

**输出**：失败时常见 `[SKILL_006]`，但**正常返回 JSON**：
```json
{
  "success": true,
  "data": [
    {
      "time": "...",
      "id": "...",
      "type": 2,
      "title": "...",
      "url": "...",
      "pdf": "...",
      "detail": "...",
      "content": "",
      "stockcode": [{"symbol": "...", "name": "..."}]
    }
  ]
}
```

---

### 14. notice 公告列表

**输出表格列**：
```
id | symbol | title | time | type | url | newstype | update_time | Ftranslate
```

**分页标识**：
```
共 921 条（第 1 页，每页 3 条，共 307 页）
```

**关键字段说明**：
- `id`：公告ID（用于 `ncontent <id>`）
- `type`：公告类型
- `newstype`：分类代码（如 `01010503,010113,011905`）
- `Ftranslate`：是否翻译

---

### 15. ncontent 公告全文

**输出**：JSON 格式
```json
{
  "success": true,
  "data": [
    {
      "time": "2026-04-24 19:14:52",
      "id": "1225187851",
      "type": 0,
      "title": "...",
      "url": "...",
      "pdf": "http://...PDF",
      "detail": "http://...PDF",
      "content": "",
      "detail_oem": "",
      "stockcode": [{"symbol": "sh600519", "name": "贵州茅台"}]
    }
  ]
}
```

**说明**：
- 沪深（`nos` 前缀）：`detail`/`pdf` 为 PDF URL，`content` 为空
- 港股（`nok` 前缀）：返回 PDF URL
- 美股（`nou` 前缀）：返回 PDF URL

---

## 四、资金分析

### 16. asfund A股主力资金

**支持**：沪深A股

**截面输出表格列**（含嵌套对象 `BlockTradingInfos` / `MarginTradeInfos` 数组字段）：
```
code | BlockNetFlow | BlockTradingInfos | ClosePrice | EndDate | JumboNetFlow |
MainInFlow | MainInflowCircRate | MainInflowIndustryRank | MainInflowRank |
MainNetFlow | MainNetFlow10D | MainNetFlow20D | MainNetFlow5D |
MainOutFlow | MarginTradeInfos | MidNetFlow | RetailInFlow | RetailOutFlow |
SecuCode | SmallNetFlow
```

**历史输出**（无嵌套对象）：
```
code | date | BlockNetFlow | ClosePrice | EndDate | JumboNetFlow |
MainInFlow | MainNetFlow | MainOutFlow | MidNetFlow | RetailInFlow |
RetailOutFlow | SecuCode | SmallNetFlow
```

**关键字段说明**：

| 字段 | 单位 | 说明 |
|------|------|------|
| `MainNetFlow` | 元 | 主力净流入（正=流入，负=流出） |
| `JumboNetFlow` | 元 | 超大单净流入 |
| `BlockNetFlow` | 元 | 大单净流入 |
| `MidNetFlow` | 元 | 中单净流入 |
| `SmallNetFlow` | 元 | 小单净流入 |
| `MainNetFlow5D/10D/20D` | 元 | 5/10/20日主力净流入 |
| `BlockTradingInfos` | JSON数组 | 大宗交易明细 |
| `MarginTradeInfos` | JSON对象 | 融资融券明细 |

---

### 17. hkfund 港股资金

**支持**：港股

**截面输出表格列**：
```
code | AvgDealPrice | ClosePrice | EndDate | LgtHoldInfo | MainAvgDealPrice |
MainIn | MainNetFlow | MainOut | RetailAvgDealPrice | RetailIn | RetailNetFlow |
RetailOut | SecuCode | TotalNetFlow | ShortAmount | ShortRatio | ShortShares
+ _lgtHoldInfo.* 展平字段
```

**LgtHoldInfo 嵌套对象解析字段**：
| 字段 | 单位 | 说明 |
|------|------|------|
| `LgtHoldShares` | 股 | 持股数量 |
| `LgtHoldRatio` | % | 持股占比 |
| `LgtCapChgDaily` | 港元 | 当日增仓金额 |
| `LgtShareChgDaily` | 股 | 当日增仓股数 |
| `LgtCapChgQuarterly` | 港元 | 季度增仓金额 |
| `LgtShareChgQuarterly` | 股 | 季度增仓股数 |

**附加子表**：港股会自动追加一个 **南下资金持仓** 子表（独立表格）。

**关键字段说明**：

| 字段 | 单位 | 说明 |
|------|------|------|
| `TotalNetFlow` | 港元 | 总净流入 |
| `MainNetFlow` | 港元 | 主力净流入 |
| `RetailNetFlow` | 港元 | 散户净流入 |
| `ShortShares` | 股 | 卖空数量 |
| `ShortRatio` | % | 卖空比例 |
| `ShortAmount` | 港元 | 卖空金额 |

---

### 18. usfund 美股卖空

**支持**：美股

**输出表格列**：
```
code | date | ClosePrice | EndDate | SecuCode | ShortRatio | ShortRecoverDays | ShortShares
```

**关键字段说明**：

| 字段 | 单位 | 说明 |
|------|------|------|
| `ShortRatio` | % | 卖空比例 |
| `ShortShares` | 股 | 卖空股数 |
| `ShortRecoverDays` | 天 | 回补天数 |
| `date` | - | 数据日期（截面时为单日，历史区间时多日） |

**注意**：美股数据日期通常滞后2-3周。

---

### 19. blocktrade 大宗交易

**支持**：仅沪深市场（sh/sz）

**输出结构**（2个表格）：
1. 概况表：`code | name | date | closePrice | changePct`
2. 明细表：`TradingType | SerialNumber | BuySalesDepartment | SellSalesDepartment | TurnoverPrice | TurnoverValue | CloseDiscountRate`

**示例**：
```
| code | name | date | closePrice | changePct |
| --- | --- | --- | --- | --- |
| sh601888 | 中国中免 | 2026-06-16 | 58.4 | -1.15 |

**大宗交易明细**

| TradingType | SerialNumber | BuySalesDepartment | SellSalesDepartment | TurnoverPrice | TurnoverValue | CloseDiscountRate |
| --- | --- | --- | --- | --- | --- | --- |
| 协议交易 | 1 | 华泰证券... | 招商证券... | 63.05 | 30264000.00 | 0.00 |
```

**注意**：当日无数据时输出 `当日无大宗交易数据`。

---

### 20. margintrade 融资融券

**支持**：仅沪深市场（sh/sz）

**输出表格列**：
```
code | name | date | closePrice | changePct | FinanceValue | SecurityValue |
FinanceBuyValue | FinanceRefundValue | TradingValue | TradingValueDif |
FinanceValueDOD | SecurityValueDOD
```

**关键字段说明**：

| 字段 | 单位 | 说明 |
|------|------|------|
| `FinanceValue` | 元 | 融资余额 |
| `SecurityValue` | 元 | 融券余额 |
| `FinanceBuyValue` | 元 | 融资买入额 |
| `FinanceRefundValue` | 元 | 融资偿还额 |
| `TradingValue` | 元 | 融资融券交易额 |
| `TradingValueDif` | 元 | 融资余额差额 |
| `FinanceValueDOD` | % | 融资余额日变化 |
| `SecurityValueDOD` | % | 融券余额日变化 |

---

### 21. buyback 公司回购

**支持**：A股/港股

**A股输出结构**（2个表格）：
1. 公司信息：`code | name | market`
2. 明细：`date | closePrice | BuybackFunds | BuybackSum | BuybackPrice`

**港股输出表格列**：
```
date | BuybackShares | BuybackMoney | BuybackPrice | BuybackCumMoney
```

**关键字段说明**：

**A股字段**：
| 字段 | 单位 | 说明 |
|------|------|------|
| `BuybackFunds` | 元 | 本次回购资金 |
| `BuybackSum` | 股 | 本次回购数量 |
| `BuybackPrice` | 元 | 本次回购均价 |

**港股字段**：
| 字段 | 单位 | 说明 |
|------|------|------|
| `BuybackShares` | 股 | 回购股份 |
| `BuybackMoney` | 港元 | 回购金额 |
| `BuybackPrice` | 港元 | 回购均价 |
| `BuybackCumMoney` | 港元 | 本轮回购累计金额 |

**注意**：数据按日期降序排列，仅返回有回购记录的交易日。

---

## 五、技术分析

### 22. technical 技术指标

**支持**：A股/港股/美股

**输出表格列**：嵌套对象（ma/macd/kdj/rsi/boll/bias/wr/dmi/other）字段展平为 `分组.字段名` 格式。

**截面输出**：
```
code | name | date | closePrice | ma.MA_5 | ma.MA_10 | ma.MA_20 | ... |
macd.DIF | macd.DEA | macd.MACD | kdj.KDJ_K | kdj.KDJ_D | kdj.KDJ_J | ...
```

**历史输出**（无 code/name 列，每行一天）：
```
date | closePrice | ma.MA_5 | ... | macd.DIF | ... | other.OBV | ...
```

**完整字段清单**（共48列）：

| 分组 | 字段 | 说明 |
|------|------|------|
| `ma` | MA_5/10/20/30/60/120/250 | 移动均线 |
| `ma` | EMA_12/26/50 | 指数均线 |
| `macd` | DIF/DEA/MACD | MACD |
| `kdj` | KDJ_K/KDJ_D/KDJ_J | KDJ |
| `rsi` | RSI_2/6/12/24 | RSI |
| `boll` | BOLL_UPPER/MID/LOWER | 布林带 |
| `bias` | BIAS_6/12/24 | 乖离率 |
| `wr` | WR_6/10 | 威廉 |
| `dmi` | SAR/PDI/MDI/ADX/ADXR | SAR/DMI |
| `other` | OBV/VR/VRMA/BBI/TRIX/TRIXMA/DPO/MADPO/PSY/PSYMA/ENE/ENE_UPPER/ENE_LOWER/CCI_14/DDD/AMA/AR/BR | 其他指标 |

**注意**：当指定 `--group` 子集时，未选中的分组字段值显示为 `-`。

---

### 23. chip 筹码成本

**支持**：仅沪深京A股（sh/sz/bj）

**输出表格列**：
```
code | name | date | closePrice | chipProfitRate | chipAvgCost |
chipConcentration90 | chipConcentration70
```

**历史输出**（无 code/name）：
```
date | closePrice | chipProfitRate | chipAvgCost | chipConcentration90 | chipConcentration70
```

**关键字段说明**：

| 字段 | 单位 | 说明 |
|------|------|------|
| `chipProfitRate` | % | 盈利率 |
| `chipAvgCost` | 元 | 平均成本 |
| `chipConcentration90` | % | 90%筹码集中度 |
| `chipConcentration70` | % | 70%筹码集中度 |

**解读**：
- 盈利率 > 80% = 获利盘占优
- 收盘价 > 平均成本 = 整体盈利
- 集中度越低 = 筹码越集中（主力控盘可能）

---

## 六、基本面

### 24. shareholder 股东结构

**支持**：A股/港股

**A股输出结构**（多表）：
1. 标题：`#### sh600519 贵州茅台 (2026-03-31)`
2. 十大股东：`no | name | holdShares | holdPct | holdChange`
3. 十大流通股东：同上
4. 股东户数统计：`date | totalSHNum | aSHNum | avgHoldShares | aAvgHoldShares`

**港股输出结构**（2表）：
1. 标题：`#### hk00700 腾讯控股 (2026-06-16)`
2. 持股股东信息：`name | shares | pct`

**关键字段说明**：

| 字段 | 说明 |
|------|------|
| `holdShares` | 持股数量（股） |
| `holdPct` | 持股比例(%) |
| `holdChange` | 持股变化（股） |
| `totalSHNum` | 总股东户数 |
| `avgHoldShares` | 平均持股数 |

---

### 25. dividend 分红数据

**支持**：A股/港股/美股

**A股输出结构**（多表）：
1. 标题：`#### sh600519 贵州茅台`
2. 分红历史表：`reportEndDate | dividendFlag | dividendType | procedure | proposalSn |
rightRegDate | exDiviDate | bonusShareRatio | tranAddShareRatio | cashDiviRMB |
totalCashDiviComRMB | dividendPlan`

**港股输出**：
```
| reportEndDate | exDiviDate | cashPayDate | cashDivPerShare | specialDivPerShare | totalCashDivi | dividendPlan |
```

**美股输出**：
```
| exDivDate | regDate | payDate | dividendCurrency | dividend | dividendPlan |
```

**关键字段说明**：
- 默认查询最近分红
- `--years N`：近N年分红历史
- `--all`：含未实施分红方案
- 按报告期/除权日降序排列

---

### 26. exdiv 分红除权日

**支持**：A股/港股/美股

**A股/港股输出表格列**：
```
code | name | exDivDate | payDate | reportEndDate | dividendPerShare | currency | dividendPlan
```

**美股输出**：
```
code | name | exDivDate | regDate | payDate | dividend | splitInfo | ...
```

**注意**：A股查询可能返回 `暂无数据`（除权日历非交易日）。

---

### 27. reserve 业绩预告/财报披露日

**支持**：A股/港股/美股

**输出表格列**：
```
code | name | reportEndDate | disclosureEndDate | disclosureDate | disclosureDesc
```

**示例**：
```
| code | name | reportEndDate | disclosureEndDate | disclosureDate | disclosureDesc |
| --- | --- | --- | --- | --- | --- |
| sh600519 | 贵州茅台 | 2026-03-31 |  | 2026-04-25 | 公司预计于2026-04-25披露2026第一季报 |
```

**注意**：港股可能返回 `暂无业绩预告数据`（港股无预告）。

---

### 28. suspension 停复牌

**支持**：沪深（`hs`）/港股（`hk`）/美股（`us`）

**输出表格列**：
```
code | name | status | statusDesc | suspendDate | resumeDate | reason
```

**港股简化输出**：
```
code | name | status | statusDesc
```

**关键字段说明**：
- `status`：枚举值（`suspended`=停牌中，`resumed`=已复牌）
- `reason`：停牌原因
- `suspendDate/resumeDate`：日期（YYYY-MM-）

---

## 七、市场发现

### 29. search 搜索

**输出表格列**：
```
code | name | type
```

**type 取值**：
- `--stock`（默认）：`GP`（股票）、`ZS`（指数）
- `--fund`：`ETF`、`QDII-ETF`、`LOF` 等
- `--sector`：`BK`（板块）、`BK-HY-1/2/3`（行业分级）、`ZS`（指数）

**示例**（搜索股票）：
```
| code | name | type |
| --- | --- | --- |
| hk00700 | 腾讯控股 | GP |
| usTCEHY.PS | 腾讯控股(ADR) | GP |
```

**注意**：`search --sector` 只返回板块列表，不含成份股；要查成份股请用 `sector --search` + `sector <代码>` 两步。

---

### 30. hot 热搜

**输出表格列**（因类型而异）：

**`hot stock` / `hot wx`**：
```
code | name | zdf | zxj | status | stock_type
```

**`hot board`**（带排名）：
```
index | level | symbol | rank | rankdelta | date | stock_type | name | zdf | zxj
```

**`hot etf`**（含标签）：
```
rankdelta | entry_time | date | index_value | rank | stock_type | name |
zxj | zdf | status | title | tag | code
```

**关键字段说明**：
- `zdf`：涨跌幅(%)
- `zxj`：最新价
- `rank`：排名
- `tag`：标签（如"当日涨幅"、"底部反弹78%"、"T+0"）

---

### 31. watchlist 股单

**支持**：热门股单列表（**非用户自选股**）

**`watchlist rank` 输出表格列**：
```
id | title | updateTime | avgChangePct | accChangePct1M | stockCount | watchedNum | board
```

**`watchlist <id>` 输出结构**（多表）：
1. 股单信息表：`id | stockCount | avgChangePct | accChangePct1M | updateTime | watchedNum | board`
2. 成分股表

---

### 32. board 行业板块

**输出结构**（2表）：
1. **行业板块涨幅排名**：
   ```
   | name | changePct | turnoverRate | changePct5d | changePct20d | leadStock |
   ```
2. **概念板块涨幅排名**：同上字段

**关键字段说明**：
- `changePct`：当日涨跌幅(%)
- `changePct5d/20d`：5/20日涨跌幅
- `leadStock`：领涨股（含涨跌幅，如"国际复材(13.33)"）

---

### 33. calendar 投资日历

**输出表格列**：
```
date | oid | time | Weightiness | Content | CountryName | CountryCode |
Previous | Predict | CurrentValue | ColumnCode | Area | FinancialEvent | Flag
```

**关键字段说明**：
- `Weightiness`：重要程度（1=一般，2=重要，3=重要+）
- `Content`：事件描述
- `Previous/Predict/CurrentValue`：前值/预测值/当前值
- `CountryName/CountryCode`：国家
- `Flag`：国家图标URL

---

### 34. ipo 新股日历

**输出表格列**：
```
stage | code | name | price | sgrq | ssrq | hy
```

**关键字段说明**：
- `stage`：申购阶段（即将发行、今日申购、中签号、上市等）
- `price`：发行价（或价格区间）
- `sgrq`：申购日期（`YYYY-MM-DD` 或区间）
- `ssrq`：上市日期
- `hy`：所属行业

---

## 八、市场数据

### 35. lgt 陆股通成份股

**支持**：`sh`（沪股通）/`sz`（深股通）

**输出格式**（2部分）：
1. 摘要行：`共 1527 只（第 1 页，每页 5 只，共 306 页）`
2. 表格：`code | name`

**分页**：`--limit N --offset N`（N 最大100）

---

### 36. lhb 龙虎榜

**支持**：仅A股

**输出表格列**：因 `--tab` 而异（机构榜 jg / 游资榜 yzb / 活跃席位 yyb / 高胜率买入 gslmr / 高胜率席位 gslxw）

**常见字段**：
- 股票基础：`code | name | closePrice | changePct`
- 买卖：`buyAmount | sellAmount | netAmount | buyDepartment | sellDepartment`
- 营业部：`salesDepartmentName | holdPct | winRate`

---

### 37. sector 板块成份股

**支持**：申万行业 / 聚源概念

#### 37.1 `sector --types` 查看代码格式

**输出**：
```
📊 板块代码格式:
  comp_sw1_XXXX                申万一级行业
  comp_sw2_XXXX                申万二级行业
  comp_sw3_XXXX                申万三级行业
  comp_area_XXXX               地域概念
  comp_style_XXXX              产业概念
  comp_indus_XXXX              风格概念
```

#### 37.2 `sector --list` 查看可用清单

**输出**：
```
📋 可用板块清单:
  industry_list_sw1        申万一级行业清单
  industry_list_sw2        申万二级行业清单
  industry_list_sw3        申万三级行业清单
  concept_list_area        聚源地域概念清单
  concept_list_industry    聚源产业概念清单
  concept_list_style       聚源风格概念清单
```

#### 37.3 `sector --list <清单>` 查看清单内容

**输出格式**：
```
📋 查询板块清单: industry_list_sw1

共 31 个，当前显示第 1-5 个，还有 26 个未显示（使用 --offset 5 查看更多）
| 代码 | 名称 |
| --- | --- |
| pt01801040 | 钢铁 |
| pt01801080 | 电子 |
```

#### 37.4 `sector --search <关键词>` 搜索板块

**输出格式**：
```
🔍 搜索板块 "银行" (范围: 所有清单)

  找到 8 个匹配:

| 代码 | 名称 | 分类 |
| --- | --- | --- |
| pt02003652 | 参股民营银行 | 聚源产业概念清单 |
| pt02021386 | 银行概念 | 聚源产业概念清单 |
```

#### 37.5 `sector <板块代码>` 查询成份股

**输出格式**：
```
📊 查询板块成份股 (2026-06-16): sw1_pt01801780


📈 申万一级行业成分股-银行 [申万一级行业] (84 只)
| code | name | SectorCode |
| --- | --- | --- |
| sh601818 | 光大银行 | pt01801780 |
```

#### 37.6 `sector --rank <排行清单>` 区间涨幅榜

**输出表格列**：
```
# | 代码 | 名称 | 5日% | 20日% | 60日% | 120日% | 250日%
```

**排行清单代码**：
- `interval_chg_rank_sw1/sw2/sw3`：申万行业
- `interval_chg_rank_industry`：聚源产业概念
- `interval_chg_rank_style`：聚源风格概念
- `interval_chg_rank_area`：聚源地域概念

**排序字段**：`chg5Days` / `chg20Days` / `chg60Days` / `chg120Days` / `chg250Days`

---

### 38. index 指数数据

**支持**：所有指数

#### 38.1 `index --list` 查看清单

**输出格式**：
```
📋 查询指数清单

共 1423 个，当前显示第 1-5 个，还有 1418 个未显示（使用 --offset 5 查看更多）
| code | name |
| --- | --- |
| cs930820 | CS高端制 |
| sh000811 | 细分有色 |
```

#### 38.2 `index --search <关键词>` 搜索指数

**输出表格列**：`code | name`

#### 38.3 `index <代码>` 查询指数成份股

**输出格式**：
```
📊 查询指数成份股 (2026-06-16): sh000300


📈 重要指数成分股-沪深300 (300 只)
| code | name |
| --- | --- |
| sh600362 | 江西铜业 |
```

**指数行情请用 `quote` 命令**：如 `westock-data quote sh000300`

---

## 九、ETF 基金

### 39. etf ETF详情

**输出结构**（多表）：
1. 标题：`#### sh510300`
2. 主信息表（60+列）：`code | name | date | etfType | establishDate | priceLimit |
manageInstitution | trusteeInstitution | trackIndexCode | trackIndexName |
purchaseStatus | redemptionStatus | investScope | investStrategy |
closePrice | changePct | turnoverVolume | turnoverValue | turnoverRate |
totalMV | subscriptionFee | managementFee | custodyFee | serviceFee |
nav | disc | size | shares | sharesChg | sharesChgRatio |
discountRatioCurve | avgDiscountRatioCurve | indexDailyChange | index1YReturn |
prlistDate | prlistTop20Ratio | prlistCashBalance | prlistMarketVal |
holderAccount | individualHolderShare | individualHolderRatio |
institutionHolderShare | institutionHolderRatio | top10Share | top10Ratio |
totalAssets | stockRatio | bondRatio | commodityRatio | fundRatio | keyAssetRatio |
isTPlus0 | ytdReturn | return1M/3M/6M/1Y/3Y | ytdMaxDrawdown |
maxDrawdown1M/3M/6M/1Y/3Y`
3. 基金经理子表：`name | intro | experienceYears | returnDuringTenure`

**关键字段说明**：

| 字段 | 说明 |
|------|------|
| `etfType` | ETF类别（"规模"、"行业"、"主题"等） |
| `nav` | 单位净值 |
| `disc` | 溢折率(%) |
| `size` | 规模（亿元） |
| `shares` | 份额（亿份） |
| `sharesChg` | 净申购份额（亿份） |
| `isTPlus0` | 是否支持T+0（✗/✓） |
| `managementFee/custodyFee` | 管理/托管费率(%) |
| `return1M/3M/6M/1Y/3Y` | 近1月/3月/6月/1年/3年收益率(%) |
| `maxDrawdown1Y` | 近1年最大回撤(%) |
| `holderAccount` | 持有人户数 |
| `individualHolderRatio` | 个人投资者持有比例(%) |
| `institutionHolderRatio` | 机构持有比例(%) |

---

### 40. etf-holdings ETF持仓

**输出格式**（多表）：
1. 标题：**sh510300** (清单日期: 2026-06-16 00:00:00 +0800 CST)
2. 持仓表：`code | name | ratio`

**示例**：
```
| code | name | ratio |
| --- | --- | --- |
| 300308 | 中际旭创 | 5.62 |
| 300750 | 宁德时代 | 3.6 |
| 600519 | 贵州茅台 | 2.87 |
```

**说明**：默认返回前十大重仓股；`--limit` 调整返回数量。

---

### 41. etf-nav ETF净值历史

**支持**：必须指定 `--start` 和 `--end`

**输出表格列**：
```
date | nav | navChange | navChangePct | accNav
```

**关键字段说明**：
- `nav`：单位净值
- `navChange`：净值变化
- `navChangePct`：净值变化(%)
- `accNav`：累计净值

---

### 42. etf-company ETF公司信息

**输出结构**（多表）：
1. 标题：`#### sh510300`
2. 公司信息：`name | manageInstitution | trusteeInstitution | trackIndexCode | trackIndexName`
3. 基金经理：`name | intro | experienceYears | returnDuringTenure`

---

### 43. etf-holders ETF持有人结构

**输出表格列**：
```
code | name | date | holderAccount | individualHolderShare | individualHolderRatio |
institutionHolderShare | institutionHolderRatio | top10Share | top10Ratio
```

**说明**：部分ETF可能无持有人数据（所有字段返回 `0`）。

---

### 44. etf-financial ETF财务指标

**输出表格列**：
```
code | name | date | totalAssets | stockRatio | bondRatio | commodityRatio | fundRatio | keyAssetRatio
```

**关键字段说明**：
- `totalAssets`：总资产（元）
- `stockRatio`：股票占比(%)
- `bondRatio`：债券占比(%)
- `commodityRatio`：商品占比(%)
- `fundRatio`：基金占比(%)
- `keyAssetRatio`：重要资产占比(%)

---

## 十、宏观数据

### 45. macro 宏观经济

**支持**：GDP/CPI/PPI/PMI/货币等11个指标

#### 45.1 `macro --list` 查看指标清单

**输出格式**：
```
📊 可用宏观指标列表:

── GDP ──
  gdp                            GDP数量指标
  cpi_ppi                        GDP价格指标
  pmi                            GDP供给指标(PMI)
  profit                         GDP供给指标(工业企业利润)
  valueadded                     GDP供给指标(工业增加值)
  consumption                    GDP需求指标(消费)
  investment                     GDP需求指标(投资)

── 货币 ──
  financing                      货币需求指标
  fundquantity                   货币供给指标(数量)
  fundcost                       货币供给指标(利率)

── 综合 ──
  core_indicatros_cur            最新核心宏观指标

共 11 个指标
```

#### 45.2 `macro <指标> --year YYYY` 查询年度数据

**输出表格列**：因指标而异（**字段名含前缀**，如 `GDP_REAL_GDP_CUM`、`GDP_NOMINAL_GDP_CUR_YOY` 等）

**GDP 示例字段**：

| 字段 | 说明 |
|------|------|
| `GDP_END_DATE` | 报告期 |
| `GDP_INFO_DATE` | 信息发布日期 |
| `GDP_NOMINAL_GDP_CUM` | 名义GDP累计值（亿元） |
| `GDP_NOMINAL_GDP_CUR` | 名义GDP当期值（亿元） |
| `GDP_NOMINAL_GDP_CUM_YOY` | 名义GDP累计同比(%) |
| `GDP_NOMINAL_GDP_CUR_YOY` | 名义GDP当期同比(%) |
| `GDP_REAL_GDP_CUM` | 实际GDP累计值 |
| `GDP_REAL_GDP_CUM_YOY` | 实际GDP累计同比(%) |
| `GDP_CONTRI_*` | 各产业贡献率（%，前缀：AGRI/BUILD/CAPITAL/...) |
| `GDP_PULL_*` | 各产业拉动率（%） |

#### 45.3 `macro <指标> --start YYYY --end YYYY` 查询时间区间

**输出**：多个年份的数据

#### 45.4 `macro core_indicatros_cur --date YYYY-MM-DD` 查询最新核心指标

**输出**：指定日期的核心宏观指标全景

**注意**：
- 指标代码需用前缀：`gdp` / `cpi_ppi` / `pmi` / `profit` 等
- `core_indicatros_cur` 必须用 `--date` 不用 `--year`

---

## 十一、风险监控

### 46. risk 风险事件

**支持**：仅A股（sh/sz/bj）

**输出结构**（多表）：根据 `--types` 选择事件类型

#### 46.1 股权质押（默认）

**输出表格列**：
```
| 质押比例 | 质押笔数 | 流通股质押 | 限售股质押 | 质押总股数 | 日期 |
```

**关键字段说明**：

| 字段 | 单位 | 说明 |
|------|------|------|
| `质押比例` | % | 质押比例 |
| `质押笔数` | - | 质押笔数 |
| `流通股质押` | 万股 | 无限售股份质押数量 |
| `限售股质押` | 万股 | 有限售股份质押数量 |
| `质押总股数` | 万股 | 质押数量 |
| `日期` | - | 信息发布日期 |

#### 46.2 解禁信息（`--types unlock`）

**输出表格列**：
```
| initialInfoPublDate | infoPublDate | estimateActual | shareHolderName |
changeReason | restrictedCondition | newAFloatListed | actualFloatListedShares
```

#### 46.3 诉讼仲裁（`--types lawsuit`）

**输出表格列**：
```
| date | actionDesc | subjectMatterStat | latestSuitSum | eventSubject |
eventSubjectRole | plaintiff | defendant | plaintiffAssociation |
defendantAssociation | caseStatus | firstInstanceStatus | secondInstanceStatus |
sppStatus | adjudicationStatus
```

#### 46.4 特别处理ST（`--types specialtrade`）

**输出表格列**：
```
| type | explain | date | riskLevel
```

#### 46.5 增发信息（`--types addition`）

**输出表格列**：
```
| issueType | eventProcedure | advanceDate | smDeciPublDate | intentLetterPublDate |
prospectusPublDate | sacApprovalPublDate | csrcApprovalPublDate |
advanceValidStartDate | advanceValidEndDate | newSharesListDate | stockType |
issuePurpose | issueObject | issuePriceCeiling | issuePriceFloor |
issuePrice | issueVol | seoProceeds | seoNetProceeds
```

**关键字段说明**：

| 字段 | 单位 | 说明 |
|------|------|------|
| `issueVol` | 万股 | 发行量 |
| `seoProceeds` | 元 | 增发募集资金总额 |
| `seoNetProceeds` | 元 | 增发募集资金净额 |
| `issuePrice` | 元 | 每股发行价 |

#### 46.6 无风险事件时输出

```
# sh600000 (sh600000) - 风险事件

暂无风险事件
```

---

## 附录：通用错误输出格式

**通用错误输出**：
```
执行失败 [错误码]: 错误描述

---
> **温馨提示**：当前数据查询遇到问题，您可以：
> 1. 打开 **腾讯微证券小程序** 或 **腾讯自选股APP** 直接查看最新行情数据
> 2. 如需反馈问题，请通过腾讯自选股APP/腾讯微证券小程序内的 **帮助与客服** 功能联系我们
```

**已知错误码**：

| 错误码 | 说明 |
|--------|------|
| `SKILL_006` | 数据源查询失败/网络中断（最常见） |
| `EXDIV_001` | A股除权日数据未找到 |
| `MACRO_002` | 宏观数据查询失败 |
| `LGT_XXX` | 陆股通相关错误 |

**注意**：错误时可能伴随 `[galileo]上报异常: TypeError: fetch failed` 上报信息（可忽略）。

---

## 附录：批量查询格式

**支持批量**：除 `search` 和 `minute` 外，所有查询类命令支持逗号分隔多股代码。

**批量输出格式**：
```
[Batch] 状态: success | 总数: 3 | 成功: 3 | 失败: 0

<单个symbol独立表格>
```

**部分失败**：
```
[Batch] 状态: partial | 总数: 3 | 成功: 2 | 失败: 1
<成功的表格>
[失败] sh600001: SKILL_006 查询失败
```

---

## 附录：货币单位换算

| 数据类型 | 原始单位 | 转换 |
|---------|---------|------|
| 成交量 | 手 | ÷10000 = 万手 |
| 成交额/市值/主力资金 | 元 | ÷100000000 = 亿元 |
| 港股金额 | 港元 | ÷100000000 = 亿港元 |
| 美股金额 | 美元 | ÷100000000 = 亿美元 |
| 卖空数量 | 股 | ÷1000000 = 百万股 |

---

## 附录：分页格式

**常见分页标识**：
```
共 9999 条（第 1 页，每页 5 条，共 2000 页）
共 1527 只（第 1 页，每页 5 只，共 306 页）
共 921 条（第 1 页，每页 3 条，共 307 页）
```

**通用分页参数**：`--limit N`（每页数量）+ `--offset N`（页码偏移）