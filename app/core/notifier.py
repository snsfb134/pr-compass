import subprocess


def notify_macos(title: str, message: str, subtitle: str = "") -> bool:
    script = [
        "display notification",
        _osa_quote(message),
    ]
    if title:
        script.extend(["with title", _osa_quote(title)])
    if subtitle:
        script.extend(["subtitle", _osa_quote(subtitle)])

    try:
        subprocess.run(["osascript", "-e", " ".join(script)], check=True)
        return True
    except Exception:
        return False


def _osa_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'
