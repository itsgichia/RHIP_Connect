"""Technology Readiness Level (TRL 1–9) helpers for RHIP innovation projects."""

TRL_LABELS: dict[int, str] = {
    1: "Basic principles observed",
    2: "Technology concept formulated",
    3: "Experimental proof of concept",
    4: "Technology validated in lab",
    5: "Technology validated in relevant environment",
    6: "Technology demonstrated in relevant environment",
    7: "System prototype demonstrated in operational environment",
    8: "System complete and qualified",
    9: "Actual system proven in operational environment",
}


def trl_label(trl: int) -> str:
    return TRL_LABELS.get(trl, f"TRL {trl}")


def trl_short_label(trl: int) -> str:
    return f"TRL {trl}"


def readiness_from_trl(trl: int) -> str:
    """Map TRL to legacy readiness band for government/pipeline filters."""
    if trl <= 3:
        return "early"
    if trl <= 5:
        return "feasibility"
    if trl <= 7:
        return "clinical"
    return "commercial"


def trl_from_readiness(readiness: str, stage: int = 5) -> int:
    """Derive TRL from legacy readiness + stage when migrating seed data."""
    base = {
        "early": 3,
        "feasibility": 5,
        "clinical": 6,
        "commercial": 8,
    }.get(readiness, 5)
    if stage >= 8 and base < 8:
        return 8
    if stage >= 7 and base < 7:
        return 7
    if stage >= 6 and base < 6:
        return 6
    return base
