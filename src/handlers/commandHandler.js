// src/handlers/commandHandler.js
const fs = require('node:fs');
const path = require('node:path');

module.exports = (client) => {
    const commandsPath = path.join(__dirname, '..', 'commands'); // Caminho para src/commands/

    if (!fs.existsSync(commandsPath)) {
        console.error("❌ Pasta de comandos de prefixo ('src/commands/') não encontrada.");
        return;
    }

    const loadCommands = (dir) => {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.lstatSync(filePath);

            if (stat.isDirectory()) {
                loadCommands(filePath); // Carrega de subpastas recursivamente
            } else if (file.endsWith('.js')) {
                try {
                    const command = require(filePath);
                    // Verifica se é um comando de prefixo válido
                    if (command.name && command.execute) {
                        // Verifica para não carregar por engano um arquivo de slash command aqui
                        if (command.data && typeof command.data.toJSON === 'function') {
                            console.warn(`[AVISO] O arquivo ${file} em src/commands/ parece ser um slash command e foi ignorado pelo commandHandler de prefixo. Mova-o para src/slashCommands/ se for um slash command.`);
                        } else {
                            client.prefixCommands.set(command.name, command);
                            console.log(`✅ Comando [PREFIX] carregado: ${command.name} de ${file}`);
                        }
                    } else {
                        console.warn(`⚠️  O arquivo de comando de prefixo em ${filePath} está faltando a propriedade "name" ou "execute".`);
                    }
                } catch (error) {
                    console.error(`❌ Erro ao carregar comando de prefixo de ${filePath}:`, error);
                }
            }
        }
    };

    loadCommands(commandsPath);
};