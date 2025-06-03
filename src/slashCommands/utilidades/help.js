// src/slashCommands/utilidades/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Lista todos os comandos de prefixo ou informações sobre um comando/categoria específico.')
        .addStringOption(option =>
            option.setName('nome_comando_ou_categoria')
                .setDescription('O nome do comando ou da categoria para obter ajuda específica.')
                .setRequired(false)), // Opcional

    async execute(interaction, client) {
        const prefix = process.env.PREFIX || "s!"; // Pega o prefixo do .env ou usa 's!' como padrão
        const ownerIds = (process.env.OWNER_IDS || "").split(',').map(id => id.trim());
        const isDeveloper = ownerIds.includes(interaction.user.id);

        const allPrefixCommands = client.prefixCommands;
        const accessibleCommands = allPrefixCommands.filter(cmd => {
            return isDeveloper || !cmd.devOnly;
        });

        const arg = interaction.options.getString('nome_comando_ou_categoria');

        const defaultNotFoundMessage = async () => {
            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setDescription(`❌ Comando ou categoria não encontrado(a)! Use \`/help\` para ver os comandos e categorias disponíveis.`)
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${interaction.user.tag} | ${client.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
            await interaction.reply({ embeds: [embed], ephemeral: true });
        };

        if (!arg) { // Ajuda geral - lista todas as categorias e comandos
            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`📚 Central de Ajuda de ${client.user.username}`)
                .setDescription(
                    `Olá, ${interaction.user.toString()}! Aqui estão minhas categorias de comandos de prefixo (\`${prefix}\`).\n` +
                    `Use \`/help [nome do comando]\` para detalhes sobre um comando específico.\n` +
                    `Ou use \`/help [nome da categoria]\` para listar os comandos da categoria.\n\n` +
                    `**Minhas categorias de comandos:**`
                )
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${interaction.user.tag} | Comandos visíveis: ${accessibleCommands.size} | ${client.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

            const categories = {};
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

            for (const categoryName of sortedCategories) {
                const categoryCmds = categories[categoryName];
                if (categoryCmds.length > 0) {
                     embed.addFields({ 
                        name: `**${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}** (${categoryCmds.length} comandos)`, 
                        value: categoryCmds.map(cmd => `\`${cmd.name}\``).join(', ').substring(0,1020)
                    });
                }
            }
            await interaction.reply({ embeds: [embed] });

        } else { 
            const nameOrCategory = arg.toLowerCase();
            
            let command = accessibleCommands.get(nameOrCategory) || accessibleCommands.find(c => c.aliases && c.aliases.includes(nameOrCategory));

            if (command) { // Ajuda para um comando específico
                const embedCmd = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle(`❓ Ajuda: Comando de Prefixo \`${prefix}${command.name}\``)
                    .setTimestamp()
                    .setFooter({ text: `Solicitado por: ${interaction.user.tag} | ${client.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

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

                await interaction.reply({ embeds: [embedCmd] });

            } else { // Ajuda para uma categoria específica
                const categoryToDisplay = nameOrCategory;
                
                if (categoryToDisplay.toLowerCase() === 'dev' && !isDeveloper) {
                    return defaultNotFoundMessage();
                }

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
                        .setDescription(uniqueCommandsInCategory.map(cmd => `**\`${prefix}${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ''}\`**: ${cmd.description || 'Sem descrição.'}`).join('\n').substring(0,4000))
                        .setTimestamp()
                        .setFooter({ text: `Solicitado por: ${interaction.user.tag} | ${client.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
                    await interaction.reply({ embeds: [embedCat] });
                } else {
                    await defaultNotFoundMessage();
                }
            }
        }
    }
};