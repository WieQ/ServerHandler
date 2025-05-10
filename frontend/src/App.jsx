import React, { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('http://localhost:5000/api/data')
      .then(response => {
        if (!response.ok) {
          throw new Error('Błąd pobierania danych');
        }
        return response.json();
      })
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Błąd:', error);
        setLoading(false);
      });
  }, []);

  const handleStartServer = () => {
    fetch('http://localhost:5000/start-server', {
      method: 'POST'
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Błąd uruchamiania serwera');
        }
        return response.json();
      })
      .then(result => {
        setMessage(`Serwer uruchomiony: ${result.status || 'OK'}`);
      })
      .catch(error => {
        setMessage(`Błąd: ${error.message}`);
      });
  };

  if (loading) return <div>Ładowanie danych...</div>;

  return (
    <div>
      <h1>Dane z backendu</h1>
      <button onClick={handleStartServer}>Uruchom serwer</button>
      <p>{message}</p>
      <ul>
        {data.map((item, index) => (
          <li key={index}>{JSON.stringify(item)}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
