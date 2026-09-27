const fs = require('fs');
const path = require('path');
const pDir = path.join(__dirname, 'frontend/partials');
fs.readdirSync(pDir).forEach(file => {
    if (!file.endsWith('.html')) return;
    let c = fs.readFileSync(path.join(pDir, file), 'utf8');
    c = c.replace(/class="modal-backdrop-custom"\s+ng-if="showModal"/g, 'class="modal-backdrop-custom" ng-if="showModal" body-scroll-lock');
    fs.writeFileSync(path.join(pDir, file), c, 'utf8');
});
console.log('body scroll lock added');
