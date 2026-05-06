#!/usr/bin/env python3
"""Generate Mermaid class diagram markdown from models.py."""

from __future__ import annotations

import ast
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
MODELS_PATH = REPO_ROOT / "models.py"
OUTPUT_PATH = REPO_ROOT / "docs" / "architecture" / "models-class-diagram.md"

IGNORE_TOKENS = {
    "int",
    "str",
    "float",
    "bool",
    "list",
    "set",
    "dict",
    "tuple",
    "Optional",
    "None",
    "field",
}


def is_enum_class(node: ast.ClassDef) -> bool:
    for base in node.bases:
        if isinstance(base, ast.Name) and base.id == "Enum":
            return True
        if isinstance(base, ast.Attribute) and base.attr == "Enum":
            return True
    return False


def is_dataclass(node: ast.ClassDef) -> bool:
    for deco in node.decorator_list:
        if isinstance(deco, ast.Name) and deco.id == "dataclass":
            return True
        if isinstance(deco, ast.Call) and isinstance(deco.func, ast.Name) and deco.func.id == "dataclass":
            return True
    return False


def annotation_to_str(node: ast.AST | None) -> str:
    if node is None:
        return "Any"
    try:
        return ast.unparse(node)
    except Exception:
        return "Any"


def enum_members(node: ast.ClassDef) -> list[str]:
    members: list[str] = []
    for item in node.body:
        if isinstance(item, ast.Assign):
            for target in item.targets:
                if isinstance(target, ast.Name):
                    members.append(target.id)
    return members


def class_fields(node: ast.ClassDef) -> list[tuple[str, str]]:
    fields: list[tuple[str, str]] = []
    seen: set[str] = set()
    for item in node.body:
        if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
            field_name = item.target.id
            fields.append((field_name, annotation_to_str(item.annotation)))
            seen.add(field_name)
        elif isinstance(item, ast.Assign):
            if len(item.targets) != 1 or not isinstance(item.targets[0], ast.Name):
                continue
            field_name = item.targets[0].id
            if field_name in seen:
                continue
            inferred = "Any"
            if isinstance(item.value, ast.Constant):
                if isinstance(item.value.value, bool):
                    inferred = "bool"
                elif isinstance(item.value.value, int):
                    inferred = "int"
                elif isinstance(item.value.value, float):
                    inferred = "float"
                elif isinstance(item.value.value, str):
                    inferred = "str"
                elif item.value.value is None:
                    inferred = "None"
            fields.append((field_name, inferred))
            seen.add(field_name)
    return fields


def class_methods(node: ast.ClassDef) -> list[str]:
    methods: list[str] = []
    for item in node.body:
        if isinstance(item, ast.FunctionDef) and not item.name.startswith("__"):
            ret = annotation_to_str(item.returns) if item.returns else "None"
            methods.append(f"+{item.name}(): {ret}")
    return methods


def referenced_classes(type_text: str, class_names: set[str]) -> set[str]:
    refs: set[str] = set()
    for token in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", type_text):
        if token in class_names and token not in IGNORE_TOKENS:
            refs.add(token)
    return refs


def render_markdown(classes: list[dict], relations: set[tuple[str, str, str]]) -> str:
    lines: list[str] = []
    lines.append("# Models Class Diagram")
    lines.append("")
    lines.append("This diagram is auto-generated from `models.py`. Do not edit manually.")
    lines.append("")
    lines.append("```mermaid")
    lines.append("classDiagram")
    lines.append("direction LR")
    lines.append("")

    for cls in classes:
        lines.append(f"class {cls['name']} {{")
        if cls["kind"] == "enum":
            lines.append("  <<enumeration>>")
            for member in cls["enum_members"]:
                lines.append(f"  {member}")
        else:
            for field_name, field_type in cls["fields"]:
                lines.append(f"  +{field_name}: {field_type}")
            for method_sig in cls["methods"]:
                lines.append(f"  {method_sig}")
        lines.append("}")
        lines.append("")

    for src, dst, label in sorted(relations):
        if label:
            lines.append(f"{src} --> {dst} : {label}")
        else:
            lines.append(f"{src} --> {dst}")

    lines.append("```")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    tree = ast.parse(MODELS_PATH.read_text(encoding="utf-8"))
    class_nodes = [node for node in tree.body if isinstance(node, ast.ClassDef)]
    class_names = {node.name for node in class_nodes}

    class_data: list[dict] = []
    relations: set[tuple[str, str, str]] = set()

    for node in class_nodes:
        kind = "enum" if is_enum_class(node) else ("dataclass" if is_dataclass(node) else "class")
        fields = class_fields(node)
        methods = class_methods(node)
        data = {
            "name": node.name,
            "kind": kind,
            "enum_members": enum_members(node),
            "fields": fields,
            "methods": methods,
        }
        class_data.append(data)

        for field_name, field_type in fields:
            for ref in referenced_classes(field_type, class_names):
                if ref != node.name:
                    relations.add((node.name, ref, field_name))

        for method_sig in methods:
            for ref in referenced_classes(method_sig, class_names):
                if ref != node.name:
                    relations.add((node.name, ref, ""))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_markdown(class_data, relations), encoding="utf-8")
    print(f"Updated {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
