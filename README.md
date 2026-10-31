# Codex 重置雷达

保留根目录奶油色 index.html 与 assets。radar-live.js 在原页面接入 data/radar.json。

- `.github/workflows/update.yml`：每小时第 17 分钟、手动运行和 main 更新时执行；GitHub 可能延迟调度。
- `scripts/update.py`：免费第三方公开归档采集；新消息只入待核验队列。
- `scripts/review.py` / `reviews.json`：人工核验后的事件审批；默认无新审批。
- `data/radar.json`：历史事件、预测与兑现、原帖缓存、采集状态。
- `tests/`：输入校验与失败保留回归测试。

原始 ZIP 中历史数据保留原状态，不代表本次重新核验；原首页累计统计也是历史人工记录，自动采集不增加次数。

来源失败保留旧数据、最近成功时间和历史预测；页面显示数据延迟。采集成功仅说明取得归档候选，不代表额度重置。不得仅因关键词或第三方记录将预测标为已兑现。核验必须检查原帖、时间、套餐、类型与完成证据。

测试：`python -m unittest discover -s tests -v`

定时工作流同时部署 Pages，避免 GITHUB_TOKEN 的自动提交不触发 Pages 构建。
