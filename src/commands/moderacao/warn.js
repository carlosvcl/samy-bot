// src/commands/moderacao/warn.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { logModerationAction } = require('../../utils/modLogHelper'); // Ajuste o caminho se necessário

module.exports = {
    name: 'warn',
    aliases: ['advertir', 'aviso', 'advertencia'],
    description: 'Adverte um usuário no servidor e registra a advertência.',
    category: 'moderação',
    args: true,
    usage: '<@usuário ou ID> <razão da advertência>',
    permissionsUser: [PermissionsBitField.Flags.KickMembers], // Exemplo, pode ser ModerateMembers ou uma permissão customizada
    async execute({ client, message, args }) {
        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        
        if (!targetUser) {
            return message.reply('Usuário não encontrado. Por favor, mencione um usuário ou forneça um ID válido.');
        }
        if (targetUser.id === message.author.id) {
            return message.reply('Você não pode se advertir.');
        }
        if (targetUser.bot) {
            return message.reply('Você não pode advertir um bot. Eles não aprendem a lição!');
        }

        // Checagem de hierarquia se o alvo for um membro do servidor
        const targetMember = message.guild.members.cache.get(targetUser.id);
        if (targetMember && message.member.roles.highest.position <= targetMember.roles.highest.position && message.guild.ownerId !== message.author.id) {
            return message.reply('Você não pode advertir um membro com cargo igual ou superior ao seu, a menos que você seja o dono do servidor.');
        }
        if (targetMember && targetMember.permissions.has(PermissionsBitField.Flags.Administrator) && message.guild.ownerId !== message.author.id){
            return message.reply('Você não pode advertir um administrador, a menos que você seja o dono do servidor.');
        }


        const reason = args.slice(1).join(' ');
        if (!reason || reason.trim() === '') {
            return message.reply('Você precisa fornecer uma razão válida para a advertência.');
        }

        try {
            const caseId = await logModerationAction(client, message.guild, 'warn', message.author, targetUser, reason).catch(err => {
                console.error("Erro ao logar ação de warn:", err);
                return "ERRO_LOG";
            });

            const warnEmbed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('⚠️ Usuário Advertido Oficialmente')
                .setDescription(`O usuário **${targetUser.tag}** recebeu uma advertência formal.`)
                .addFields(
                    { name: '🎯 Usuário Alvo', value: `${targetUser.tag} (\`${targetUser.id}\`)` },
                    { name: '🛡️ Moderador Responsável', value: `${message.author.tag} (\`${message.author.id}\`)` },
                    { name: '📖 Razão da Advertência', value: reason.substring(0, 1000) },
                    { name: '📄 ID do Caso de Moderação', value: `\`${caseId}\`` }
                )
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Ação de moderação por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [warnEmbed] });

            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('⚠️ Você foi Advertido!')
                    .setDescription(`Você recebeu uma advertência no servidor **${message.guild.name}**. Por favor, revise as regras do servidor para evitar futuras sanções.`)
                    .addFields(
                        { name: '🛡️ Advertido por', value: message.author.tag },
                        { name: '📖 Razão', value: reason.substring(0, 1000) }
                    )
                    .setTimestamp()
                    .setFooter({text: `Servidor: ${message.guild.name} | ${client.user.username}`});
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Não foi possível enviar DM de advertência para ${targetUser.tag}.`);
                // Não precisa editar a mensagem do canal para isso, o log principal é suficiente.
            }

        } catch (error) {
            console.error("Erro ao advertir usuário:", error);
            message.reply('Ocorreu um erro ao tentar advertir o usuário.');
        }
    }
};