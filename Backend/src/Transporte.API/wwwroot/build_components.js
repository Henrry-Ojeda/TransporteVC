const fs = require('fs');
const path = require('path');

const startTime = Date.now();
const frontendDir = path.resolve(__dirname);
const rootDir = path.resolve(frontendDir, '..');
const componentsDir = path.join(frontendDir, 'src', 'components');
const templatePath = path.join(frontendDir, 'src', 'index.template.html');
const outputHtmlPath = path.join(frontendDir, 'index.html');

console.log('📦 Compilando Frontend desde arquitectura de componentes (React-like)...');

if (!fs.existsSync(templatePath)) {
    console.error('❌ Error: No se encontró index.template.html en:', templatePath);
    process.exit(1);
}

let template = fs.readFileSync(templatePath, 'utf8');

// Regex para encontrar <!-- @component "ruta/nombre" -->
const componentRegex = /<!--\s*@component\s*["']([^"']+)["']\s*-->/g;

let matchCount = 0;
const compiledHtml = template.replace(componentRegex, (match, componentPath) => {
    let filePath = path.join(componentsDir, componentPath);
    if (!filePath.endsWith('.html')) {
        filePath += '.html';
    }

    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Advertencia: No se encontró el componente HTML: ${filePath}`);
        return `<!-- [Componente no encontrado: ${componentPath}] -->`;
    }

    matchCount++;
    const content = fs.readFileSync(filePath, 'utf8');
    return `\n<!-- INICIO COMPONENTE: ${componentPath} -->\n${content}\n<!-- FIN COMPONENTE: ${componentPath} -->\n`;
});

// Lista ordenada de scripts de componentes modulares
const componentScripts = [
    'src/utils/formatters.js?v=1.2.0',
    'src/services/api.js?v=1.2.0',
    'src/modules/liquidaciones/liquidaciones.js?v=1.2.0',
    'src/modules/tiposLeche/tiposLeche.js?v=1.2.0',
    'src/components/core/AppCore.js?v=1.2.0',
    'src/components/dashboard/Dashboard.js?v=1.2.0',
    'src/components/rutas/Rutas.js?v=1.2.0',
    'src/components/semanas/Semanas.js?v=1.2.0',
    'src/components/adelantos/AbonosAdelantos.js?v=1.2.0',
    'src/components/adelantos/AdelantosCiclos.js?v=1.2.0',
    'src/components/catalogos/Catalogos.js?v=1.2.0',
    'src/components/reportes/Reportes.js?v=1.2.0',
    'src/components/chatbot/Chatbot.js?v=1.2.0',
    'src/components/seguridad/UsuariosCamiones.js?v=1.2.0',
    'src/components/controlRutas/ViajesTickets.js?v=1.2.0',
    'src/components/controlRutas/ControlRutas.js?v=1.2.0',
    'src/components/balanceVolumetrico/BalanceVolumetrico.js?v=1.2.0',
    'src/components/rentabilidad/Rentabilidad.js?v=1.2.0',
    'src/components/pagosPersonal/PagosPersonal.js?v=1.2.0',
    'src/components/seguridad/PermisosRbac.js?v=1.2.0',
    'src/components/bufala/Bufala.js?v=1.2.0',
    'src/components/configuracion/ConfiguracionSistema.js?v=1.2.0',
    'src/components/core/AppInit.js?v=1.2.0'
];

const scriptTags = componentScripts.map(s => `    <script src="${s}"></script>`).join('\n');

// Reemplazar la sección de scripts de la plantilla
let finalHtml = compiledHtml;
if (finalHtml.includes('<!-- CORE SPA JAVASCRIPT -->')) {
    finalHtml = finalHtml.replace(
        /<!-- SCRIPTS MODULARES[\s\S]*?<!-- CORE SPA JAVASCRIPT -->[\s\S]*?<script src="js\/app\.js[^"]*"><\/script>/,
        `<!-- SCRIPTS MODULARES (COMPONENTES REACT-LIKE) -->\n${scriptTags}`
    );
}

fs.writeFileSync(outputHtmlPath, finalHtml, 'utf8');
console.log(`✅ Ensamblados ${matchCount} componentes en index.html exitosamente.`);

// Sincronizar automáticamente hacia wwwroot de desarrollo
const targets = [
    path.join(rootDir, 'Backend', 'src', 'Transporte.API', 'wwwroot'),
    path.join(rootDir, 'Backend', 'src', 'Transporte.API', 'bin', 'Debug', 'net8.0', 'wwwroot')
];

function copyFolderRecursiveSync(source, target) {
    if (!fs.existsSync(source)) return;
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }

    const files = fs.readdirSync(source);
    files.forEach(file => {
        const curSource = path.join(source, file);
        const curTarget = path.join(target, file);

        if (fs.lstatSync(curSource).isDirectory()) {
            copyFolderRecursiveSync(curSource, curTarget);
        } else {
            fs.copyFileSync(curSource, curTarget);
        }
    });
}

targets.forEach(t => {
    if (fs.existsSync(path.dirname(t))) {
        copyFolderRecursiveSync(frontendDir, t);
        console.log(`🚀 Sincronizado a: ${t}`);
    }
});

const elapsed = Date.now() - startTime;
console.log(`⚡ Compilación y sincronización completada en ${elapsed} ms.`);
