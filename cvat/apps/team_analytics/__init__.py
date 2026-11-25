# SPDX-License-Identifier: MIT

"""Team Analytics: work figures for a team, computed from CVAT's events into stored totals.

The API process only checks access and reads cached answers (views.py, reads.py); every query to
ClickHouse runs on the app's own worker (jobs.py), through the calculation code in core/.
See docs/maintainers/decisions.md, "ADR 0006".
"""

# The app's queue. Registered in cvat/settings/base.py when analytics is enabled; a worker for it is
# started with `run worker team_analytics` (backend_entrypoint.d/team_analytics.conf).
QUEUE = "team_analytics"
