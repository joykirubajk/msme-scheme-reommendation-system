import filecmp
import json
from pathlib import Path

from build_model import DEFAULT_INPUT, build


def test_build_is_reproducible(tmp_path):
    a = build(DEFAULT_INPUT, tmp_path / "a")
    b = build(DEFAULT_INPUT, tmp_path / "b")
    assert a == b
    assert filecmp.cmp(tmp_path / "a" / "manifest.json", tmp_path / "b" / "manifest.json", shallow=False)
    assert (tmp_path / "a" / a["vectorizer_file"]).exists()


def test_input_order_does_not_change_version(tmp_path):
    schemes = json.loads(Path(DEFAULT_INPUT).read_text(encoding="utf-8"))
    p1, p2 = tmp_path / "1.json", tmp_path / "2.json"
    p1.write_text(json.dumps(schemes), encoding="utf-8")
    p2.write_text(json.dumps(list(reversed(schemes))), encoding="utf-8")
    assert build(p1, tmp_path / "o1")["model_version"] == build(p2, tmp_path / "o2")["model_version"]


def test_corpus_change_changes_version(tmp_path):
    schemes = json.loads(Path(DEFAULT_INPUT).read_text(encoding="utf-8"))
    schemes[0]["description"] += " extra words"
    p = tmp_path / "x.json"
    p.write_text(json.dumps(schemes), encoding="utf-8")
    assert build(p, tmp_path / "o")["model_version"] != build(DEFAULT_INPUT, tmp_path / "o2")["model_version"]


def test_manifest_records_weights_and_versions(tmp_path):
    m = build(DEFAULT_INPUT, tmp_path)
    assert round(sum(m["weights"].values()), 6) == 1.0
    assert m["n_documents"] >= 15 and m["sklearn_version"]
