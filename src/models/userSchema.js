// src/models/userSchema.js
const mongoose = require('mongoose');

const activeBoostSchema = new mongoose.Schema({
    boostType: { 
        type: String, 
        required: true, 
        enum: ['luck', 'energy_saver', 'xp_multiplier', 'reward_multiplier'] // Tipos de boost
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true }, // Multiplicador, redutor de custo, etc.
    expiresAt: { type: Date, required: true },
    usesLeft: { type: Number, default: 0, min: 0 }, 
    commandScope: [{ type: String }] 
}, { _id: true, timestamps: { createdAt: 'activatedAt' } }); // _id: true para poder remover boosts específicos

const inventoryItemSchema = new mongoose.Schema({
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 }
}, { _id: false });

const activeInvestmentSchema = new mongoose.Schema({
    investmentId: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId(), unique: true },
    principal: { type: Number, required: true },
    startTime: { type: Date, default: Date.now },
    durationMinutes: { type: Number, required: true },
    returnRatePercent: { type: Number, required: true }
}, { _id: false });

const userSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    balance: { type: Number, default: 100, min: 0 }, // Saldo inicial de 100
    bank: { type: Number, default: 0, min: 0 },
    energy: {
        current: { type: Number, default: 100 },
        max: { type: Number, default: 100 },
        lastRegenTimestamp: { type: Date, default: Date.now }
    },
    inventory: [inventoryItemSchema],
    dailyLastClaimed: { type: Date, default: null },
    workLastClaimed: { type: Date, default: null },
    mineLastClaimed: { type: Date, default: null },
    commandCooldowns: { type: Map, of: Date, default: {} },
    
    // MODIFICADO DE VOLTA PARA MAP para suportar múltiplos geradores
    lastCollectedTimestamps: { type: Map, of: Date, default: () => new Map() }, // Chave: ID do Item Gerador ou tipo de renda, Valor: Data
    
    activeInvestments: [activeInvestmentSchema],
    lastMessageXpTimestamp: { type: Date, default: null },
    
    customBotDisplayName: { type: String, default: null, trim: true, maxlength: 32 },
    activeBoosts: [activeBoostSchema],

    stats: {
        messagesSent: { type: Number, default: 0 },
        commandsUsed: { type: Number, default: 0 },
        totalMoneyEarned: { type: Number, default: 0 },
        totalXpEarned: { type: Number, default: 0 },
    },
    preferences: {
        dmNotifications: { type: Boolean, default: true }
    }
}, { timestamps: true });

userSchema.statics.findOrCreate = async function(discordId, username, defaults = {}) {
    let user = await this.findOne({ discordId });
    if (!user) {
        const initialValues = {
            discordId,
            username,
            balance: defaults.balance === undefined ? 100 : defaults.balance,
            level: defaults.level === undefined ? 1 : defaults.level,
            // lastCollectedTimestamps será um Map vazio por padrão
            ...defaults
        };
        user = new this(initialValues);
        await user.save();
    } else if (user.username !== username) {
        user.username = username;
        await user.save();
    }
    // Garante que lastCollectedTimestamps seja um Map se estiver ausente por algum motivo (migração, etc.)
    if (!(user.lastCollectedTimestamps instanceof Map)) {
        user.lastCollectedTimestamps = new Map();
    }
    return user;
};

userSchema.methods.clearExpiredBoosts = function() {
    const now = new Date();
    this.activeBoosts = this.activeBoosts.filter(boost => {
        const hasUses = boost.usesLeft === 0 || boost.usesLeft > 0;
        return boost.expiresAt > now && hasUses;
    });
    // O 'save' deve ser chamado pelo comando após esta modificação se necessário.
};

userSchema.methods.getActiveBoost = function(boostType, commandName = null) {
    this.clearExpiredBoosts();
    return this.activeBoosts.find(boost =>
        boost.boostType === boostType &&
        (!commandName || !boost.commandScope || boost.commandScope.length === 0 || boost.commandScope.includes(commandName))
    );
};

userSchema.methods.decrementBoostUse = function(boostId) {
    const boostIndex = this.activeBoosts.findIndex(b => b._id.equals(boostId) && b.usesLeft > 0);
    if (boostIndex > -1) {
        this.activeBoosts[boostIndex].usesLeft--;
        // Opcional: remover imediatamente se usesLeft === 0, ou deixar clearExpiredBoosts lidar
        if (this.activeBoosts[boostIndex].usesLeft === 0) {
            // Para remover imediatamente: this.activeBoosts.splice(boostIndex, 1);
            // Mas é mais seguro deixar clearExpiredBoosts tratar para evitar problemas com o save
        }
        return true; // Indicar que um uso foi decrementado
    }
    return false; // Nenhum uso decrementado
    // O 'save' deve ser chamado pelo comando.
};

module.exports = mongoose.model('User', userSchema);