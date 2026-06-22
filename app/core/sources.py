import json

from app.core.db import execute, rows

SEED_SOURCES = [
    {
        "source_id": "welcomebc_bc_pnp_overview",
        "title": "BC PNP Overview",
        "url": "https://www.welcomebc.ca/immigrate-to-b-c/about-the-bc-provincial-nominee-program",
        "publisher": "WelcomeBC",
        "source_type": "official",
        "program_tags": ["bc_pnp"],
        "check_frequency": "daily",
    },
    {
        "source_id": "welcomebc_bc_pnp_invitations",
        "title": "BC PNP Invitations to Apply",
        "url": "https://www.welcomebc.ca/immigrate-to-b-c/about-the-bc-provincial-nominee-program/invitations-to-apply",
        "publisher": "WelcomeBC",
        "source_type": "official",
        "program_tags": ["bc_pnp", "draws", "skills_immigration", "entrepreneur"],
        "check_frequency": "daily",
    },
    {
        "source_id": "welcomebc_skills_immigration",
        "title": "BC PNP Skills Immigration",
        "url": "https://www.welcomebc.ca/immigrate-to-b-c/skills-immigration",
        "publisher": "WelcomeBC",
        "source_type": "official",
        "program_tags": ["bc_pnp", "skills_immigration", "eebc"],
        "check_frequency": "daily",
    },
    {
        "source_id": "welcomebc_entrepreneur_immigration",
        "title": "BC PNP Entrepreneur Immigration",
        "url": "https://www.welcomebc.ca/immigrate-to-b-c/entrepreneur-immigration",
        "publisher": "WelcomeBC",
        "source_type": "official",
        "program_tags": ["bc_pnp", "entrepreneur"],
        "check_frequency": "daily",
    },
    {
        "source_id": "welcomebc_regional_immigration",
        "title": "BC Regional Immigration Collaboration",
        "url": "https://www.welcomebc.ca/immigrate-to-b-c/about-the-bc-provincial-nominee-program/regional-immigration",
        "publisher": "WelcomeBC",
        "source_type": "official",
        "program_tags": ["bc_pnp", "regional", "entrepreneur"],
        "check_frequency": "daily",
    },
    {
        "source_id": "welcomebc_bc_pnp_online",
        "title": "BC PNP Online User Portal Updates",
        "url": "https://www.welcomebc.ca/immigrate-to-b-c/about-the-bc-provincial-nominee-program/bc-pnp-online-user-portal",
        "publisher": "WelcomeBC",
        "source_type": "official",
        "program_tags": ["bc_pnp", "portal", "program_status"],
        "check_frequency": "daily",
    },
    {
        "source_id": "ircc_express_entry_rounds",
        "title": "Express Entry Rounds of Invitations",
        "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html",
        "publisher": "IRCC",
        "source_type": "official",
        "program_tags": ["express_entry", "cec", "fsw", "federal"],
        "check_frequency": "daily",
    },
    {
        "source_id": "ircc_express_entry_ministerial_instructions",
        "title": "Express Entry Ministerial Instructions Draw History",
        "url": "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html",
        "publisher": "IRCC",
        "source_type": "official",
        "program_tags": ["express_entry", "draws", "cec", "pnp", "federal"],
        "check_frequency": "daily",
    },
    {
        "source_id": "ircc_rcip_overview",
        "title": "Rural Community Immigration Pilot",
        "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/rural-immigration.html",
        "publisher": "IRCC",
        "source_type": "official",
        "program_tags": ["rcip", "federal"],
        "check_frequency": "daily",
    },
    {
        "source_id": "ircc_processing_times",
        "title": "IRCC Current Processing Times",
        "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html",
        "publisher": "IRCC",
        "source_type": "official",
        "program_tags": ["processing_times", "federal", "service_delivery"],
        "check_frequency": "daily",
    },
    {
        "source_id": "ircc_program_delivery_updates",
        "title": "IRCC Program Delivery Updates",
        "url": "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/updates.html",
        "publisher": "IRCC",
        "source_type": "official",
        "program_tags": ["policy", "operational_updates", "federal"],
        "check_frequency": "daily",
    },
    {
        "source_id": "ircc_express_entry_reforms_consultation",
        "title": "2026 Express Entry Reforms Consultation",
        "url": "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/transparency/consultations/2026-consultation-express-entry-reforms.html",
        "publisher": "IRCC",
        "source_type": "official",
        "program_tags": ["express_entry", "policy", "consultation", "federal"],
        "check_frequency": "daily",
    },
]


def seed_sources() -> None:
    for source in SEED_SOURCES:
        execute(
            """
            insert into sources (
              source_id, title, url, publisher, source_type, program_tags, check_frequency
            ) values (?, ?, ?, ?, ?, ?, ?)
            on conflict(source_id) do update set
              title = excluded.title,
              url = excluded.url,
              publisher = excluded.publisher,
              source_type = excluded.source_type,
              program_tags = excluded.program_tags,
              check_frequency = excluded.check_frequency
            """,
            (
                source["source_id"],
                source["title"],
                source["url"],
                source["publisher"],
                source["source_type"],
                json.dumps(source["program_tags"], ensure_ascii=False),
                source["check_frequency"],
            ),
        )


def list_sources() -> list[dict]:
    items = rows("select * from sources order by publisher, title")
    for item in items:
        item["program_tags"] = json.loads(item["program_tags"])
    return items
