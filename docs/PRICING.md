# PRICING.md — 收费策略与 credit 账本契约

> 状态:定稿 v1(待 @user 确认两处:① 是否开通 `doubao-seedance-1-0-pro-fast` 作为成本锚;② Free 档是否真上水印)。
> 本文档是后端账本迁移、前端计费 UI、QA 测试的唯一数据源。改动必须同步本文。

## 1. 计费单元:credit(整数,禁止浮点)

换模型不动账目,`credit` 是 provider/模型无关的抽象。**账目一律用整数 unit,前端只读整数,永不出现小数。**

| 分辨率 | unit/秒 |
|---|---|
| 480p | 1 |
| 720p | 2 |
| 1080p | 5 |

- 一次 render 消费 = `分辨率 unit/秒 × 时长(秒)`。
- 金额只在后端 `cost_cents`(USD 分)层换算:由 `units × 套餐单价` 得出,Stripe metered 用。

## 2. 套餐(四档,新增 `business`)

| 套餐 | 月费 | 含 credit(unit) | 超额 | 差异 |
|---|---|---|---|---|
| Free | $0 | 40(注册送) | 不可超额 | 720p、社区队列、1 key |
| Pro | $19 | 800 | 计费 | +1080p、优先队列、5 key、webhook |
| Business | $99 | 5000 | 计费 | +团队协作、用量 API、SLA |
| Enterprise | 定制 | 自定义 | 合同价 | 私有化/专属模型/专属支持 |

- `Plan` 枚举:`free` / `pro` / `business`(新增)/ `enterprise`。现有代码无 `business`,迁移时补。
- Free 档「水印」暂缓,当前以「社区队列 + 低优先级」做差异化(见 §6)。

## 3. COGS 锚点(⚠️ 阻塞)

- 实测唯一开通模型 `doubao-seedance-1-0-pro-250528`(贵版):5s 720p ≈ ¥1.5(~¥0.3/s)。
- 毛利目标是锚在 `doubao-seedance-1-0-pro-fast`(COGS 降 ~72%),**该模型尚未开通**。
- **定价表上线前,@user 必须二选一**:开通 fast 版,或按贵版重算定价。fast 未开通前,本定价表不得用于真实计费。

## 4. credit 账本 schema

现有库全表 **Integer 自增 PK**(非 UUID)。账本沿用 Integer,零破坏迁移。

```python
class CreditTransaction(Base):
    __tablename__ = "credit_transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), nullable=False, index=True)
    amount_units: Mapped[int]          # 有符号:+充值/订阅, -消费
    type: Mapped[CreditTxnType]        # grant | subscription | usage | refund | admin_adjust
    ref_render_id: Mapped[int | None] = mapped_column(ForeignKey("renders.id"), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    __table_args__ = (UniqueConstraint("idempotency_key", "type", name="uq_credit_idem_type"),)

# Workspace 增列: credits_balance_units: Mapped[int]  (去规范化余额,账本事务内维护)
# Render 增列:   credits_consumed_units: Mapped[int]  (落库结算)
#                cost_cents 保留,由 units × 套餐单价换算
```

**幂等命门**:唯一约束 `(idempotency_key, type)` —— 同一渲染的扣减(`usage`)与回冲(`refund`)**复用同一个 `idempotency_key`**,靠 `type` 区分,保证重试下每类事务只落一次、net 恒为 0,杜绝重复扣款/重复回冲。

## 5. 计费流程(先扣后跑 + 失败回冲)

`POST /v1/renders` 三段同串,全程一个 `idempotency_key`(= 请求的 `Idempotency-Key` header):

1. **预检扣减**:余额不足 → 立即 **402**,不调 provider(Ark 一次都不被调)。
   ```json
   402 { "code": "insufficient_credits", "credits_required": 10, "credits_available": 4 }
   ```
   `credits_required` / `credits_available` 均为 **unit 整数**。
2. **扣减 + 创建 render 同事务**:`usage` 事务(负 `amount_units`)+ `Render` 行原子提交;失败回滚两者。
3. **submit 失败回冲**:provider 抛 503 `video_unavailable` → 落 `refund` 事务(正 `amount_units`,复用同 `idempotency_key`),余额回冲,render 置 `failed`。

### 5.1 余额 API 字段(前端消费端契约)

- workspace 余额字段统一命名 **`credits_balance_units`**(整数,非负),在 `GET /v1/workspace`(及任何含余额的响应)返回。
- 402 body:`{ "code": "insufficient_credits", "credits_required": <int>, "credits_available": <int> }`,两者均为 unit 整数;`credits_available` ≡ 当前 `credits_balance_units`。
- 前端只读整数 unit,不做浮点换算;`failed` 态须 refetch `credits_balance_units`(回冲后余额会变)。

## 6. 待 @user 决策(阻塞项)

1. **开通 `doubao-seedance-1-0-pro-fast`?**(定价 COGS 锚点,见 §3)
2. **Free 档水印**:上 FFmpeg 水印工序,还是暂以「社区队列 + 低优先级」差异化?

## 7. 验收标准

- 余额不足 → 402 + 结构化 body,Ark 零调用。
- submit 503 → 有且仅有一笔 net=0 的 扣减+回冲 对,重试幂等。
- 并发扣减(同 workspace)→ 余额不出现负值、不重复扣款。
- 前端余额条/预估器只读整数 unit;`failed` 态自动 refetch balance。
