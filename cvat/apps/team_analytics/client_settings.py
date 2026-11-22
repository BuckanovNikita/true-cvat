# SPDX-License-Identifier: MIT

"""The rules of the client settings: what an administrator sets in the Team Analytics settings for the
interface of everyone, and so what every signed-in user's interface may read.

One setting so far: whether shortcut hints are shown in the annotation view (UI-3). It is kept in
Postgres in one row for the instance (models.ClientSettings), which does not exist until an
administrator first saves the settings.

The answer of `GET client-settings` is read by every signed-in user, not only by administrators: it
must never hold a figure of anybody's work, a name or anything else an administrator alone may see.

Pure functions only, without Django: the view set (views.py) and the serializers (serializers.py)
call them, and the calculation suite tests them without a configured Django.
"""

from typing import Any

from .technical_accounts import Refused

# Shortcut hints are shown until an administrator switches them off.
SHORTCUT_HINTS_DEFAULT = True


def clean_shortcut_hints(value: Any) -> bool:
    """The switch as a client sends it: JSON true or false, nothing that merely reads as one."""
    if not isinstance(value, bool):
        raise Refused("shortcut_hints must be true or false")
    return value


def shortcut_hints(stored: bool | None) -> bool:
    """Whether shortcut hints are shown; `stored` is None while nothing was saved."""
    return SHORTCUT_HINTS_DEFAULT if stored is None else stored


def answer(stored: bool | None) -> dict[str, bool]:
    """The answer of `GET client-settings`, for every signed-in user."""
    return {"shortcut_hints": shortcut_hints(stored)}
