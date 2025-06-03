// src/commands/dev/getuserdb.js
const { EmbedBuilder } = require('discord.js');
const { inspect } = require('util');

module.exports = {
    name: 'getuserdb',
    aliases: ['gud', 'fetchuser', 'dbuser'],
    description: 'Busca e exibe os dados de um usuário do banco de dados. (Apenas Desenvolvedores)',
    category: 'dev',
    devOnly: true,
    args: true,
    usage: '<ID do Usuário ou @Menção>',
    async execute({ client, message, args }) {
        const ownerIds = (process.env.OWNER_IDS || "").split(',').map(id => id.trim());
        if (!ownerIds.includes(message.author.id)) {
            return;
        }

        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);

        if (!targetUser) {
            return message.reply("Usuário não encontrado. Forneça um ID válido ou mencione o usuário.");
        }

        const User = client.models.User;
        if (!User) {
            return message.reply("Modelo 'User' não encontrado no cliente. Verifique o carregamento dos modelos.");
        }

        try {
            const userProfile = await User.findOne({ discordId: targetUser.id });

            if (!userProfile) {
                const embed = new EmbedBuilder()
                    .setColor('#FF69B4') // Rosa
                    .setDescription(`ℹ️ Nenhum perfil encontrado no banco de dados para ${targetUser.tag} (\`${targetUser.id}\`).`)
                    .setTimestamp()
                    .setFooter({ text: `Consulta por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
                return message.channel.send({ embeds: [embed] });
            }

            let userDataString = inspect(userProfile.toObject(), { depth: null, colors: false }); // toObject() para melhor visualização
            
            const SENSITIVE_USER_FIELDS = ['someSensitiveFieldIfYouAddIt']; // Adicione campos sensíveis do userProfile que você não quer mostrar
            SENSITIVE_USER_FIELDS.forEach(key => {
                const regex = new RegExp(`'${key}':\\s*'.*?'`, 'gi'); // Exemplo para string
                userDataString = userDataString.replace(regex, `'${key}': '[REDACTED]'`);
            });


            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle(`📄 Dados do DB para ${targetUser.tag}`)
                .setTimestamp()
                .setFooter({ text: `Consulta por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            if (userDataString.length > 4000) { // Limite de descrição do Embed
                // Enviar como arquivo se for muito grande
                const attachment = Buffer.from(userDataString, 'utf-8');
                embed.setDescription("Os dados do usuário são muito extensos e foram enviados como um arquivo.");
                await message.channel.send({ embeds: [embed], files: [{ attachment: attachment, name: `${targetUser.id}_data.txt` }] });
            } else {
                embed.setDescription(`\`\`\`javascript\n${userDataString}\n\`\`\``);
                await message.channel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error(`Erro ao buscar dados do usuário ${targetUser.id} do DB:`, error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription(`❌ Falha ao buscar dados do usuário \`${targetUser.tag}\`:\n\`\`\`${error.message}\`\`\``)
                .setTimestamp()
                .setFooter({ text: `Consulta por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [errorEmbed] });
        }
    }
};