from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("team_analytics", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClientSettings",
            fields=[
                ("id", models.PositiveSmallIntegerField(primary_key=True, serialize=False)),
                ("shortcut_hints", models.BooleanField()),
                ("updated_date", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
