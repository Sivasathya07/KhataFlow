from decimal import Decimal

from app.services.voice_service import _extract_line_items, _normalise_spoken_numbers


def test_normalises_fractional_terms() -> None:
    assert _normalise_spoken_numbers("half kg onion") == "0.5 kg onion"


def test_parses_compact_item_price() -> None:
    items = _extract_line_items("2 kg tomato 50", 0.9)
    assert len(items) == 1
    assert items[0].product_name == "Tomato"
    assert items[0].quantity == Decimal("2")
    assert items[0].unit_price == Decimal("50")
