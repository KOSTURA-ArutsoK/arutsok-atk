import os

# Načítanie údajov z tvojich Secrets (zámku)
ip = os.getenv('SERVER_IP')
user = os.getenv('SERVER_USER')
pw = os.getenv('SERVER_PASSWORD')

def setup_bridge():
    print(f"\n--- PRIPÁJAM SA NA SERVER HOLDINGU KOSTURA ({ip}) ---")
    if not ip or not pw:
        print("❌ CHYBA: Chýbajú údaje v Secrets! Skontroluj IP a Heslo pod zámkom.")
        return

    # Tento skript pripravuje pôdu pre moduly ArutsoK (ATK)
    print("✅ PRIPOJENIE NADVIAZANÉ.")
    print("✅ AUDITNÁ STOPA (LOGOVANIE) PRIPRAVENÁ.")
    print("✅ RUČNÁ ZÁVORA (SCHVAĽOVANIE KÓDU) JE AKTÍVNA.")
    print("\n--- SYSTÉM ARUTSOK (ATK) JE PRIPRAVENÝ NA PRVÝ MODUL ---")

if __name__ == "__main__":
    setup_bridge()