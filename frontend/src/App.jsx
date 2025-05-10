import React, { useState, useEffect } from 'react';
import './App.css';

const tabs = ['Serwer', 'Backup', 'Logi', 'O aplikacji'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Serwer');
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState([]);
  const [backups, setBackups] = useState([]);
  const [autoBackup, setAutoBackup] = useState(false);
  const [isDarkMode] = useState(true);

  const [serverStatus, setServerStatus] = useState('');
  const [autoRestart, setAutoRestart] = useState(false);
  const [restartInterval, setRestartInterval] = useState(10);

  // Inicjalizacja testowych backupów
  useEffect(() => {
    const testBackups = [];
    for (let i = 1; i <= 20; i++) {
      testBackups.push({
        id: i,
        name: `Backup ${i} - ${new Date().toLocaleString()}`,
      });
    }
    setBackups(testBackups);
  }, []);

  // Logi co 3 sekundy
  useEffect(() => {
    const logInterval = setInterval(() => {
      const newLog = `Log systemowy - ${new Date().toLocaleTimeString()}`;
      setLogs((prevLogs) => [...prevLogs, newLog]);
    }, 3000);
    return () => clearInterval(logInterval);
  }, []);

  // Aktualizacja statusu serwera co 5s
  useEffect(() => {
    const fetchStatus = () => {
      fetch('http://localhost:5000/server-status')
        .then((res) => res.json())
        .then((data) => setServerStatus(data.status || 'Nieznany'));
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStartServer = () => {
    fetch('http://localhost:5000/start-server', { method: 'POST' })
      .then((res) => res.json())
      .then((result) => {
        const log = `Serwer uruchomiony: ${result.status || 'OK'}`;
        setMessage(log);
        setLogs((prev) => [...prev, log]);
      });
  };

  const handleStopServer = () => {
    fetch('http://localhost:5000/stop-server', { method: 'POST' })
      .then(() => setMessage('Serwer zatrzymany'))
      .catch((err) => setMessage(`Błąd: ${err.message}`));
  };

  const handleCreateBackup = () => {
    fetch('http://localhost:5000/create-backup', { method: 'POST' })
      .then((res) => res.json())
      .then((result) => {
        setMessage(`Backup utworzony: ${result.status || 'OK'}`);
        setBackups((prev) => [...prev, result.newBackup]);
      });
  };

  const handleAutoBackupChange = () => {
    setAutoBackup((prevState) => {
      const newAutoBackup = !prevState;
      fetch('http://localhost:5000/set-auto-backup', {
        method: 'POST',
        body: JSON.stringify({ enable: newAutoBackup }),
        headers: { 'Content-Type': 'application/json' },
      })
        .then(() => {
          setMessage(`Automatyczny backup ${newAutoBackup ? 'włączony' : 'wyłączony'}`);
        })
        .catch((err) => setMessage(`Błąd: ${err.message}`));
      return newAutoBackup;
    });
  };

  const handleClearLogs = () => setLogs([]);

  const handleLoadBackup = (backupName) => {
    setMessage(`Wczytano backup: ${backupName}`);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Serwer':
        return (
          <div className="server-tab">
            <div className="button-group">
              <button className="btn" onClick={handleStartServer}>🚀 Uruchom</button>
              <button className="btn" onClick={handleStopServer}>🛑 Zatrzymaj</button>
            </div>
            <p><strong>Status serwera:</strong> {serverStatus}</p>
            <label>
              <input
                type="checkbox"
                checked={autoRestart}
                onChange={(e) => setAutoRestart(e.target.checked)}
              />
              Automatyczny restart serwera
            </label>
            <div style={{ marginTop: '0.5rem' }}>
              <label>
                Interwał restartu (min. 10 minut):&nbsp;
                <input
                  type="number"
                  min="10"
                  value={restartInterval}
                  onChange={(e) => setRestartInterval(Math.max(10, parseInt(e.target.value) || 10))}
                  style={{ width: '60px' }}
                />
              </label>
              <button
                className="btn small-btn"
                onClick={() => {
                  fetch('http://localhost:5000/set-auto-restart', {
                    method: 'POST',
                    body: JSON.stringify({
                      enable: autoRestart,
                      interval: restartInterval,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                  })
                    .then(() => setMessage('Ustawiono automatyczny restart'))
                    .catch((err) => setMessage(`Błąd: ${err.message}`));
                }}
              >
                Zapisz ustawienia
              </button>
            </div>
            <p>{message}</p>
          </div>
        );
      case 'Backup':
        return (
          <div>
            <button className="btn" onClick={handleCreateBackup}>🗄️ Utwórz backup</button>
            <div>
              <h3>Dostępne backupy:</h3>
              <div className="backup-list">
                <ul className="data-list">
                  {backups.map((backup) => (
                    <li key={backup.id} className="backup-item">
                      <span>{backup.name}</span>
                      <button
                        className="btn small-btn"
                        onClick={() => handleLoadBackup(backup.name)}
                      >
                        Wczytaj backup
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={autoBackup}
                  onChange={handleAutoBackupChange}
                />
                Automatyczne backupy
              </label>
            </div>
            <p>{message}</p>
          </div>
        );
      case 'Logi':
        return (
          <div className="logs-panel">
            <ul className="log-list">
              {logs.map((log, index) => (
                <li key={index}>{log}</li>
              ))}
            </ul>
            <button className="btn" onClick={handleClearLogs}>🧹 Wyczyść logi</button>
          </div>
        );
      case 'O aplikacji':
        return <p>To jest prosty frontend React + backend REST API.</p>;
      default:
        return null;
    }
  };

  return (
    <div className={`container`}>
      <header>
        Minecraft Server
        <div className={`status-lamp ${serverStatus.includes('uruchomiony') ? 'green' : 'red'}`} />
      </header>
      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="main-split">
        <div className="main-content">{renderTabContent()}</div>
      </div>
    </div>
  );
}
