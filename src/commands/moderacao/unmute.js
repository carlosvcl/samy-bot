// src/commands/moderacao/unmute.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { logModerationAction } = require('../../utils/modLogHelper'); // Ajuste o caminho se necessário

module.exports = {
    name: 'unmute',
    aliases: ['untimeout', 'dessilenciar', 'removercastigo'],
    description: 'Remove o silenciamento (timeout) de um usuário.',
    category: 'moderação',
    args: true,
    usage: '<@usuário ou ID> [razão]',
    permissionsUser: [PermissionsBitField.Flags.ModerateMembers],
    permissionsBot: [PermissionsBitField.Flags.ModerateMembers],
    async execute({ client, message, args }) {
        const targetMember = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);

        if (!targetMember) {
            return message.reply('Usuário não encontrado. Por favor, mencione um usuário ou forneça um ID válido.');
        }
        
        if (!targetMember.isCommunicationDisabled()) {
            return message.reply(`${targetMember.user.tag} não está silenciado no momento.`);
        }
        // Checagem de hierarquia (similar ao mute)
        if (targetMember.permissions.has(PermissionsBitField.Flags.Administrator) && message.guild.ownerId !== message.author.id) {
             return message.reply('Não posso remover o silenciamento de um administrador, a menos que você seja o dono do servidor.');
        }
        if (message.member.roles.highest.position <= targetMember.roles.highest.position && message.guild.ownerId !== message.author.id) {
            return message.reply('Você não pode remover o silenciamento de um membro com cargo igual ou superior ao seu, a menos que você seja o dono do servidor.');
        }

        const reason = args.slice(1).join(' ') || 'Nenhuma razão fornecida (remoção de timeout).';

        try {
            await targetMember.timeout(null, `Timeout removido por ${message.author.tag}: ${reason}`); // Passar null para remover
            const caseId = await logModerationAction(client, message.guild, 'unmute', message.author, targetMember.user, reason).catch(err => {
                console.error("Erro ao logar ação de unmute:", err);
                return "ERRO_LOG";
            });

            const unmuteEmbed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('🔊 Usuário Reativado (Timeout Removido)')
                .setDescription(`O silenciamento de **${targetMember.user.tag}** foi removido com sucesso.`)
                .addFields(
                    { name: '🎯 Usuário Alvo', value: `${targetMember.user.tag} (\`${targetMember.id}\`)` },
                    { name: '🛡️ Moderador Responsável', value: `${message.author.tag} (\`${message.author.id}\`)` },
                    { name: '📖 Razão da Remoção', value: reason.substring(0, 1000) },
                    { name: '📄 ID do Caso de Moderação', value: `\`${caseId}\`` }
                )
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Ação de moderação por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [unmuteEmbed] });

        } catch (error) {
            console.error("Erro ao remover silenciamento:", error);
            message.reply('Não foi possível remover o silenciamento do membro. Verifique minhas permissões e a hierarquia de cargos.');
        }
    }
};