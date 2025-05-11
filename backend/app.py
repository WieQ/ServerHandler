import subprocess
import psutil
import logging
import time
import threading
import json
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from config_reader import ConfigReader
from log_reader import LogReader

app = Flask(__name__)
CORS(app)

# Logging
logging.basicConfig(level=logging.DEBUG)

EXECUTABLE_PATH = "/app/start.sh"
server_process = None  # globalna referencja do uruchomionego procesu

config_file = ".config"
config = ConfigReader(config_file)

# Ścieżka do pliku logów
log_file_path = 'latest.log'
log_reader = LogReader(log_file_path)

# Zmienne konfiguracyjne
server_restart_enabled = config.get("server_restart", "False").lower() == "true"
restart_seconds = config.get_time_in_seconds("server_restart_timer", default_seconds=600)

# Kolejka do logów
log_queue = []

def is_process_running(proc):
    if proc is None:
        logging.info("Proces nie jest uruchomiony.")
        return False
    elif proc.poll() is None:
        logging.info("Proces jest nadal uruchomiony.")
        return True
    else:
        logging.info("Proces zakończył działanie.")
        return False


def find_running_process():
    """Sprawdza, czy proces z tym samym plikiem działa."""
    for proc in psutil.process_iter(['pid', 'cmdline']):
        try:
            if proc.info['cmdline'] and EXECUTABLE_PATH in proc.info['cmdline']:
                return proc
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return None

def start_server_process():
    global server_process
    if is_process_running(server_process) or find_running_process():
        logging.info("Serwer już działa")
        return False
    try:
        server_process = subprocess.Popen([EXECUTABLE_PATH], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        logging.info("Serwer został uruchomiony")
        return True
    except Exception as e:
        raise e

def stop_server_process():
    global server_process

    if is_process_running(server_process):
        server_process.terminate()
        server_process.wait()
        server_process = None
        return True

    proc = find_running_process()
    if proc:
        proc.terminate()
        return True
    
    return False

@app.route('/start-server', methods=['POST'])
def start_server():
    global server_process

    logging.info("Żądanie uruchomienia serwera")
    try:
        if start_server_process():
            return jsonify({"message": "Serwer uruchomiony"}), 200
        else:
            return jsonify({"message": "Serwer już działa"}), 400

    except Exception as e:
        logging.error(f"Błąd uruchamiania: {str(e)}")
        return jsonify({"message": f"Błąd: {str(e)}"}), 500


@app.route('/stop-server', methods=['POST'])
def stop_server():
    global server_process

    logging.info("Żądanie zatrzymania serwera")

    if stop_server_process():
        logging.info("Serwer zatrzymany")
        return jsonify({"message": "Serwer zatrzymany"}), 200

    logging.warning("Nie znaleziono działającego serwera")
    return jsonify({"message": "Serwer nie działa"}), 400


@app.route('/server-status', methods=['GET'])
def server_status():
    if is_process_running(server_process) or find_running_process():
        return jsonify({"status": "uruchomiony"})
    else:
        return jsonify({"status": "zatrzymany"})


# Logi z procesu startowanego przez start.sh
@app.route('/get-logs', methods=['GET'])
def get_logs():
    try:
        new_logs = log_reader.get_logs()
        return jsonify({"logs": new_logs}), 200
    except Exception as e:
        return jsonify({"message": f"Błąd przy odczycie logów: {str(e)}"}), 500


def restart_server_periodically():
    while server_restart_enabled:
        if is_process_running(server_process) or find_running_process():
            logging.info("Restartowanie serwera...")
            stop_server_process()
            start_server_process()
            logging.info("Serwer uruchomiony ponownie.")
        else:
            logging.info("Serwer nie działa. Nie wykonuję restartu.")
        
        time.sleep(restart_seconds)  # Czekaj na następny restart tylko, gdy serwer został uruchomiony



@app.route('/set-restart-server', methods=['POST'])
def set_restart_server():
    global server_restart_enabled, restart_seconds

    try:
        # Odbieranie danych z frontend
        data = request.get_json()

        if "enable" not in data or "interval" not in data:
            return jsonify({"message": "Brak wymaganych danych"}), 400
        
        # Ustawienie zmiennych
        server_restart_enabled = data["enable"]
        restart_seconds = data["interval"] * 60  # Konwersja minut na sekundy

        # Zapisanie do pliku konfiguracyjnego
        config_data = {
            "server_restart": str(server_restart_enabled),
            "server_restart_timer": restart_seconds // 60  # zapisanie w minutach
        }

        if server_restart_enabled and not is_restart_thread_alive():
            # Uruchamiamy restart serwera w tle
            restart_thread = threading.Thread(target=restart_server_periodically, daemon=True)
            restart_thread.start()

        with open(config_file, 'w') as f:
            json.dump(config_data, f, indent=4)

        # Aktualizacja zmiennych
        logging.info(f"Ustawiono auto-restart na {server_restart_enabled}, co {restart_seconds // 60} minut.")

        return jsonify({"message": "Ustawienia auto-restartu zapisane"}), 200

    except Exception as e:
        logging.error(f"Błąd podczas ustawiania auto-restartu: {str(e)}")
        return jsonify({"message": f"Błąd: {str(e)}"}), 500

if __name__ == '__main__':
    logging.info(f"Ustawiono auto-restart na {server_restart_enabled}, co {restart_seconds // 60} minut.")
    if server_restart_enabled:
        # Uruchamiamy restart serwera w tle
        restart_thread = threading.Thread(target=restart_server_periodically, daemon=True)
        restart_thread.start()

    app.run(host='0.0.0.0', port=5000)
