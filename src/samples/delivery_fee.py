"""Delivery fee calculator. FAKE sample for SellerCheck demo: contains no personal data or secrets."""

import os

API_TOKEN = os.environ.get("COURIER_API_TOKEN")  # read from the environment, never hard-coded

ZONES = {"central": 3.50, "east": 4.00, "west": 4.50, "north": 4.50}
FREE_ABOVE_SGD = 60.0


def delivery_fee(zone: str, basket_sgd: float) -> float:
    """Return the delivery fee in SGD for a zone and basket total."""
    if basket_sgd >= FREE_ABOVE_SGD:
        return 0.0
    return ZONES.get(zone.lower(), 5.00)


if __name__ == "__main__":
    print(delivery_fee("east", 42.0))
