import React from "react";
import ReactDOM from "react-dom/client";

const App = () => {
  return (
    <div
      style={{
        padding: "40px",
        textAlign: "justify", // Globálne pravidlo ATK
        fontFamily: "sans-serif",
        color: "#1a365d",
      }}
    >
      <h1>ARUTSOK (ATK) - HOLDING KOSTURA</h1>
      <div
        style={{
          border: "2px solid blue",
          padding: "20px",
          backgroundColor: "#f0f4f8",
        }}
      >
        <p>
          <strong>STAV:</strong> SYSTÉM ONLINE
        </p>
        <p>
          <strong>ID ENTITY:</strong> 421 000 000 000 000
        </p>
        <hr />
        <p>
          Pripravené na Fázu 1: Import používateľov a tvorbu klientskych kódov.
        </p>
      </div>
    </div>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
