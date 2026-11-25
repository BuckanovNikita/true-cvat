# SPDX-License-Identifier: MIT

"""What Team Analytics keeps in Postgres: the Technical accounts list (technical_accounts.py) and the
client settings (client_settings.py)."""

from django.db import models


class TechnicalAccount(models.Model):
    """An account that stands for an automated process: its figures are no annotator's.

    Kept by user id with no foreign key to the user table: a user deleted from CVAT stays on the
    list, under its last known name, until someone removes it."""

    user_id = models.PositiveBigIntegerField(primary_key=True)
    # the last known user name; as long as Django's username
    user_name = models.CharField(max_length=150)
    updated_date = models.DateTimeField(auto_now=True)


class ClientSettings(models.Model):
    """What an administrator sets for the interface of everyone: one row for the instance, under
    `ROW`, absent until the settings are first saved (client_settings.py has the defaults)."""

    ROW = 1

    id = models.PositiveSmallIntegerField(primary_key=True)
    # whether shortcut hints are shown in the annotation view (UI-3)
    shortcut_hints = models.BooleanField()
    updated_date = models.DateTimeField(auto_now=True)
