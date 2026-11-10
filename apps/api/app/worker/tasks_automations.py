"""Background tasks for the automations feature.

TASKS: task name -> async fn(ctx, **kwargs); registered with ARQ by app.worker.settings.
CRONS: list of (task_name, arq cron kwargs), e.g. ("send_weekly_digests", {"weekday": {0}, "hour": {3}, "minute": {30}}).
Times are UTC (IST = UTC+5:30).
"""

TASKS: dict = {}
CRONS: list = []
