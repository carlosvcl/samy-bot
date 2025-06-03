const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config(); // Para carregar seu .env

const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // ID do seu servidor de teste
const token = process.env.DISCORD_TOKEN;

if (!clientId || !guildId || !token) {
    console.error('❌ Por favor, defina DISCORD_CLIENT_ID, DISCORD_GUILD_ID, e DISCORD_TOKEN no seu arquivo .env');
    process.exit(1);
}

const commands = [];
// A pasta de slash commands agora está dentro de 'src'
const slashCommandsPath = path.join(__dirname, 'src', 'slashCommands');

if (!fs.existsSync(slashCommandsPath)) {
    console.error(`❌ Pasta de slash commands não encontrada em: ${slashCommandsPath}`);
    process.exit(1);
}

const commandFolders = fs.readdirSync(slashCommandsPath);

for (const folder of commandFolders) {
    const commandsPathInsideFolder = path.join(slashCommandsPath, folder);
    const commandFiles = fs.readdirSync(commandsPathInsideFolder).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPathInsideFolder, file);
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`✅ Comando lido para deploy: /${command.data.name} de ${file}`);
            } else {
                console.log(`[AVISO] O comando em ${filePath} está faltando a propriedade "data" ou "execute".`);
            }
        } catch (error) {
            console.error(`❌ Erro ao ler comando ${file} para deploy:`, error);
        }
    }
}

if (commands.length === 0) {
    console.warn('⚠️ Nenhum comando encontrado para deploy.');
    process.exit(0);
}

// Constrói e prepara uma instância do módulo REST
const rest = new REST({ version: '10' }).setToken(token);

// E faz o deploy dos seus comandos!
(async () => {
    try {
        console.log(`Iniciando a atualização de ${commands.length} comandos de aplicação (/) para o servidor ${guildId}.`);

        // O método put é usado para atualizar completamente todos os comandos na guild com o conjunto atual
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId), // Registra comandos especificamente para este servidor
            { body: commands },
        );

        console.log(`✅ Sucesso ao recarregar ${data.length} comandos de aplicação (/) para o servidor.`);
    } catch (error) {
        // E claro, certifique-se de pegar e logar quaisquer erros!
        console.error('❌ Erro ao fazer deploy dos comandos:', error);
    }
})();