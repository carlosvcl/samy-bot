// src/utils/modLogHelper.js (ou diretamente nos comandos)
const { EmbedBuilder } = require('discord.js');

async function logModerationAction(client, guild, actionType, moderator, targetUser, reason, duration = null, caseId = null) {
    const ModerationLog = client.models.ModerationLog;
    
    if (!caseId) { // Gerar um caseId se não fornecido
        const lastCase = await ModerationLog.findOne({ guildId: guild.id }).sort({ timestamp: -1 });
        caseId = lastCase ? parseInt(lastCase.caseId.split('-')[1]) + 1 : 1;
        caseId = `${guild.id.slice(-4)}-${caseId.toString().padStart(4, '0')}`;
    }

    const logEntry = new ModerationLog({
        caseId,
        guildId: guild.id,
        userId: targetUser.id,
        moderatorId: moderator.id,
        actionType,
        reason,
        duration, // Será null para kick, warn, unban, unmute (instantâneo)
        timestamp: new Date()
    });
    await logEntry.save();

    // Opcional: Enviar log para um canal específico do servidor
    // const logChannelId = guildSettings.modLogChannel; // Supondo que você tenha configurações do servidor
    // if (logChannelId) {
    //     const logChannel = guild.channels.cache.get(logChannelId);
    //     if (logChannel && logChannel.isTextBased()) {
    //         const logEmbed = new EmbedBuilder()
    //             .setColor(/* cor baseada na ação */)
    //             .setTitle(`Ação de Moderação: ${actionType.toUpperCase()} | Caso #${caseId}`)
    //             // ... adicionar campos ...
    //         logChannel.send({ embeds: [logEmbed] });
    //     }
    // }
    return caseId;
}
module.exports = { logModerationAction };