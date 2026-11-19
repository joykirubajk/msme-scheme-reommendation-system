import json

import pytest
from fastapi.testclient import TestClient

from build_model import build
from parity_cases import BASE

PICKLE = {"id": 1, "name": "Food processing units", "description": "Subsidy for micro food processing units making pickles, snacks and spices.",
          "business_category": "manufacturing", "benefits": {"subsidy_percent": 35}, "rules": {"max_project_cost": 600000}}
TEXTILE = {"id": 2, "name": "Handloom weavers", "description": "Support for handloom weaving and textile artisans.",
           "business_category": "manufacturing", "benefits": {"subsidy_percent": 35}, "rules": {"max_project_cost": 600000}}


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("RANKING_ARTIFACT_DIR", str(tmp_path / "none"))  # no artifact -> adhoc mode
    from app import main
    main.get_model.cache_clear()
    yield TestClient(main.app)
    main.get_model.cache_clear()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "model_version": "adhoc", "mode": "adhoc"}


def test_rank_contract_and_order(client):
    r = client.post("/rank", json={"profile": {**BASE, "business_description": "I make pickles and spice powders at home"}, "schemes": [TEXTILE, PICKLE]})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"model_version", "results"}
    ids = [x["scheme_id"] for x in body["results"]]
    assert ids == [1, 2]  # the pickle scheme wins on text similarity
    for x in body["results"]:
        assert set(x) == {"scheme_id", "score", "reasons"}
        assert 0 <= x["score"] <= 1 and x["reasons"]
    assert body["results"][0]["score"] > body["results"][1]["score"]
    assert any("keywords" in z for z in body["results"][0]["reasons"])


def test_rank_without_description_still_works(client):
    r = client.post("/rank", json={"profile": BASE, "schemes": [PICKLE, TEXTILE]})
    assert r.status_code == 200
    assert [x["scheme_id"] for x in r.json()["results"]] == [1, 2]  # equal scores -> lower id first


def test_empty_schemes(client):
    r = client.post("/rank", json={"profile": {}, "schemes": []})
    assert r.status_code == 200
    assert r.json()["results"] == []


def test_deterministic(client):
    payload = {"profile": {**BASE, "business_description": "pickles"}, "schemes": [PICKLE, TEXTILE]}
    assert client.post("/rank", json=payload).json() == client.post("/rank", json=payload).json()


def test_extra_fields_ignored_and_nulls_ok(client):
    payload = {"profile": {**BASE, "unknown": 1, "age": None}, "schemes": [{**PICKLE, "benefits": None, "rules": None, "beneficiary_categories": None, "extra": 1}]}
    assert client.post("/rank", json=payload).status_code == 200


@pytest.mark.parametrize("payload", [
    {},
    {"profile": {}, "schemes": [{"name": "no id"}]},
    {"profile": {}, "schemes": [{"id": 1, "tier": "not_eligible"}]},
    {"profile": {"age": "abc"}, "schemes": []},
])
def test_invalid_requests_are_422(client, payload):
    assert client.post("/rank", json=payload).status_code == 422


def test_stop_word_only_text_does_not_crash(client):
    payload = {"profile": {**BASE, "business_description": "the and of"}, "schemes": [PICKLE]}
    assert client.post("/rank", json=payload).status_code == 200


def test_loads_built_artifact(monkeypatch, tmp_path):
    seed = tmp_path / "schemes.json"
    seed.write_text(json.dumps([PICKLE, TEXTILE]), encoding="utf-8")
    manifest = build(seed, tmp_path / "art")
    monkeypatch.setenv("RANKING_ARTIFACT_DIR", str(tmp_path / "art"))
    from app import main
    main.get_model.cache_clear()
    c = TestClient(main.app)
    assert c.get("/health").json() == {"status": "ok", "model_version": manifest["model_version"], "mode": "artifact"}
    r = c.post("/rank", json={"profile": {**BASE, "business_description": "handloom weaving"}, "schemes": [PICKLE, TEXTILE]})
    assert [x["scheme_id"] for x in r.json()["results"]] == [2, 1]
    assert r.json()["model_version"] == manifest["model_version"]
    main.get_model.cache_clear()
