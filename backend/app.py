import subprocess
import os
import psutil
import logging
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Ustawienie logowania
logging.basicConfig(level=logging.DEBUG)

EXECUTABLE_PATH = "/app/start.sh"

def is_executable_running():
    for proc in psutil.process_iter(['pid', 'name']):
        if proc.info['name'] == os.path.basename(EXECUTABLE_PATH):
            return True
    return False

@app.route('/start-server', methods=['POST'])
def start_server():
    try:
        logging.info("Received POST request to /start-server")
        
        if is_executable_running():
            logging.info("Server is already running")
            return jsonify({"message": "Server stoi, już działa!"}), 400

        # Uruchamianie pliku wykonywalnego
        subprocess.Popen([EXECUTABLE_PATH])
        logging.info("Server has been started successfully")
        return jsonify({"message": "Server uruchomiony!"}), 200
    except Exception as e:
        # Logowanie błędu
        logging.error(f"Error starting the server: {str(e)}")
        return jsonify({"message": f"Błąd podczas uruchamiania: {str(e)}"}), 500

@app.route('/api/data', methods=['GET'])
def get_data():
    data = [{"name": "Item1", "value": "Value1"}, {"name": "Item2", "value": "Value2"}]
    return jsonify(data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
