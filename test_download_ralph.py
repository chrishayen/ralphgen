"""Tests for download_ralph.py"""

from pathlib import Path
from unittest.mock import patch, Mock

import pytest

from download_ralph import search_frinkiac, download_image, RALPH_SEARCHES


class TestSearchFrinkiac:
    def test_returns_results_on_success(self):
        mock_response = Mock()
        mock_response.json.return_value = [
            {"Id": 1, "Episode": "S04E12", "Timestamp": 123456}
        ]
        mock_response.raise_for_status = Mock()

        with patch("download_ralph.requests.get", return_value=mock_response):
            results = search_frinkiac("Ralph Wiggum")

        assert len(results) == 1
        assert results[0]["Episode"] == "S04E12"

    def test_returns_empty_list_on_error(self):
        with patch("download_ralph.requests.get") as mock_get:
            mock_get.side_effect = Exception("Network error")
            results = search_frinkiac("test")

        assert results == []

    def test_encodes_query_properly(self):
        mock_response = Mock()
        mock_response.json.return_value = []
        mock_response.raise_for_status = Mock()

        with patch("download_ralph.requests.get", return_value=mock_response) as mock_get:
            search_frinkiac("I'm Idaho")
            mock_get.assert_called_once()
            call_url = mock_get.call_args[0][0]
            assert "I%27m%20Idaho" in call_url


class TestDownloadImage:
    def test_downloads_and_saves_image(self, tmp_path):
        mock_response = Mock()
        mock_response.content = b"fake image data"
        mock_response.raise_for_status = Mock()

        with patch("download_ralph.requests.get", return_value=mock_response):
            result = download_image("S04E12", 123456, tmp_path)

        assert result is True
        saved_file = tmp_path / "S04E12_123456.jpg"
        assert saved_file.exists()
        assert saved_file.read_bytes() == b"fake image data"

    def test_skips_existing_file(self, tmp_path):
        existing = tmp_path / "S04E12_123456.jpg"
        existing.write_bytes(b"existing")

        with patch("download_ralph.requests.get") as mock_get:
            result = download_image("S04E12", 123456, tmp_path)

        assert result is False
        mock_get.assert_not_called()

    def test_returns_false_on_error(self, tmp_path):
        with patch("download_ralph.requests.get") as mock_get:
            mock_get.side_effect = Exception("Network error")
            result = download_image("S04E12", 123456, tmp_path)

        assert result is False


class TestRalphSearches:
    def test_has_search_terms(self):
        assert len(RALPH_SEARCHES) > 0

    def test_includes_iconic_quotes(self):
        quotes_lower = [q.lower() for q in RALPH_SEARCHES]
        assert any("idaho" in q for q in quotes_lower)
        assert any("unpossible" in q for q in quotes_lower)
        assert any("choo" in q for q in quotes_lower)
