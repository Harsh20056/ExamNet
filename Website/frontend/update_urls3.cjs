const fs = require('fs');
const files = [
  'src/pages/AdminDashboard.tsx',
  'src/pages/StudentDashboard.tsx',
  'src/pages/InvigilatorDashboard.tsx',
  'src/components/ProctoringSetup.tsx',
  'src/components/ExamQuestionOCR.tsx'
];
files.forEach(f => {
  const p = 'd:/fun zuup clone/zup_examination/Project/Website/frontend/' + f;
  if(fs.existsSync(p)) {
      let content = fs.readFileSync(p, 'utf8');
      content = content.replace(/https:\/\/765e246281d1ae\.lhr\.life/g, 'https://zup-exam-backend-42.loca.lt');
      fs.writeFileSync(p, content);
      console.log('Updated ' + f);
  }
});
