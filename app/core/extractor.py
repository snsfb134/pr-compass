from bs4 import BeautifulSoup


def extract_main_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for selector in ["script", "style", "noscript", "svg", "header", "footer", "nav"]:
        for node in soup.select(selector):
            node.decompose()
    main = soup.find("main") or soup.find("article") or soup.body or soup
    lines = [line.strip() for line in main.get_text("\n").splitlines()]
    cleaned = [line for line in lines if line]
    return "\n".join(cleaned)
