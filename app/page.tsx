
'use client';
import { useState } from 'react';

export default function Page() {
  const [boxes, setBoxes] = useState([
    { id: 1, x: 20, y: 20, text: 'Prompt 1' },
    { id: 2, x: 260, y: 20, text: 'Prompt 2' },
    { id: 3, x: 500, y: 20, text: 'Prompt 3' },
  ]);

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    alert('Copied!');
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>CopyAI (Web)</h1>
      <p>Tap a box to copy its text.</p>

      <div style={{ position: 'relative', height: '70vh', border: '1px solid #232A34' }}>
        {boxes.map(b => (
          <div
            key={b.id}
            onClick={() => copyText(b.text)}
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              width: 200,
              height: 100,
              background: '#171A22',
              border: '2px solid #232A34',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {b.text}
          </div>
        ))}
      </div>
    </div>
  );
}
