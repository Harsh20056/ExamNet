const fs = require('fs');
const files = [
  'src/components/ProctoringSetup.tsx',
  'src/components/SeatMap3D.tsx',
  'src/pages/AdminDashboard.tsx',
  'src/pages/LandingPage.tsx',
  'src/pages/Login.tsx',
  'src/pages/InvigilatorDashboard.tsx'
];
files.forEach(f => {
  let text = fs.readFileSync(f, 'utf8');
  if (f === 'src/pages/Login.tsx') {
    text = text.replace('UserPlus, ', '');
  } else if (f === 'src/pages/InvigilatorDashboard.tsx') {
    text = text.replace('XCircle, ', '');
  } else {
    text = text.replace(/import React, \{/g, 'import {');
    text = text.replace(/import React from 'react';/g, '');
  }
  fs.writeFileSync(f, text);
});
