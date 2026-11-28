#!/usr/bin/env python3
"""Read-only, standard-library audit of the supplied curriculum EXAMPLES.

This is not a verifier for the future production question bank or every editorial
constraint. It independently parses all example expressions using exact Fraction
arithmetic, checks their stored keys/ASTs/display answers, verifies catalogue
structure, checks the four documented example/rule conflicts, and enumerates 15
small canonical pools. No eval, external service, subprocess, or file mutation.

Usage:
  python3 qa/source_audit_verifier.py
  python3 qa/source_audit_verifier.py --registry curriculum/registry.json --patched

Without --patched, original curriculum_version 1.0.0-draft.1 expects exactly the
four documented source findings; any other version expects zero such findings.
Exit 0 means the specified source/patch audit passed, NOT that a website or full
bank of questions is production ready. Output is one UTF-8 JSON object on stdout.
"""
from __future__ import annotations

import argparse
from collections import Counter
from fractions import Fraction
from hashlib import sha256
import json
from math import gcd
from pathlib import Path
import re
import sys

ORIGINAL_VERSION = "1.0.0-draft.1"
ORIGINAL_SHA256 = "3f4df37542b5a7570e405483001810013365f6641bb8ebb0c24359d94ff01012"
OP_NAMES = {"ADD": "addition", "SUB": "subtraction", "MUL": "multiplication", "DIV": "division", "MIX": "mixed"}
SYMBOL_OP = {"+": "ADD", "-": "SUB", "−": "SUB", "*": "MUL", "×": "MUL", "/": "DIV", "÷": "DIV"}
KNOWN = {
    "AC-001": ("arithmetic.addition.g02.l05", "198+42"),
    "AC-002": ("arithmetic.mixed.g11.l03", "144⁄175×245⁄216+1⁄3"),
    "AC-003": ("arithmetic.division.g12.l01", "249950÷25"),
    "AC-004": ("arithmetic.mixed.g12.l02", "(1⁄64+0.015625)×3200"),
}
TOKEN = re.compile(r"\s*(?:(?P<fraction>\d+⁄\d+)|(?P<number>\d+(?:\.\d+)?)|(?P<operator>[()+−×÷*/-]))")
INTEGER = re.compile(r"-?(?:0|[1-9]\d*)\Z")
POSITIVE_INTEGER = re.compile(r"[1-9]\d*\Z")


class ExactExpressionParser:
    """Precedence parser independent of the stored AST and source generator."""
    def __init__(self, expression: str):
        self.expression = expression
        self.tokens: list[str] = []
        position = 0
        while position < len(expression):
            if not expression[position:].strip():
                break
            match = TOKEN.match(expression, position)
            if match is None:
                raise ValueError(f"Unsupported token at offset {position}")
            self.tokens.append(match.group(match.lastgroup))
            position = match.end()
        self.index = 0
        self.operations: list[str] = []
        self.leaves: list[Fraction] = []
        self.intermediates: list[Fraction] = []
        self.depth = 0

    def peek(self):
        return self.tokens[self.index] if self.index < len(self.tokens) else None

    def factor(self) -> Fraction:
        self.depth += 1
        if self.depth > 100:
            raise ValueError("Expression nesting exceeds 100")
        sign = 1
        while self.peek() in ("+", "-", "−"):
            if self.peek() != "+":
                sign *= -1
            self.index += 1
        if self.peek() == "(":
            self.index += 1
            value = self.additive()
            if self.peek() != ")":
                raise ValueError("Missing closing parenthesis")
            self.index += 1
            value *= sign
            if sign < 0:
                self.intermediates.append(value)
        else:
            token = self.peek()
            if token is None or token in ("+", "-", "−", "×", "*", "÷", "/", ")"):
                raise ValueError("Expected numeric operand")
            self.index += 1
            value = sign * Fraction(token.replace("⁄", "/"))
            self.leaves.append(value)
        self.depth -= 1
        return value

    def multiplicative(self) -> Fraction:
        value = self.factor()
        while self.peek() in ("×", "*", "÷", "/"):
            symbol = self.peek()
            self.index += 1
            right = self.factor()
            value = value * right if symbol in ("×", "*") else value / right
            self.operations.append(SYMBOL_OP[symbol])
            self.intermediates.append(value)
        return value

    def additive(self) -> Fraction:
        value = self.multiplicative()
        while self.peek() in ("+", "-", "−"):
            symbol = self.peek()
            self.index += 1
            right = self.multiplicative()
            value = value + right if symbol == "+" else value - right
            self.operations.append(SYMBOL_OP[symbol])
            self.intermediates.append(value)
        return value

    def parse(self) -> Fraction:
        value = self.additive()
        if self.index != len(self.tokens):
            raise ValueError(f"Unexpected trailing token {self.peek()!r}")
        return value


def rational(value: dict, *, canonical: bool = True) -> Fraction:
    numerator, denominator = value["numerator"], value["denominator"]
    if not isinstance(numerator, str) or not INTEGER.fullmatch(numerator):
        raise ValueError("Numerator must be a signed integer string")
    if not isinstance(denominator, str) or not POSITIVE_INTEGER.fullmatch(denominator):
        raise ValueError("Denominator must be a positive integer string")
    n, d = int(numerator), int(denominator)
    if canonical and (gcd(abs(n), d) != 1 or (n == 0 and (d != 1 or numerator != "0"))):
        raise ValueError("Rational is not in canonical reduced form")
    return Fraction(n, d)


def stored_ast_value(node: dict, depth: int = 0) -> Fraction:
    if depth > 100:
        raise ValueError("Stored AST nesting exceeds 100")
    if node["kind"] == "rational":
        return rational(node)
    if node["kind"] != "binary":
        raise ValueError("Unknown AST node kind")
    left = stored_ast_value(node["left"], depth + 1)
    right = stored_ast_value(node["right"], depth + 1)
    operation = node["operation"]
    if operation == "ADD":
        return left + right
    if operation == "SUB":
        return left - right
    if operation == "MUL":
        return left * right
    if operation == "DIV":
        return left / right
    raise ValueError("Unknown AST operator")


def expected_active(grade: int, level: int, operation: str) -> bool:
    if grade == 1:
        return operation in ("ADD", "SUB") or (level == 5 and operation == "MIX")
    if grade == 2 and level <= 2:
        return operation in ("ADD", "SUB", "MIX")
    if grade == 2 and level == 3:
        return operation != "DIV"
    return True


def enumerate_small_pools() -> dict:
    pools = {
        "G01-L01-ADD": {tuple(sorted((a, b))) for a in range(6) for b in range(6) if a + b <= 5},
        "G01-L01-SUB": {(a, b) for a in range(6) for b in range(a + 1)},
        "G01-L02-ADD": {tuple(sorted((a, b))) for a in range(11) for b in range(11) if a + b <= 10},
        "G01-L02-SUB": {(a, b) for a in range(11) for b in range(a + 1)},
        "G01-L03-ADD": {tuple(sorted((a, b))) for a in range(10, 20) for b in range(10) if a + b <= 19},
        "G01-L03-SUB": {(a, b) for a in range(10, 20) for b in range(10) if a - b >= 10},
        "G01-L04-ADD": {tuple(sorted((a, b))) for a in range(1, 10) for b in range(1, 10) if 10 <= a + b <= 18},
        "G01-L04-SUB": {(a, b) for a in range(10, 19) for b in range(1, 10) if 0 <= a - b < 10},
        "G01-L05-ADD": {tuple(sorted((a, b))) for a in range(10, 91, 10) for b in range(91) if (b <= 9 or b % 10 == 0) and a + b <= 100},
        "G01-L05-SUB": {(a, b) for a in range(10, 101) for b in range(91) if (b % 10 == 0 or b <= a % 10) and b <= a},
        "G01-L05-MIX": {(a, b, c) for a in range(10, 91, 10) for b in range(1, 10) for c in range(1, b + 1)},
        "G02-L03-MUL": {tuple(sorted((a, b))) for a in (2, 5, 10) for b in range(11)},
        "G02-L04-MUL": {tuple(sorted((a, b))) for a in (2, 5, 10) for b in range(13)},
        "G02-L05-MUL": {tuple(sorted((a, b))) for a in (2, 3, 4, 5, 10) for b in range(11)},
        "G03-L01-MUL": {tuple(sorted((a, b))) for a in range(11) for b in range(11)},
    }
    expected = dict(zip(pools, (12, 21, 36, 66, 55, 55, 25, 45, 115, 955, 405, 30, 36, 45, 66)))
    actual = {key: len(pool) for key, pool in pools.items()}
    if actual != expected:
        raise ValueError("Canonical pool enumeration mismatch")
    return actual


def audit(path: Path, force_patched: bool) -> dict:
    raw = path.read_bytes()
    data = json.loads(raw)
    version = data.get("curriculum_version")
    patched = force_patched or version != ORIGINAL_VERSION
    errors: list[dict] = []
    findings: list[dict] = []
    counters: Counter = Counter()
    by_id: dict[str, dict] = {}
    parsed: dict[str, ExactExpressionParser] = {}
    grades: Counter = Counter()
    levels_seen = set()

    def error(code, competency_id=None, detail=None):
        errors.append({"code": code, "competency_id": competency_id, "detail": detail})

    for level in data["levels"]:
        grade, tier = level["grade"], level["level"]
        pair = (grade, tier)
        if pair in levels_seen:
            error("duplicate_grade_level", detail=pair)
        levels_seen.add(pair)
        if level.get("grade_level_id") != f"G{grade:02}-L{tier:02}":
            error("grade_level_id_mismatch", detail=pair)
        local_ops = [item["operation"] for item in level["competencies"]]
        if Counter(local_ops) != Counter(OP_NAMES.keys()):
            error("category_slots_mismatch", detail=pair)
        for competency in level["competencies"]:
            counters["slots"] += 1
            cid, operation = competency["competency_id"], competency["operation"]
            if cid in by_id:
                error("duplicate_competency_id", cid)
            by_id[cid] = competency
            expected_id = f"arithmetic.{OP_NAMES[operation]}.g{grade:02}.l{tier:02}"
            if cid != expected_id:
                error("competency_id_mismatch", cid, expected_id)
            if competency["active"] != expected_active(grade, tier, operation):
                error("active_policy_mismatch", cid)
            if not competency["active"]:
                counters["inactive"] += 1
                continue
            counters["active"] += 1
            grades[grade] += 1
            counters["package_target_ceiling"] += competency["package_target_ceiling"]
            counters["question_slot_target_ceiling"] += competency["package_target_ceiling"] * competency["items_per_package_target"]
            try:
                example = competency["example"]
                parser = ExactExpressionParser(example["expression"])
                value = parser.parse()
                parsed[cid] = parser
                key = rational(example["answer"])
                counters["expression_checks"] += 1
                if value != key:
                    error("answer_value_mismatch", cid, {"actual": str(value), "stored": str(key)})
                else:
                    counters["exact_answers_passed"] += 1
                ast_value = stored_ast_value(example["ast"])
                counters["ast_checks"] += 1
                if ast_value != value:
                    error("ast_value_mismatch", cid, {"actual": str(value), "stored_ast": str(ast_value)})
                else:
                    counters["ast_checks_passed"] += 1
                alternatives = example["display_answer"].split(" = ")
                counters["display_answer_checks"] += 1
                if any(Fraction(text.strip()) != value for text in alternatives):
                    error("display_answer_mismatch", cid, example["display_answer"])
                else:
                    counters["display_answer_checks_passed"] += 1
                values = parser.leaves + parser.intermediates
                if grade <= 6 and any(number < 0 for number in values):
                    error("negative_value_before_grade7", cid)
                if grade <= 4 and any(number.denominator != 1 for number in values):
                    error("noninteger_value_before_grade5", cid)
                if operation != "MIX" and parser.operations != [operation]:
                    error("single_operation_example_mismatch", cid, parser.operations)
                if operation == "MIX":
                    if len(set(parser.operations)) < 2:
                        error("mixed_requires_two_distinct_operations", cid)
                    bounds = re.match(r"(\d+)–(\d+) operasi", competency["rule_spec"])
                    if bounds:
                        minimum, maximum = int(bounds[1]), int(bounds[2])
                    elif competency["rule_spec"].startswith("dua operasi") or (grade, tier) in ((1, 5), (2, 1), (2, 2)):
                        minimum = maximum = 2
                    else:
                        minimum = maximum = None
                    if minimum is not None and not minimum <= len(parser.operations) <= maximum:
                        issue = {"arithmetic.mixed.g11.l03": "AC-002", "arithmetic.mixed.g12.l02": "AC-004"}.get(cid, "UNEXPECTED-MIX-COUNT")
                        findings.append({"issue_id": issue, "competency_id": cid, "expression": example["expression"], "observed": len(parser.operations), "required": [minimum, maximum]})
            except (ValueError, KeyError, TypeError, ZeroDivisionError, OverflowError) as exc:
                error("example_evaluation_error", cid, str(exc))

    expected_pairs = {(grade, tier) for grade in range(1, 13) for tier in range(1, 6)}
    if levels_seen != expected_pairs:
        error("level_coverage_mismatch", detail={"missing": sorted(expected_pairs - levels_seen), "extra": sorted(levels_seen - expected_pairs)})
    expected_counts = {"slots": 300, "active": 281, "inactive": 19, "package_target_ceiling": 4604, "question_slot_target_ceiling": 177640}
    for key, expected in expected_counts.items():
        if counters[key] != expected:
            error("count_mismatch", detail={"field": key, "actual": counters[key], "expected": expected})
    capacity = data["capacity"]
    expected_capacity = {"grade_levels": 60, "possible_cells": 300, "active_cells": 281, "inactive_cells": 19}
    for key, expected in expected_capacity.items():
        if capacity.get(key) != expected:
            error("capacity_metadata_mismatch", detail=key)
    variable = capacity["recommended_variable_ceiling"]
    if variable != {"package_slots": 4604, "question_slots": 177640}:
        error("capacity_variable_ceiling_mismatch", detail=variable)

    active_ids = {cid for cid, item in by_id.items() if item["active"]}
    for cid, item in by_id.items():
        for dependency in item.get("prerequisite_candidates", []):
            if dependency not in active_ids:
                error("missing_or_inactive_prerequisite", cid, dependency)
    state = {}
    def visit(cid, stack):
        if state.get(cid) == 1:
            error("prerequisite_cycle", cid, stack + [cid])
            return
        if state.get(cid) == 2:
            return
        state[cid] = 1
        for dep in by_id[cid].get("prerequisite_candidates", []):
            if dep in by_id:
                visit(dep, stack + [cid])
        state[cid] = 2
    for cid in by_id:
        visit(cid, [])

    cid = KNOWN["AC-001"][0]
    if cid in parsed:
        parser = parsed[cid]
        operands = parser.leaves
        valid = len(operands) == 2 and parser.operations == ["ADD"]
        if valid:
            a, b = operands
            valid = (a.denominator == b.denominator == 1 and 10 <= a <= 299 and 10 <= b <= 299 and a + b <= 500
                     and any(min(int(n) % 10, 10 - int(n) % 10) <= 1 for n in operands))
        if not valid:
            findings.append({"issue_id": "AC-001", "competency_id": cid, "expression": by_id[cid]["example"]["expression"], "reason": "Requires operands 10–299, sum ≤500, and at least one multiple of 10 or distance 1."})

    cid = KNOWN["AC-003"][0]
    if cid in parsed:
        parser = parsed[cid]
        valid = len(parser.leaves) == 2 and parser.operations == ["DIV"]
        if valid:
            a, b = parser.leaves
            q = a / b if b else Fraction(0)
            valid_b = b != 0 and (abs(b) in (25, 125, 250) or any(1 <= abs(abs(b) - anchor) <= 20 for anchor in (1000, 10000)))
            valid = a.denominator == b.denominator == q.denominator == 1 and valid_b and 10 <= abs(q) <= 5000 and abs(a) <= 50000000
        if not valid:
            findings.append({"issue_id": "AC-003", "competency_id": cid, "expression": by_id[cid]["example"]["expression"], "reason": "Requires integer quotient magnitude 10–5000 and stated near-base/friendly divisor."})

    findings.sort(key=lambda item: item["issue_id"])
    observed = {(item["issue_id"], item["competency_id"]) for item in findings}
    expected = set() if patched else {(issue, item[0]) for issue, item in KNOWN.items()}
    if observed != expected or len(findings) != len(expected):
        error("known_finding_set_mismatch", detail={"expected": sorted(expected), "observed": sorted(observed)})
    if not patched:
        for issue, (cid, expression) in KNOWN.items():
            if by_id.get(cid, {}).get("example", {}).get("expression") != expression:
                error("original_example_changed_without_patch_mode", cid, issue)
    pools = enumerate_small_pools()
    return {
        "status": "PASS" if not errors else "FAIL",
        "scope": "source_curriculum_examples_and_known_errata_only_not_production_bank",
        "registry": str(path.resolve()),
        "sha256": sha256(raw).hexdigest(),
        "matches_original_source_bytes": sha256(raw).hexdigest() == ORIGINAL_SHA256,
        "curriculum_version": version,
        "audit_profile": "patched_zero_known_findings" if patched else "original_four_expected_findings",
        "profile_selected_by": "--patched" if force_patched else "curriculum_version",
        "method": "Independent recursive-descent expression parser, Fraction exact arithmetic, whitelist AST evaluator; no eval.",
        "counts": dict(counters),
        "active_by_grade": {str(key): grades[key] for key in sorted(grades)},
        "findings": findings,
        "errors": errors,
        "small_pool_exact_counts": pools,
        "pool_count_convention": "Finite source domains; ADD/MUL operand swaps canonicalized; ordered SUB; fraction literals are values, not extra DIV nodes.",
        "limitations": ["Editorial constraints for all 281 cells are not fully executable here.", "Only the four documented source conflicts and stated generic mathematical/structural checks are asserted.", "The future generated bank, website, UX, LMS, academic pilot and production readiness are not tested by this script."]
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--registry", type=Path, default=Path(__file__).resolve().parents[1] / "00_SUMBER" / "KALIBATAKU_CURRICULUM_REGISTRY_v1.json")
    parser.add_argument("--patched", action="store_true", help="Expect no known example/rule conflicts, even if source version was retained.")
    args = parser.parse_args()
    try:
        result = audit(args.registry, args.patched)
    except (OSError, ValueError, KeyError, TypeError, IndexError, RecursionError) as exc:
        result = {"status": "FAIL", "scope": "source_curriculum_examples_and_known_errata_only_not_production_bank", "errors": [{"code": "audit_input_or_structure_error", "detail": str(exc)}]}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
