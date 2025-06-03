// src/commands/moderacao/mute.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const ms = require('ms');
const { logModerationAction } = require('../../utils/modLogHelper'); // Ajuste o caminho se necessário

module.exports = {
    name: 'mute',
    aliases: ['timeout', 'silenciar', 'castigo'],
    description: 'Silencia um usuário por um tempo determinado (máx 28 dias).',
    category: 'moderação',
    args: true,
    usage: '<@usuário ou ID> <duração (ex: 10m, 1h, 7d)> [razão]',
    permissionsUser: [PermissionsBitField.Flags.ModerateMembers], // Permissão para aplicar timeout
    permissionsBot: [PermissionsBitField.Flags.ModerateMembers],
    async execute({ client, message, args }) {
        const targetMember = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        
        if (!targetMember) {
            return message.reply('Usuário não encontrado. Por favor, mencione um usuário ou forneça um ID válido.');
        }
        if (targetMember.id === message.author.id) {
            return message.reply('Você não pode se silenciar.');
        }
        if (targetMember.isCommunicationDisabled()) {
            const currentTimeoutEnd = new Date(targetMember.communicationDisabledUntilTimestamp);
            return message.reply(`${targetMember.user.tag} já está silenciado até <t:${Math.floor(currentTimeoutEnd.getTime()/1000)}:F> (<t:${Math.floor(currentTimeoutEnd.getTime()/1000)}:R>).`);
        }
        // Checagem de hierarquia
        if (targetMember.permissions.has(PermissionsBitField.Flags.Administrator) && message.guild.ownerId !== message.author.id) {
             return message.reply('Não posso silenciar um administrador, a menos que você seja o dono do servidor.');
        }
        if (message.member.roles.highest.position <= targetMember.roles.highest.position && message.guild.ownerId !== message.author.id) {
            return message.reply('Você não pode silenciar um membro com cargo igual ou superior ao seu, a menos que você seja o dono do servidor.');
        }

        const durationString = args[1];
        const reason = args.slice(2).join(' ') || 'Nenhuma razão fornecida.';
        
        let durationMs;
        try {
            durationMs = ms(durationString);
            if (!durationMs || durationMs < 1000 || durationMs > ms('28d')) { // Min 1 segundo, Max 28 dias
                return message.reply('Duração inválida. Forneça um tempo válido como 10s, 5m, 1h, 7d (mínimo 1 segundo, máximo 28 dias).');
            }
        } catch (e) {
            return message.reply('Formato de duração inválido. Use, por exemplo: 10s, 5m, 2h, 3d.');
        }

        try {
            await targetMember.timeout(durationMs, `Silenciado por ${message.author.tag}: ${reason}`);
            const caseId = await logModerationAction(client, message.guild, 'mute', message.author, targetMember.user, reason, ms(durationMs, { long: true })).catch(err => {
                console.error("Erro ao logar ação de mute:", err);
                return "ERRO_LOG";
            });

            const expirationTimestamp = Math.floor((Date.now() + durationMs) / 1000);

            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('🔇 Usuário Silenciado (Timeout Aplicado)')
                .setDescription(`O usuário **${targetMember.user.tag}** foi silenciado temporariamente.`)
                .addFields(
                    { name: '🎯 Usuário Alvo', value: `${targetMember.user.tag} (\`${targetMember.id}\`)`},
                    { name: '🛡️ Moderador Responsável', value: `${message.author.tag} (\`${message.author.id}\`)`},
                    { name: '⏰ Duração do Silenciamento', value: ms(durationMs, { long: true }) },
                    { name: '🗓️ Expira em', value: `<t:${expirationTimestamp}:F> (<t:${expirationTimestamp}:R>)`},
                    { name: '📖 Razão Fornecida', value: reason.substring(0, 1000) },
                    { name: '📄 ID do Caso de Moderação', value: `\`${caseId}\`` }
                )
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Ação de moderação por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error("Erro ao silenciar membro:", error);
            message.reply('Não foi possível silenciar o membro. Verifique minhas permissões (Moderate Members) e a hierarquia de cargos.');
        }
    }
};