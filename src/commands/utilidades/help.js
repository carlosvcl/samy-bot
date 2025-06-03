// src/commands/utilidades/help.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['ajuda', 'comandos', 'cmd'],
    description: 'Lista todos os meus comandos ou informações sobre um comando específico.',
    category: 'utilidades',
    usage: '[nome do comando ou categoria]',
    async execute({ client, message, args }) {
        const prefix = process.env.PREFIX;
        const ownerIds = (process.env.OWNER_IDS || "").split(',').map(id => id.trim());
        const isDeveloper = ownerIds.includes(message.author.id);

        // <<< MUDANÇA AQUI: Usar client.prefixCommands >>>
        const allPrefixCommands = client.prefixCommands; 

        const accessibleCommands = allPrefixCommands.filter(cmd => { // <<< MUDANÇA AQUI
            return isDeveloper || !cmd.devOnly;
        });

        const defaultNotFoundMessage = () => {
            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setDescription(`❌ Comando ou categoria não encontrado(a)! Use \`${prefix}help\` para ver os comandos e categorias disponíveis.`)
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [embed] });
        };

        if (!args.length) { // Ajuda geral
            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`📚 Central de Ajuda de ${client.user.username}`)
                .setDescription(
                    `Olá, ${message.author.toString()}! Aqui estão minhas categorias de comandos.\n` +
                    `Use \`${prefix}help [nome do comando]\` para detalhes sobre um comando específico.\n` +
                    `Ou use \`${prefix}help [nome da categoria]\` para listar os comandos da categoria.\n\n` +
                    `**Minhas categorias de comandos:**`
                )
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | Comandos visíveis: ${accessibleCommands.size} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            const categories = {};
            // Itera sobre accessibleCommands (que já é client.prefixCommands filtrado)
            accessibleCommands.forEach(cmd => {
                const category = cmd.category || 'Outros';
                if (category.toLowerCase() === 'dev' && !isDeveloper) {
                    return;
                }
                if (!categories[category]) {
                    categories[category] = [];
                }
                if (!categories[category].some(c => c.name === cmd.name)) {
                     categories[category].push(cmd);
                }
            });
            
            const sortedCategories = Object.keys(categories).sort();

            if (sortedCategories.length === 0 && Object.keys(categories).every(cat => categories[cat].length === 0) ) {
                 // Nenhuma ação necessária aqui, a descrição já é suficiente.
            }

            for (const categoryName of sortedCategories) {
                const categoryCmds = categories[categoryName];
                if (categoryCmds.length > 0) {
                     embed.addFields({ 
                        name: `**${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}** (${categoryCmds.length} comandos)`, 
                        value: categoryCmds.map(cmd => `\`${cmd.name}\``).join(', ').substring(0,1020) // Mantém substring para evitar erros de limite
                    });
                }
            }
            return message.channel.send({ embeds: [embed] });

        } else { 
            const nameOrCategory = args.join(' ').toLowerCase();
            
            // Busca em accessibleCommands (que já é client.prefixCommands filtrado)
            let command = accessibleCommands.get(nameOrCategory) || accessibleCommands.find(c => c.aliases && c.aliases.includes(nameOrCategory));

            if (command) { 
                const embedCmd = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle(`❓ Ajuda: Comando \`${command.name}\``)
                    .setTimestamp()
                    .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

                if (command.description) embedCmd.setDescription(`*${command.description}*`);
                if (command.aliases && command.aliases.length > 0) embedCmd.addFields({ name: '🏷️ Alternativas (Aliases)', value: command.aliases.map(a => `\`${a}\``).join(', ') });
                
                let usageString = `\`${prefix}${command.name}`;
                if (command.usage) usageString += ` ${command.usage}\``; else usageString += `\``;
                embedCmd.addFields({ name: '🔩 Como usar', value: usageString });

                if (command.category) embedCmd.addFields({ name: '📂 Categoria', value: command.category.charAt(0).toUpperCase() + command.category.slice(1), inline: true });
                if (command.cooldown) embedCmd.addFields({ name: '⏳ Cooldown do Comando', value: `${command.cooldown} segundo(s)`, inline: true });
                
                let permUserStr = "Nenhuma específica";
                if (command.permissionsUser && command.permissionsUser.length > 0) {
                     permUserStr = command.permissionsUser.map(p => `\`${p.toString()}\``).join(', ');
                }
                embedCmd.addFields({ name: '👤 Permissões de Usuário Requeridas', value: permUserStr, inline:false });

                let permBotStr = "Nenhuma específica";
                if (command.permissionsBot && command.permissionsBot.length > 0) {
                     permBotStr = command.permissionsBot.map(p => `\`${p.toString()}\``).join(', ');
                }
                embedCmd.addFields({ name: '🤖 Permissões do Bot Requeridas', value: permBotStr, inline:false });

                if (command.example) { 
                    embedCmd.addFields({name: '💡 Exemplo de Uso Prático', value: `\`${prefix}${command.example}\``});
                }

                return message.channel.send({ embeds: [embedCmd] });

            } else { 
                const categoryToDisplay = nameOrCategory;
                
                if (categoryToDisplay.toLowerCase() === 'dev' && !isDeveloper) {
                    return defaultNotFoundMessage();
                }
                // Filtra em accessibleCommands (que já é client.prefixCommands filtrado)
                const categoryCommands = accessibleCommands.filter(cmd => cmd.category && cmd.category.toLowerCase() === categoryToDisplay);
                
                if (categoryCommands.size > 0) {
                    const uniqueCommandsInCategory = [];
                    categoryCommands.forEach(cmd => { 
                        if (!uniqueCommandsInCategory.some(c => c.name === cmd.name)) {
                            uniqueCommandsInCategory.push(cmd);
                        }
                    });

                    if (uniqueCommandsInCategory.length === 0 ) { 
                        return defaultNotFoundMessage();
                    }
                    
                    const embedCat = new EmbedBuilder()
                        .setColor('#FF69B4')
                        .setTitle(`📂 Comandos da Categoria: ${categoryToDisplay.charAt(0).toUpperCase() + categoryToDisplay.slice(1)} (${uniqueCommandsInCategory.length})`)
                        .setDescription(uniqueCommandsInCategory.map(cmd => `**\`${prefix}${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ''}\`**: ${cmd.description || 'Sem descrição.'}`).join('\n').substring(0,4000)) // Mantém substring
                        .setTimestamp()
                        .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
                    return message.channel.send({ embeds: [embedCat] });
                } else {
                    return defaultNotFoundMessage();
                }
            }
        }
    }
};