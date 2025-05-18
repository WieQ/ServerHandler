import psutil
import logging
import asyncio
import json
import os
from quart import Quart, jsonify, request
from quart_cors import cors
from config_reader import ConfigReader
from log_reader import LogReader
from backup_manager import BackupManager
import platform

app = Quart(__name__)
app = cors(app)

# Logging
logging.basicConfig(level=logging.DEBUG)

IS_WINDOWS = platform.system() == "Windows"
EXECUTABLE_PATH = "start.bat" if IS_WINDOWS else "./start.sh"


EXECUTABLE_PATH = "/app/start.sh"
server_process = None  # globalna referencja do uruchomionego procesu
stdout_buffer = []
restart_task = None

config_file = ".config"
config = ConfigReader(config_file)

# Ścieżka do pliku logów
log_file_path = 'latest.log'
log_reader = LogReader(log_file_path)

backup_manager = BackupManager(source_dir='DregoraRL', backup_root='Backup')

# Zmienne konfiguracyjne
server_restart_enabled = config.get("server_restart", "False").lower() == "true"
restart_seconds = config.get_time_in_seconds("server_restart_timer", default_seconds=600)

# Kolejka do logów
log_queue = []

async def is_process_running(proc):
    if proc is None:
        logging.info("Proces nie jest uruchomiony.")
        return False

    try:
        # Jeśli to asyncio.subprocess.Process
        if isinstance(proc, asyncio.subprocess.Process):
            return proc.returncode is None  # działa zamiast .poll()
        
        # Jeśli to psutil.Process
        if isinstance(proc, psutil.Process):
            return proc.is_running() and proc.status() != psutil.STATUS_ZOMBIE

    except Exception as e:
        logging.warning(f"Błąd przy sprawdzaniu procesu: {e}")
        return False

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

async def start_server_process():
    global server_process
    if await is_process_running(server_process) or find_running_process():
        logging.info("Serwer już działa")
        return False
    logging.info("Próba uruchomienia")
    try:
        server_process = await asyncio.create_subprocess_exec(
            EXECUTABLE_PATH,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        logging.info("Serwer został uruchomiony")
        return True
    except Exception as e:
        raise e

async def stop_server_process():
    global server_process

    if await is_process_running(server_process):
        server_process.terminate()
        await server_process.wait()
        server_process = None
        return True

    proc = find_running_process()
    if proc:
        proc.terminate()
        return True
    
    return False

async def restart_server_periodically():
    global server_restart_enabled
    while server_restart_enabled:
        if await is_process_running(server_process) or find_running_process():
            logging.info("Restartowanie serwera...")
            await stop_server_process()
            await start_server_process()
            logging.info("Serwer uruchomiony ponownie.")
        else:
            logging.info("Serwer nie działa. Nie wykonuję restartu.")
        await asyncio.sleep(restart_seconds)

@app.route('/start-server', methods=['POST'])
async def start_server():
    global server_process

    logging.info("Żądanie uruchomienia serwera")
    try:
        if await start_server_process():
            return jsonify({"message": "Serwer uruchomiony"}), 200
        else:
            return jsonify({"message": "Serwer już działa"}), 400

    except Exception as e:
        logging.error(f"Błąd uruchamiania: {str(e)}")
        return jsonify({"message": f"Błąd: {str(e)}"}), 500


@app.route('/stop-server', methods=['POST'])
async def stop_server():
    global server_process

    logging.info("Żądanie zatrzymania serwera")

    if await stop_server_process():
        logging.info("Serwer zatrzymany")
        return jsonify({"message": "Serwer zatrzymany"}), 200

    logging.warning("Nie znaleziono działającego serwera")
    return jsonify({"message": "Serwer nie działa"}), 400


@app.route('/server-status', methods=['GET'])
async def server_status():
    if await is_process_running(server_process) or find_running_process():
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

@app.route('/get-all-logs', methods=['GET'])
async def get_all_logs():
    logs = log_reader.read_all_logs()
    return jsonify({"logs": logs})


def is_restart_task_running():
    global restart_task
    return restart_task is not None and not restart_task.done()

    
@app.route('/send-command', methods=['POST'])
async def send_command():
    global server_process
    if not await is_process_running(server_process) or not find_running_process():
        logging.info("Serwer nie działa")
        return jsonify({"message": "Server nie działa"}), 500
    
    data = await request.get_json()
    command = data.get("command")
    if not command:
        return jsonify({"message": "Brak komendy"}), 400
    
    server_process.stdin.write((command + "\n").encode())
    await server_process.stdin.drain()
    
    return jsonify({"message": f"Komenda '{command}' została wysłana"}), 200


@app.route('/read-terminal', methods=['POST'])
async def read_terminal():
    global server_process, stdout_buffer
    if not is_process_running(server_process) or not find_running_process() or server_process.stdout.at_eof():
        return jsonify({"logs": []})
    
    try:
        while True:
            line = await asyncio.wait_for(server_process.stdout.readline(), timeout=0.1)
            if line:
                stdout_buffer.append(line.decode())
            else:
                break
    except asyncio.TimeoutError:
        pass

    if stdout_buffer:
        logs = stdout_buffer.copy()
        stdout_buffer.clear()
        return jsonify({"logs": logs})
    else :
        return jsonify({"logs": []})


@app.route('/set-restart-server', methods=['POST'])
async def set_restart_server():
    global server_restart_enabled, restart_seconds

    try:
        data = await request.get_json()

        if "enable" not in data or "interval" not in data:
            return jsonify({"message": "Brak wymaganych danych"}), 400
        
        server_restart_enabled = data["enable"]
        restart_seconds = data["interval"] * 60

        config_data = {
            "server_restart": str(server_restart_enabled),
            "server_restart_timer": restart_seconds // 60
        }

        if server_restart_enabled and not is_restart_task_running():
            asyncio.create_task(restart_server_periodically())

        with open(config_file, 'w') as f:
            json.dump(config_data, f, indent=4)

        logging.info(f"Ustawiono auto-restart na {server_restart_enabled}, co {restart_seconds // 60} minut.")
        return jsonify({"message": "Ustawienia auto-restartu zapisane"}), 200

    except Exception as e:
        logging.error(f"Błąd podczas ustawiania auto-restartu: {str(e)}")
        return jsonify({"message": f"Błąd: {str(e)}"}), 500

@app.route('/create-backup', methods=['POST'])
async def create_backup():
    loop = asyncio.get_event_loop()
    try:
        # Wykonanie operacji kopiowania w osobnym wątku (bo shutil.copytree nie jest async)
        backup_path = await loop.run_in_executor(None, backup_manager.create_backup)
        return jsonify({
            "status": "Backup utworzony",
            "newBackup": {
                "id": hash(backup_path),
                "name": os.path.basename(backup_path)
            }
        })
    except Exception as e:
        return jsonify({"status": "Błąd", "error": str(e)}), 500

@app.route('/list-backups', methods=['GET'])
async def list_backups():
    loop = asyncio.get_event_loop()
    backups = await loop.run_in_executor(None, backup_manager.list_backups)
    result = [
        {**b, "id": hash(b["name"])} for b in backups
    ]
    return jsonify({"backups": result})

@app.route('/delete-backup', methods=['DELETE'])
async def delete_backup():
    backup_name = request.args.get('id')
    if not backup_name:
        return jsonify({"error": "Brak parametru `id`"}), 400

    loop = asyncio.get_event_loop()
    success = await loop.run_in_executor(None, backup_manager.delete_backup, backup_name)

    if success:
        return jsonify({"status": "deleted"})
    else:
        return jsonify({"error": "Nie znaleziono backupu"}), 404


    
@app.before_serving
async def setup_restart_loop():
    global restart_task
    if server_restart_enabled and not is_restart_task_running():
        asyncio.create_task(restart_server_periodically())


if __name__ == '__main__':
    logging.info(f"Ustawiono auto-restart na {server_restart_enabled}, co {restart_seconds // 60} minut.")
    if server_restart_enabled:
        asyncio.create_task(restart_server_periodically())

    app.run(host='0.0.0.0', port=5000)
