import os

class LogReader:
    def __init__(self, log_file_path):
        self.log_file_path = log_file_path
        self.last_read_position = 0

    def get_logs(self):
        """Funkcja do odczytania nowych logów z pliku"""
        if not os.path.exists(self.log_file_path):
            return []

        with open(self.log_file_path, 'r') as log_file:
            log_file.seek(self.last_read_position)  # Przesuwamy wskaźnik do ostatniej przeczytanej pozycji
            new_logs = log_file.readlines()  # Odczytujemy wszystkie nowe linie

            # Sprawdzamy, czy są nowe logi
            if new_logs:
                print(f"Nowe logi: {new_logs}")

            # Aktualizujemy pozycję, gdzie skończyliśmy odczyt
            self.last_read_position = log_file.tell()

        return [line.rstrip() for line in new_logs if line.strip()]  # Zwracamy linie logów

    def read_all_logs(self):
        if not os.path.exists(self.log_file_path):
            return []

        with open(self.log_file_path, 'r') as log_file:
            return [line.rstrip() for line in log_file.readlines() if line.strip()]
