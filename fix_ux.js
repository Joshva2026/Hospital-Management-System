const fs = require('fs');
const path = require('path');

const partialsDir = path.join(__dirname, 'frontend/partials');
const jsDir = path.join(__dirname, 'frontend/js/controllers');

// Fix Partials (HTML)
fs.readdirSync(partialsDir).forEach(file => {
    if (!file.endsWith('.html')) return;
    let content = fs.readFileSync(path.join(partialsDir, file), 'utf8');

    // Make sure we pass the form directly
    content = content.replace(/ng-submit="([A-Za-z0-9_]+)\(\)"\s+novalidate/g, (match, fnName) => {
        // We need to know the form name. Usually it's in the same tag.
        return match;
    });

    content = content.replace(/<form\s+name="([^"]+)"([\s\S]*?)ng-submit="([A-Za-z0-9_]+)\(\)"(.*?)novalidate/g, '<form name="$1"$2ng-submit="$3($1)"$4novalidate');
    content = content.replace(/<form\s+name="([^"]+)"([\s\S]*?)novalidate(.*?)ng-submit="([A-Za-z0-9_]+)\(\)"/g, '<form name="$1"$2novalidate$3ng-submit="$4($1)"');

    fs.writeFileSync(path.join(partialsDir, file), content, 'utf8');
});

// Fix Controllers (JS)
fs.readdirSync(jsDir).forEach(file => {
    if (!file.endsWith('.js')) return;
    let content = fs.readFileSync(path.join(jsDir, file), 'utf8');

    // Replace parameter-less submit functions with parameter-accepting functions
    content = content.replace(/\$scope\.([A-Za-z0-9_]+)\s*=\s*function\s*\(\)\s*\{([\s\S]*?)(if\s*\([^\{]+?\$valid[^\{]+?\{)/g, (match, fnName, between, ifStmt) => {
        // e.g. $scope.submitDoctor = function () { ... if (...) { ...
        // Only modify if it looks like a submit function
        if (fnName.startsWith('submit') || fnName.startsWith('update')) {
            return `$scope.${fnName} = function(form) {${between}${ifStmt}`;
        }
        return match;
    });

    // Replace $scope.formName.$valid with form.$valid
    content = content.replace(/if\s*\(\$scope\.[A-Za-z0-9_]+\.\$valid/g, 'if (form && form.$valid');
    content = content.replace(/if\s*\(!\$scope\.[A-Za-z0-9_]+\.\$valid/g, 'if (!form || !form.$valid');
    
    // Replace "if (form && !form.$valid)" which was in some files, standardize it
    content = content.replace(/if\s*\(\!form\s*\|\|\s*\!form\.\$valid([^\{]+)\{/g, 'if (!form || !form.$valid$1{');
    content = content.replace(/if\s*\(\s*form\s*&&\s*\!form\.\$valid\s*\)\s*\{/g, 'if (!form || !form.$valid) {');

    // Remove fake $scope.formName = {} objects
    content = content.replace(/\$scope\.[a-zA-Z0-9]+Form(El)?\s*=\s*\{\s*\};\n/g, '');

    // Number conversions
    if (file === 'doctors.controller.js') {
        content = content.replace(/consultationFee: d\.consultation_fee,/g, "consultationFee: d.consultation_fee == null ? '' : Number(d.consultation_fee),");
        content = content.replace(/experienceYears: d\.experience_years,/g, "experienceYears: d.experience_years == null ? '' : Number(d.experience_years),");
        
        // Before POST/PUT:
        if (!content.includes('Number($scope.form.consultationFee)')) {
            content = content.replace(/var payload = angular\.copy\(\$scope\.form\);/g, `var payload = angular.copy($scope.form);\n        if (payload.consultationFee !== '' && payload.consultationFee != null) payload.consultationFee = Number(payload.consultationFee);\n        if (payload.experienceYears !== '' && payload.experienceYears != null) payload.experienceYears = Number(payload.experienceYears);`);
        }
    }
    
    if (file === 'wardsBeds.controller.js') {
        content = content.replace(/totalBeds: w\.total_beds,/g, "totalBeds: w.total_beds == null ? '' : Number(w.total_beds),");
        content = content.replace(/floor: w\.floor,/g, "floor: w.floor == null ? '' : Number(w.floor),");
        if (!content.includes('Number($scope.wardForm.totalBeds)')) {
            content = content.replace(/var payload = angular\.copy\(\$scope\.wardForm\);/g, `var payload = angular.copy($scope.wardForm);\n        if (payload.totalBeds !== '' && payload.totalBeds != null) payload.totalBeds = Number(payload.totalBeds);\n        if (payload.floor !== '' && payload.floor != null) payload.floor = Number(payload.floor);`);
        }
    }
    
    if (file === 'reports.controller.js') {
        content = content.replace(/temperature: d\.temperature,/g, "temperature: d.temperature == null ? '' : Number(d.temperature),");
        content = content.replace(/pulseRate: d\.pulse_rate,/g, "pulseRate: d.pulse_rate == null ? '' : Number(d.pulse_rate),");
        content = content.replace(/spo2: d\.spo2,/g, "spo2: d.spo2 == null ? '' : Number(d.spo2),");
        if (!content.includes('Number($scope.form.temperature)')) {
             content = content.replace(/var payload = angular\.copy\(\$scope\.form\);/g, `var payload = angular.copy($scope.form);\n        if (payload.temperature !== '' && payload.temperature != null) payload.temperature = Number(payload.temperature);\n        if (payload.pulseRate !== '' && payload.pulseRate != null) payload.pulseRate = Number(payload.pulseRate);\n        if (payload.spo2 !== '' && payload.spo2 != null) payload.spo2 = Number(payload.spo2);`);
        }
    }

    fs.writeFileSync(path.join(jsDir, file), content, 'utf8');
});

// Fix CSS
const cssPath = path.join(__dirname, 'frontend/css/style.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');
cssContent = cssContent.replace(/textarea\.form-control\s*\{\s*resize:\s*vertical;\s*\}/, `textarea.form-control { resize: none; }\n.card, .modal-box, .modal-backdrop-custom { resize: none; }`);

if (!cssContent.includes('.modal-box > form')) {
    cssContent = cssContent.replace(/\.modal-box\s*\{[\s\S]*?\}/, `.modal-box {
    width: 100%;
    max-width: 900px;
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
    border-radius: 20px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    position: relative;
    margin: auto;
}`);
    cssContent += `
.modal-box > form {
    min-height: 0;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
}
`;
}
// Fix modal-backdrop-custom
cssContent = cssContent.replace(/\.modal-backdrop-custom\s*\{[\s\S]*?\}/, `.modal-backdrop-custom {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(8px);
}`);

cssContent = cssContent.replace(/\.modal-body-custom\s*\{[\s\S]*?\}/, `.modal-body-custom {
    min-height: 0;
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    padding: 32px;
}`);

cssContent = cssContent.replace(/\.modal-header-custom\s*\{[\s\S]*?\}/, `.modal-header-custom {
    flex-shrink: 0;
    padding: 24px 32px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #F5F5F6;
}`);

cssContent = cssContent.replace(/\.modal-footer-custom\s*\{[\s\S]*?\}/, `.modal-footer-custom {
    flex-shrink: 0;
    padding: 24px 32px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #F5F5F6;
}`);

fs.writeFileSync(cssPath, cssContent, 'utf8');

console.log("Fixes applied successfully.");
