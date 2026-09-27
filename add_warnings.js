const fs = require('fs');

let h1 = fs.readFileSync('E:/hms awp project/frontend/partials/discharges.html', 'utf8');
h1 = h1.replace(/(<select id="dischargeAdmission"[^>]*>[\s\S]*?<\/select>)/g, `$1\n            <div class="text-warning small mt-1" ng-if="admissionsWarning"><i class="fa-solid fa-triangle-exclamation"></i> Over 1000 active admissions exist. Only the first 1000 are shown. Please use search if patient is missing.</div>`);
fs.writeFileSync('E:/hms awp project/frontend/partials/discharges.html', h1);

let h2 = fs.readFileSync('E:/hms awp project/frontend/partials/reports.html', 'utf8');
h2 = h2.replace(/(<select id="reportAdmission"[^>]*>[\s\S]*?<\/select>)/g, `$1\n            <div class="text-warning small mt-1" ng-if="admissionsWarning"><i class="fa-solid fa-triangle-exclamation"></i> Over 1000 active admissions exist. Only the first 1000 are shown. Please use search if patient is missing.</div>`);
fs.writeFileSync('E:/hms awp project/frontend/partials/reports.html', h2);

console.log('Warnings added to HTML');
