import difflib


def diff_excerpt(old: str, new: str, limit: int = 5000) -> str:
    old_lines = old.splitlines()
    new_lines = new.splitlines()
    diff = difflib.unified_diff(old_lines, new_lines, fromfile="previous", tofile="current", lineterm="")
    text = "\n".join(diff)
    return text[:limit]
