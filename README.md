# Codex 重置雷达

保留根目录奶油色 index.html 与 assets。radar-live.js 在原页面接入 data/radar.json。

- `.github/workflows/update.yml`：每小时第 17 分钟、手动运行和 main 更新时执行；GitHub 可能延迟调度。
- `scripts/update.py`：免费第三方公开归档采集；新消息只入待核验队列。
- `scripts/auto_review.py`：双来源自动复核——Tibo 本人完成帖 + 24 小时内第三方归档落地记录相互印证，才标记自动确认；人工审批事件不被覆盖。
- `scripts/review.py` / `reviews.json`：人工核验后的事件审批；默认无新审批，人工记录优先于自动结果。
- `data/radar.json`：历史事件、预测与兑现、原帖缓存、采集状态与首页投影。
- `tests/`：输入校验、失败保留与双来源配对回归测试。

原始 ZIP 中历史数据保留原状态，不代表本次重新核验；原首页累计统计也是历史人工记录，自动采集不增加次数。

来源失败保留旧数据、最近成功时间和历史预测；页面显示数据延迟。采集成功仅说明取得归档候选，不代表额度重置。自动确认必须同时满足 Tibo 本人完成帖与第三方归档落地记录（24 小时内）双来源；仅关键词、单条第三方记录或评论猜测不足以确认。人工审批事件始终优先。最终以个人账号 Usage 为准。

测试：`python -m unittest discover -s tests -v`

定时工作流同时部署 Pages，避免 GITHUB_TOKEN 的自动提交不触发 Pages 构建。
