# backend/tests/test_data.py

import pytest
from flask import Flask
from unittest.mock import MagicMock, patch

from services.supabase_client import (
    client_anon,
    client_service,
    _service
)


@pytest.fixture
def app():
    app = Flask(__name__)

    app.config["SUPABASE_URL"] = "https://test.supabase.co"
    app.config["SUPABASE_ANON_KEY"] = "anon_key_test"
    app.config["SUPABASE_SERVICE_KEY"] = "service_key_test"

    return app


def test_client_anon(app):
    with app.app_context():

        fake_client = MagicMock()

        with patch(
            "services.supabase_client.create_client",
            return_value=fake_client
        ):

            client = client_anon()

            assert client == fake_client


def test_client_anon_with_jwt(app):
    with app.app_context():

        fake_client = MagicMock()

        with patch(
            "services.supabase_client.create_client",
            return_value=fake_client
        ):

            jwt = "fake_jwt_token"

            client = client_anon(jwt)

            fake_client.postgrest.auth.assert_called_once_with(jwt)
            assert client == fake_client


def test_client_service(app):
    with app.app_context():

        _service.cache_clear()

        fake_client = MagicMock()

        with patch(
            "services.supabase_client.create_client",
            return_value=fake_client
        ):

            client = client_service()

            assert client == fake_client


def test_client_service_without_key(app):
    with app.app_context():

        _service.cache_clear()

        app.config.pop("SUPABASE_SERVICE_KEY")

        with pytest.raises(RuntimeError):
            client_service()


def test_service_cache(app):
    with app.app_context():

        _service.cache_clear()

        fake_client = MagicMock()

        with patch(
            "services.supabase_client.create_client",
            return_value=fake_client
        ) as mock_create:

            c1 = client_service()
            c2 = client_service()

            assert c1 is c2

            # create_client solo debe ejecutarse una vez
            mock_create.assert_called_once()