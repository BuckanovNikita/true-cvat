"""The rules of the client settings (the backend app's client_settings.py): what every signed-in user's
interface reads, and what an administrator may save. Pure functions: no Django, no ClickHouse, no Redis."""

import unittest

from cvat.apps.team_analytics import client_settings as rules
from cvat.apps.team_analytics.technical_accounts import Refused


class ShortcutHintsFlagTest(unittest.TestCase):
    def test_true_and_false_are_kept(self):
        self.assertIs(rules.clean_shortcut_hints(True), True)
        self.assertIs(rules.clean_shortcut_hints(False), False)

    def test_anything_but_true_or_false_is_refused(self):
        for value in (1, 0, "true", "false", "", None, [], {}, 1.0):
            with self.subTest(value=value):
                with self.assertRaises(Refused) as caught:
                    rules.clean_shortcut_hints(value)
                self.assertIn("shortcut_hints must be true or false", str(caught.exception))


class AnswerTest(unittest.TestCase):
    def test_shortcut_hints_are_on_until_an_administrator_saves_otherwise(self):
        self.assertEqual(rules.answer(None), {"shortcut_hints": True})

    def test_the_saved_choice_is_answered(self):
        self.assertEqual(rules.answer(False), {"shortcut_hints": False})
        self.assertEqual(rules.answer(True), {"shortcut_hints": True})

    def test_the_answer_holds_nothing_else(self):
        # every signed-in user reads it: a field added here is shown to everyone
        self.assertEqual(set(rules.answer(None)), {"shortcut_hints"})
