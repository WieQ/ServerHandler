import logging
import os
import re

class ConfigReader:
    def __init__(self, path=".config"):
        self.path = path
        self.config = {}
        self._read_config()

    def _read_config(self):
        if not os.path.exists(self.path):
            logging.warning(f"Nie znaleziono pliku konfiguracyjnego: {self.path}")
            return

        with open(self.path, "r") as file:
            for line in file:
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" in line:
                        key, value = line.split("=", 1)
                        self.config[key.strip()] = value.strip()
                    else:
                        logging.warning(f"Nieprawidłowy wpis w configu: {line}")

    def get(self, key, default=None):
        return self.config.get(key, default)

    def get_time_in_seconds(self, key, default_seconds=None):
        raw_value = self.get(key)
        if raw_value is None:
            return default_seconds

        match = re.match(r"(\d+)\s*(min|m|s)", raw_value)
        if match:
            value, unit = match.groups()
            value = int(value)
            if unit in ("min", "m"):
                return value * 60
            elif unit == "s":
                return value

        logging.warning(f"Nieprawidłowy format czasu w configu: {raw_value}")
        return default_seconds

    def set(self, key, value):
        self.config[key] = str(value)

    def save(self):
        try:
            with open(self.path, "w") as file:
                for key, value in self.config.items():
                    file.write(f"{key} = {value}\n")
            logging.info(f"Konfiguracja zapisana do {self.path}")
        except Exception as e:
            logging.error(f"Błąd zapisu configu: {str(e)}")
