-- Every hotkey action used in [from, to) in the displayed scope (both filters; technical accounts left out),
-- most used first, then by action name, with its share of all hotkey actions and the shortcut hints shown
-- for it. Same hotkey rows and order as the top hotkeys of read/overview_input.sql, so the overview's top rows
-- are this list's first rows. After them, with pressed = 0: the actions a hint was shown for and whose hotkey
-- was never pressed, most hinted first.
WITH
    counted AS (
        SELECT
            name AS action,
            toUInt64(sumIf(actions, kind = 'hotkey')) AS pressed,
            toUInt64(sumIf(actions, kind = 'hint')) AS hinted
        FROM $totals_db.input_hourly
        WHERE hour >= {from:DateTime('Etc/UTC')} AND hour < {to:DateTime('Etc/UTC')}
            AND (hour, version) IN (
                SELECT hour, max(version) FROM $totals_db.hour_versions
                WHERE hour >= {from:DateTime('Etc/UTC')} AND hour < {to:DateTime('Etc/UTC')}
                GROUP BY hour
            )
            AND ({instance:UInt8} = 1 OR org_id = {org_id:UInt64})
            AND user_id NOT IN {technical_accounts:Array(UInt64)}
            AND ({has_project:UInt8} = 0 OR project_id = {project:UInt64})
            AND ({has_annotator:UInt8} = 0 OR user_id = {annotator:UInt64})
            AND kind IN ('hotkey', 'hint')
        GROUP BY name
        HAVING pressed > 0 OR hinted > 0
    ),
    (SELECT toUInt64(sum(pressed)) FROM counted) AS hotkey_actions
SELECT
    toString(action) AS action,
    pressed,
    hinted,
    if(hotkey_actions > 0, pressed / hotkey_actions, 0) AS share,
    hotkey_actions
FROM counted
ORDER BY pressed DESC, if(pressed = 0, hinted, 0) DESC, action ASC
