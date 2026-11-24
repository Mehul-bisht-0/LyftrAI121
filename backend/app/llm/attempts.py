from __future__ import annotations

from dataclasses import dataclass, field

ALLOWED_STATUSES = {429, 500, 502, 503}


@dataclass
class SimulationPlan:
    per_key: dict[str, int] = field(default_factory=dict)
    wildcard: int | None = None

    def should_fail(self, key_id: str) -> int | None:
        """Return the simulated status code for key_id, or None if no simulation."""
        if key_id in self.per_key:
            return self.per_key[key_id]
        return self.wildcard


def parse_simulation(header: str, valid_key_ids: set[str]) -> SimulationPlan:
    """Parse X-Simulate-Failure header value into a SimulationPlan.

    Raises ValueError with a user-facing message on any validation error.
    """
    plan = SimulationPlan()
    seen: set[str] = set()

    for part in header.split(","):
        part = part.strip()
        if not part:
            continue
        if "=" not in part:
            raise ValueError(f"Malformed simulation pair (expected key=status): {part!r}")
        raw_key, raw_status = part.split("=", 1)
        key = raw_key.strip()
        status_str = raw_status.strip()

        if not status_str.isdigit():
            raise ValueError(f"Status must be a positive integer, got: {status_str!r}")
        status = int(status_str)

        if status not in ALLOWED_STATUSES:
            raise ValueError(
                f"Unsupported simulated status {status}; "
                f"allowed: {sorted(ALLOWED_STATUSES)}"
            )
        if key != "*" and key not in valid_key_ids:
            raise ValueError(
                f"Unknown key_id {key!r}; valid: {sorted(valid_key_ids)}"
            )
        if key in seen:
            raise ValueError(f"Duplicate selector: {key!r}")
        seen.add(key)

        if key == "*":
            plan.wildcard = status
        else:
            plan.per_key[key] = status

    return plan
