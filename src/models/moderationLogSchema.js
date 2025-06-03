// src/models/moderationLogSchema.js
const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema({
    caseId: { type: String, required: true, unique: true }, // Gerado sequencialmente ou UUID por servidor
    guildId: { type: String, required: true },
    userId: { type: String, required: true }, // ID do usuário que sofreu a ação
    moderatorId: { type: String, required: true }, // ID do moderador
    actionType: {
        type: String,
        required: true,
        enum: ['ban', 'unban', 'kick', 'mute', 'unmute', 'warn', 'clear']
    },
    reason: { type: String, default: 'Nenhuma razão fornecida.' },
    duration: { type: String }, // Ex: "7d", "24h", "permanente" (para mutes, bans temporários)
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('ModerationLog', moderationLogSchema);