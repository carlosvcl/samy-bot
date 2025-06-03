// dev/devctl.js
const { EmbedBuilder } = require('discord.js');
const childProcess = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

module.exports = {
    name: 'devctl',
    aliases: ['sys', 'botctl'],
    description: 'Comandos de controle e desenvolvimento do bot (Apenas Dono).',
    category: 'dev', // Certifique-se que seu commandHandler usa essa categoria para carregar da pasta 'dev'
    devOnly: true, // Seu handler pode usar isso para restringir automaticamente
    // filePath: __filename, // O command handler pode adicionar isso automaticamente ao carregar

    async execute({ client, message, args, prefix }) { // Adicionado 'prefix' para usar no embed de ajuda
        const ownerIds = (process.env.OWNER_IDS || "").split(',').map(id => id.trim()).filter(id => id);
        if (ownerIds.length === 0) {
            console.warn("AVISO: OWNER_IDS não está definido no seu arquivo .env ou está vazio. O comando devctl não funcionará corretamente.");
            return message.reply({ content: "Configuração de proprietário ausente. Este comando está desabilitado." });
        }
        if (!ownerIds.includes(message.author.id)) {
            // Não retorna mensagem para não expor o comando a usuários não autorizados
            return;
        }

        const subCommand = args.length > 0 ? args.shift().toLowerCase() : null;
        const currentPrefix = prefix || client.prefix || process.env.PREFIX || "s!"; // Obtém o prefixo

        if (!subCommand) {
            const helpEmbed = new EmbedBuilder()
                .setColor('#E91E63')
                .setTitle('<:config:1246071733875114014> Comandos de Desenvolvedor (devctl)')
                .setDescription(`Use \`${currentPrefix}devctl <subcomando> [argumentos]\``)
                .addFields(
                    { name: '🔄 `restart`', value: 'Reinicia o bot.', inline: true },
                    { name: '🔧 `reloadcmd <comando>`', value: 'Recarrega um comando.', inline: true },
                    { name: '🚀 `reloadall`', value: 'Recarrega todos os comandos de prefixo.', inline: true },
                    { name: ' PELIGRO `eval <code>`', value: 'Executa código JS.', inline: true },
                    { name: '🛠️ `maintenance <on|off>`', value: 'Modo de manutenção.', inline: true },
                    { name: '🚪 `leaveguild <ID>`', value: 'Faz o bot sair de um servidor.', inline: true },
                    { name: '📡 `ping`', value: 'Verifica a latência.', inline: true },
                    { name: '📋 `listguilds`', value: 'Lista servidores do bot.', inline: true },
                    { name: '📜 `getlogs [linhas]`', value: 'Mostra logs recentes.', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [helpEmbed] });
        }

        // --- Subcomandos ---

        if (subCommand === "restart") {
            try {
                await message.channel.send("<a:loading:1246072052350124032> Reiniciando o bot... O bot será desconectado em breve.");
                console.log(`[DEVCTL] Comando de reinício executado por ${message.author.tag} (ID: ${message.author.id})`);
                process.exit(0); // Discloud ou PM2 devem reiniciar
            } catch (error) {
                console.error("[DEVCTL] Erro no subcomando restart:", error);
            }

        } else if (subCommand === "reloadcmd") {
            const commandToReloadName = args.length > 0 ? args.shift().toLowerCase() : null;
            if (!commandToReloadName) {
                return message.reply({ content: `Por favor, especifique qual comando recarregar. Uso: \`${currentPrefix}devctl reloadcmd <nome_do_comando>\`` });
            }

            // Usar client.prefixCommands para comandos de prefixo
            const command = client.prefixCommands.get(commandToReloadName) ||
                            client.prefixCommands.find(cmd => cmd.aliases && cmd.aliases.includes(commandToReloadName));

            if (!command) {
                return message.reply({ content: `Comando de prefixo \`${commandToReloadName}\` não encontrado.` });
            }
            //filePath deve ser o caminho absoluto para o arquivo do comando, adicionado pelo seu command handler
            if (!command.filePath || !fs.existsSync(command.filePath)) {
                console.error(`[DEVCTL] FilePath não encontrado ou inválido para o comando ${commandToReloadName}: ${command.filePath}`);
                return message.reply({ content: `Não foi possível encontrar o arquivo para o comando \`${commandToReloadName}\`. Verifique os logs.` });
            }

            try {
                delete require.cache[require.resolve(command.filePath)];
                const newCommand = require(command.filePath);
                client.prefixCommands.set(newCommand.name, newCommand);
                // Se seu command handler armazena filePath, reatribua
                newCommand.filePath = command.filePath;
                 // Se você usa categorias, pode ser necessário reatribuir
                if (command.category) newCommand.category = command.category;


                await message.channel.send({ content: `Comando de prefixo \`${newCommand.name}\` recarregado com sucesso!` });
                console.log(`[DEVCTL] Comando ${newCommand.name} recarregado por ${message.author.tag}`);
            } catch (error) {
                console.error(`[DEVCTL] Erro ao recarregar comando ${commandToReloadName}:`, error);
                message.channel.send({ content: `Falha ao recarregar o comando \`${commandToReloadName}\`. Verifique os logs.\n\`\`\`${error.message.substring(0, 1000)}\`\`\`` });
            }

        } else if (subCommand === "reloadall" || subCommand === "reloadallcmds") {
            if (!client.prefixCommands || typeof client.prefixCommands.forEach !== 'function') {
                return message.reply({ content: "A coleção de comandos de prefixo do cliente não está acessível ou não é iterável." });
            }

            const reloadedCmds = [];
            const failedCmds = [];
            let totalCmdsAttempted = 0;

            const commandEntries = Array.from(client.prefixCommands.entries()); // [name, commandObject]

            for (const [cmdName, command] of commandEntries) {
                if (command && command.filePath && fs.existsSync(command.filePath)) {
                    totalCmdsAttempted++;
                    try {
                        delete require.cache[require.resolve(command.filePath)];
                        const newCommand = require(command.filePath);
                        client.prefixCommands.set(newCommand.name, newCommand);
                        newCommand.filePath = command.filePath; // Reatribuir filePath
                        if (command.category) newCommand.category = command.category;

                        reloadedCmds.push(newCommand.name);
                    } catch (error) {
                        console.error(`[DEVCTL] Falha ao recarregar ${cmdName}:`, error);
                        failedCmds.push(`${cmdName} (erro)`);
                    }
                } else if (command && !command.filePath) {
                    console.warn(`[DEVCTL] Comando ${cmdName} não possui filePath definido, não pode ser recarregado.`);
                }
            }

            if (totalCmdsAttempted === 0) {
                return message.channel.send({ content: "Nenhum comando de prefixo encontrado com `filePath` para recarregar." });
            }

            let response = "";
            if (reloadedCmds.length > 0) {
                response += `✅ **${reloadedCmds.length} comando(s) de prefixo recarregado(s) com sucesso!**\n`;
            }
            if (failedCmds.length > 0) {
                response += `❌ **${failedCmds.length} comando(s) de prefixo falharam ao recarregar:** \`${failedCmds.join(', ')}\`\nConsulte o console para mais detalhes.\n`;
            }
            if (response === "") {
                response = "Nenhuma ação de recarregamento realizada ou nenhum comando elegível encontrado.";
            }
            
            await message.channel.send({ content: response.substring(0, 1990) });
            console.log(`[DEVCTL] Tentativa de recarregar todos os comandos por ${message.author.tag}. Recarregados: ${reloadedCmds.length}, Falhas: ${failedCmds.length}`);


        } else if (subCommand === "eval") {
            const codeToExecute = args.join(" ");
            if (!codeToExecute) {
                return message.reply({ content: "Por favor, forneça um código para executar." });
            }
            try {
                const client = message.client; const guild = message.guild; const channel = message.channel; const author = message.author; const member = message.member;
                let evaled = await eval(codeToExecute);
                if (typeof evaled !== "string") evaled = util.inspect(evaled, { depth: 0, getters: true });
                const MAX_LENGTH = 1900;
                if (evaled.length > MAX_LENGTH) evaled = evaled.substring(0, MAX_LENGTH) + "... (saída truncada)";
                if (client.token) evaled = evaled.replace(new RegExp(client.token, 'gi'), '[TOKEN OCULTADO]');
                await message.channel.send({ content: `**Resultado:**\n\`\`\`javascript\n${evaled}\n\`\`\`` });
            } catch (err) {
                const errorMsg = err.stack || err.toString();
                await message.channel.send({ content: `**ERRO:**\n\`\`\`xl\n${errorMsg.substring(0,1900)}\n\`\`\`` });
            }

        } else if (subCommand === "maintenance") {
            const mode = args.length > 0 ? args.shift().toLowerCase() : null;
            if (mode === "on") {
                client.maintenanceMode = true;
                await message.channel.send({ content: "🛠️ **Modo de manutenção ATIVADO.**" });
                console.log(`[DEVCTL] Modo de manutenção ATIVADO por ${message.author.tag}`);
            } else if (mode === "off") {
                client.maintenanceMode = false;
                await message.channel.send({ content: "✅ **Modo de manutenção DESATIVADO.**" });
                console.log(`[DEVCTL] Modo de manutenção DESATIVADO por ${message.author.tag}`);
            } else {
                await message.reply({ content: `Uso incorreto. Tente: \`${currentPrefix}devctl maintenance <on|off>\`` });
            }
        
        } else if (subCommand === "leaveguild") {
            const guildIdToLeave = args.length > 0 ? args.shift() : null;
            if (!guildIdToLeave) {
                return message.reply({ content: `Por favor, forneça o ID do servidor. Uso: \`${currentPrefix}devctl leaveguild <ID_do_servidor>\`` });
            }
            const guild = client.guilds.cache.get(guildIdToLeave);
            if (!guild) {
                return message.reply({ content: `Não estou no servidor com ID: \`${guildIdToLeave}\`.` });
            }
            try {
                await guild.leave();
                await message.channel.send({ content: `Saí do servidor: **${guild.name}** (ID: ${guildIdToLeave})` });
                console.log(`[DEVCTL] Bot forçado a sair do servidor ${guild.name} (${guildIdToLeave}) por ${message.author.tag}`);
            } catch (error) {
                console.error(`[DEVCTL] Erro ao tentar sair do servidor ${guildIdToLeave}:`, error);
                message.channel.send({ content: `Ocorreu um erro ao tentar sair do servidor \`${guildIdToLeave}\`.` });
            }

        } else if (subCommand === "ping") {
            const apiLatency = Math.round(client.ws.ping);
            const msg = await message.channel.send({ content: "Calculando ping..."});
            const roundtripLatency = msg.createdTimestamp - message.createdTimestamp;
            msg.edit({ content: `Pong! 🛰️ Latência da API: \`${apiLatency}ms\`. 핑 Latência de ida e volta: \`${roundtripLatency}ms\`.` });

        } else if (subCommand === "listguilds" || subCommand === "guilds") {
            const guilds = client.guilds.cache;
            let description = `O bot está em **${guilds.size}** servidores.\n\n`;
            let count = 0;
            for (const guild of guilds.values()) {
                count++;
                const line = `${count}. **${guild.name}** (ID: \`${guild.id}\`) - Membros: ${guild.memberCount}\n`;
                if (description.length + line.length > 3800) { // Limite do embed description
                    description += `... e mais ${guilds.size - (count -1)} servidores.`;
                    break;
                }
                description += line;
            }
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📋 Lista de Servidores')
                .setDescription(description)
                .setTimestamp();
            await message.channel.send({ embeds: [embed] });

        } else if (subCommand === "getlogs" || subCommand === "logs") {
            const linesToFetch = args.length > 0 && !isNaN(parseInt(args[0])) ? parseInt(args[0]) : 20;
            // ASSUMINDO que você tem um arquivo de log na raiz do projeto do BOT chamado 'bot.log'
            // E que este comando devctl.js está em 'src/commands/dev/devctl.js'
            const logFilePath = path.join(__dirname, '../../../bot.log'); // Volta 3 níveis (dev, commands, src) para a raiz

            if (!fs.existsSync(logFilePath)) {
                return message.channel.send({ content: `Arquivo de log não encontrado em \`${logFilePath}\`. Verifique o caminho e a configuração de logging.` });
            }
            try {
                const logData = fs.readFileSync(logFilePath, 'utf8');
                const logLines = logData.split('\n').filter(line => line.trim() !== '');
                const recentLogs = logLines.slice(-linesToFetch).join('\n');

                if (!recentLogs) {
                    return message.channel.send({ content: "Nenhum log encontrado ou o arquivo está vazio." });
                }
                const maxLength = 1950;
                if (recentLogs.length <= maxLength) {
                    await message.channel.send({ content: `**Últimas ${linesToFetch} linhas do log:**\n\`\`\`log\n${recentLogs.substring(0, maxLength)}\n\`\`\`` });
                } else {
                    await message.channel.send({ content: `**Últimas ${linesToFetch} linhas do log (truncado):**`});
                    for (let i = 0; i < recentLogs.length; i += maxLength) {
                        const chunk = recentLogs.substring(i, Math.min(i + maxLength, recentLogs.length));
                        await message.channel.send({ content: `\`\`\`log\n${chunk}\n\`\`\`` });
                    }
                }
                console.log(`[DEVCTL] Logs solicitados por ${message.author.tag}`);
            } catch (error) {
                console.error("[DEVCTL] Erro ao ler arquivo de log:", error);
                await message.channel.send({ content: "Ocorreu um erro ao tentar ler os logs." });
            }
        } else {
            message.reply({ content: `Subcomando \`${subCommand}\` inválido. Use \`${currentPrefix}devctl\` para ver a lista de subcomandos.` });
        }
    }
};