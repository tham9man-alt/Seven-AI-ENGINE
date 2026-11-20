* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: #101827;
  color: #ffffff;
  font-family: Arial, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.container {
  width: 100%;
  max-width: 600px;
  text-align: center;
  background: #1c293b;
  padding: 30px;
  border-radius: 18px;
}

h1 {
  color: #42d9ff;
  font-size: 30px;
}

p {
  color: #cbd5e1;
}

textarea {
  width: 100%;
  height: 140px;
  padding: 15px;
  margin: 20px 0;
  border-radius: 10px;
  border: 1px solid #42d9ff;
  background: #101827;
  color: white;
  font-size: 16px;
  resize: vertical;
}

button {
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 10px;
  background: #42d9ff;
  color: #101827;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
}

#status {
  margin: 20px 0;
}

#result {
  display: none;
  max-width: 100%;
  border-radius: 12px;
    }
