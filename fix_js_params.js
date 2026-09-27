const fs = require('fs');
const path = require('path');
const jsDir = path.join(__dirname, 'frontend/js/controllers');

fs.readdirSync(jsDir).forEach(file => {
    if (!file.endsWith('.js')) return;
    let content = fs.readFileSync(path.join(jsDir, file), 'utf8');

    // Replace parameter-less submit functions with parameter-accepting functions
    content = content.replace(/\$scope\.([A-Za-z0-9_]+)\s*=\s*function\s*\(\)\s*\{([\s\S]*?)(if\s*\(!form)/g, (match, fnName, between, ifStmt) => {
        if (fnName.startsWith('submit') || fnName.startsWith('update')) {
            return `$scope.${fnName} = function (form) {${between}${ifStmt}`;
        }
        return match;
    });

    // Replace remaining submit = function ()
    content = content.replace(/\$scope\.submitDoctor\s*=\s*function\s*\(\)\s*\{/g, '$scope.submitDoctor = function (form) {');
    content = content.replace(/\$scope\.submitWard\s*=\s*function\s*\(\)\s*\{/g, '$scope.submitWard = function (form) {');
    content = content.replace(/\$scope\.submitBed\s*=\s*function\s*\(\)\s*\{/g, '$scope.submitBed = function (form) {');
    content = content.replace(/\$scope\.submitVisit\s*=\s*function\s*\(\)\s*\{/g, '$scope.submitVisit = function (form) {');
    content = content.replace(/\$scope\.submitAppointment\s*=\s*function\s*\(\)\s*\{/g, '$scope.submitAppointment = function (form) {');
    content = content.replace(/\$scope\.submitReport\s*=\s*function\s*\(\)\s*\{/g, '$scope.submitReport = function (form) {');
    content = content.replace(/\$scope\.updateProfile\s*=\s*function\s*\(\)\s*\{/g, '$scope.updateProfile = function (form) {');
    content = content.replace(/\$scope\.updatePassword\s*=\s*function\s*\(\)\s*\{/g, '$scope.updatePassword = function (form) {');
    content = content.replace(/\$scope\.submitAdmission\s*=\s*function\s*\(\)\s*\{/g, '$scope.submitAdmission = function (form) {');
    content = content.replace(/\$scope\.submitPatient\s*=\s*function\s*\(\)\s*\{/g, '$scope.submitPatient = function (form) {');

    fs.writeFileSync(path.join(jsDir, file), content, 'utf8');
});

console.log("Fixes applied successfully to JS.");
