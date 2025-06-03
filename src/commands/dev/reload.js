// src/commands/dev/reload.js
const { EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
    name: 'reload',
    aliases: ['rl'],
    description: 'Recarrega um comando específico do bot. (Apenas Desenvolvedores)',
    category: 'dev',
    devOnly: true,
    args: true, // Indica que o comando espera argumentos
    usage: '<nomeDoComando>',
    async execute({ client, message, args }) {
        const ownerIds = (process.env.OWNER_IDS || "").split(',').map(id => id.trim());
        if (!ownerIds.includes(message.author.id)) {
            return; 
        }

        // VERIFICAÇÃO ADICIONADA AQUI
        if (!args[0]) {
            const noArgsEmbed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setDescription(`❌ Por favor, forneça o nome do comando para recarregar. Uso: \`${process.env.PREFIX}reload ${this.usage}\``)
                .setTimestamp()
                .setFooter({ text: `Tentativa de recarga por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [noArgsEmbed] });
        }

        const commandName = args[0].toLowerCase();
        const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) {
            const embed = new EmbedBuilder()
                .setColor('#FF69B4') 
                .setDescription(`❌ Não há comando com nome ou alias \`${commandName}\`, ${message.author.toString()}!`)
                .setTimestamp()
                .setFooter({ text: `Tentativa de recarga por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [embed] });
        }

        let filePathToReload = '';
        // A lógica para encontrar filePathToReload pode precisar ser robustecida
        // Esta é uma tentativa simplificada baseada na categoria armazenada no objeto do comando
        if (command.category) {
            // Ajuste o path.join para subir os níveis corretos até a pasta 'commands'
            // Ex: se reload.js está em src/commands/dev/ e os comandos estão em src/commands/categoria/
            const commandPathAttempt = path.join(__dirname, '..', command.category, `${command.name}.js`); 
            
            if (fs.existsSync(commandPathAttempt)) {
                filePathToReload = commandPathAttempt;
            } else {
                // Fallback mais genérico se a categoria não bater ou estrutura for diferente
                // Isso pode ser complexo e propenso a erros se não soubermos a estrutura exata.
                // Por agora, vamos focar no caminho mais direto.
                console.warn(`Tentativa de caminho direto falhou para ${command.name} na categoria ${command.category}: ${commandPathAttempt}`);
            }
        }
        
        // Se não encontrou o caminho, tenta uma busca mais ampla (pode ser menos preciso)
        if (!filePathToReload || !fs.existsSync(filePathToReload)) {
            const categoriesPath = path.join(__dirname, '..'); // Assume que está em src/commands/dev, então '..' volta para src/commands
            try {
                const categoryFolders = fs.readdirSync(categoriesPath).filter(folder => 
                    fs.lstatSync(path.join(categoriesPath, folder)).isDirectory()
                );
                for (const folder of categoryFolders) {
                    const potentialPath = path.join(categoriesPath, folder, `${command.name}.js`);
                    if (fs.existsSync(potentialPath)) {
                        // Verifica se o nome exportado realmente corresponde (caso de arquivos com nomes diferentes do comando)
                        const tempCmdCheck = require(potentialPath);
                        if (tempCmdCheck.name === command.name) {
                            filePathToReload = potentialPath;
                            break;
                        }
                    }
                }
            } catch (e) {
                console.error("Erro ao tentar busca ampla por arquivo de comando:", e);
            }
        }
        
        if (!filePathToReload || !fs.existsSync(filePathToReload)) {
             const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setDescription(`❌ Não foi possível encontrar o arquivo físico para o comando \`${command.name}\`. Verifique a propriedade 'category' no comando ou a lógica de busca de arquivo no comando 'reload'.`)
                .setTimestamp()
                .setFooter({ text: `Tentativa de recarga por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [embed] });
        }


        try {
            delete require.cache[require.resolve(filePathToReload)];

            const newCommand = require(filePathToReload);
            const categoryFromFile = path.basename(path.dirname(filePathToReload)); // Pega o nome da pasta pai como categoria
            const commandObjectWithCategory = { ...newCommand, category: newCommand.category || categoryFromFile };

            client.commands.set(commandObjectWithCategory.name, commandObjectWithCategory);
            if (commandObjectWithCategory.aliases && Array.isArray(commandObjectWithCategory.aliases)) {
                commandObjectWithCategory.aliases.forEach(alias => client.commands.set(alias, commandObjectWithCategory));
            }

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setDescription(`✅ Comando \`${commandObjectWithCategory.name}\` (categoria: ${commandObjectWithCategory.category}) foi recarregado com sucesso!`)
                .setTimestamp()
                .setFooter({ text: `Recarregado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error(`Erro ao recarregar comando ${commandName}:`, error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Falha ao Recarregar Comando')
                .setDescription(`Ocorreu um erro ao tentar recarregar o comando \`${commandName}\`.`)
                .addFields({ name: 'Erro', value: `\`\`\`${error.message.substring(0, 1000)}\`\`\``})
                .setTimestamp()
                .setFooter({ text: `Tentativa de recarga por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [embed] });
        }
    }
};