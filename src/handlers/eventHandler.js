// src/handlers/eventHandler.js
const fs = require('node:fs');
const path = require('node:path');

module.exports = (client) => {
    const eventsPath = path.join(__dirname, '..', 'events'); // Caminho para src/events/

    if (!fs.existsSync(eventsPath)) {
        console.error("❌ Pasta de eventos ('src/events/') não encontrada.");
        return;
    }

    const loadEventsRecursive = (directory) => {
        const filesInDirectory = fs.readdirSync(directory);

        for (const file of filesInDirectory) {
            const filePath = path.join(directory, file);
            const stat = fs.statSync(filePath); // Usar fs.statSync para verificar se é diretório

            if (stat.isDirectory()) {
                loadEventsRecursive(filePath); // Chama a função recursivamente para subpastas
            } else if (file.endsWith('.js')) {
                try {
                    const event = require(filePath);
                    if (event.name && typeof event.execute === 'function') { // Verifica se tem nome e função execute
                        if (event.once) {
                            client.once(event.name, (...args) => event.execute(...args, client));
                        } else {
                            client.on(event.name, (...args) => event.execute(...args, client));
                        }
                        // Mostra um caminho relativo mais limpo para o log
                        const relativeFilePath = path.relative(path.join(__dirname, '..'), filePath);
                        console.log(`🔔 Evento carregado: ${event.name} de ${relativeFilePath}`);
                    } else {
                        console.warn(`[AVISO] O arquivo de evento em ${filePath} está faltando a propriedade "name" ou "execute".`);
                    }
                } catch (error) {
                    console.error(`❌ Erro ao carregar evento de ${filePath}:`, error);
                }
            }
        }
    };

    loadEventsRecursive(eventsPath); // Inicia o carregamento recursivo
};