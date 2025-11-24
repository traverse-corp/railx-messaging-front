import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx' // 👈 여기서 App을 불러와야 합니다.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)