* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(135deg, #0b1120, #172554);
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
  background: #111c30;
  padding: 30px;
  border-radius: 20px;
  border: 1px solid #334155;
  text-align: center;
  box-shadow: 0 15px 50px #0008;
}

h1 {
  color: #38bdf8;
  font-size: 32px;
  letter-spacing: 2px;
}

p {
  color: #cbd5e1;
  line-height: 1.7;
}

textarea {
  width: 100%;
  min-height: 130px;
  padding: 15px;
  margin: 20px 0;
  border-radius: 12px;
  border: 1px solid #475569;
  background: #0b1120;
  color: white;
  font-size: 16px;
  resize: vertical;
}

select,
button {
  width: 100%;
  padding: 15px;
  margin: 10px 0;
  border-radius: 10px;
  font-size: 16px;
}

select {
  background: #1e293b;
  color: white;
  border: 1px solid #475569;
}

button {
  background: linear-gradient(90deg, #0284c7, #2563eb);
  color: white;
  border: none;
  font-weight: bold;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: wait;
}

#result {
  display: none;
  width: 100%;
  margin-top: 20px;
  border-radius: 14px;
}
