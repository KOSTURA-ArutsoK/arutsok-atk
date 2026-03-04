import React from 'react';

export default function App() {
  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: 'sans-serif', 
      textAlign: 'justify', // Tvoje globálne pravidlo pre ATK
      maxWidth: '800px',
      margin: '0 auto',
      lineHeight: '1.6'
    }}>
      <h1 style={{ textAlign: 'center', color: '#1a365d' }}>
        ARUTSOK (ATK) - HOLDING KOSTURA
      </h1>

      <div style={{ 
        border: '2px solid #1a365d', 
        padding: '20px', 
        borderRadius: '8px',
        backgroundColor: '#f8fafc'
      }}>
        <p><strong>STAV SYSTÉMU:</strong> PRIPRAVENÝ</p>
        <p><strong>BEZPEČNOSŤ:</strong> 10-úrovňová pyramída aktívna. Ručná závora pre moduly (A), (B) a (C) je nastavená na tvoj manuálny súhlas.</p>
        <p><strong>ZMLUVY:</strong> Pripravené na import 13 000 dokumentov cez OCR skenovanie do chráneného prostredia Azure/AWS.</p>
        <hr />
        <p>
          Tento systém je nakonfigurovaný s globálnym pravidlom zarovnávania do bloku (Justified layout) pre všetky navigačné prvky a karty. 
          Každý pokus o prístup k citlivému poľu zanechá auditnú stopu v on-premise prostredí.
        </p>
      </div>

      <p style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
        Identifikátor entity: 421 000 000 000 000
      </p>
    </div>
  );
}