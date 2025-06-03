// src/models/itemSchema.js
const mongoose = require('mongoose');

const requiredItemSchema = new mongoose.Schema({
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

// Sub-schema para efeitos passivos dos itens
const itemEffectSchema = new mongoose.Schema({
    passiveIncome: { type: Number, default: 0 },
    passiveIncomeIntervalHours: { type: Number, default: 24 },
    energyBoostMax: { type: Number, default: 0 },
    xpGainModifier: { type: Number, default: 1.0 },
    commandCooldownModifiers: [{ 
        _id: false,
        commandName: { type: String, required: true },
        modifier: { type: Number, required: true, min: 0.1, max: 1.0 } 
    }],
    commandRewardModifiers: [{
        _id: false,
        commandName: { type: String, required: true },
        rewardType: { type: String, enum: ['money', 'xp', 'item_drop_chance'], required: true },
        modifier: { type: Number, required: true }
    }],
    passiveResourceGeneration: [{
        _id: false,
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
        quantity: { type: Number, required: true, min: 1 },
        intervalHours: { type: Number, required: true, min: 1 }
    }],
    lootTableId: { type: String, default: null }
}, { _id: false });

// Sub-schema para efeitos de uso de itens consumíveis
const itemUseEffectSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'heal_energy', 
            'grant_xp', 
            'grant_money', 
            // 'open_box', // Linha original que causava o problema
            'open_lootbox', // CORRIGIDO: Para corresponder ao seedItems.js
            'activate_luck_boost',
            'activate_energy_saver_boost',
            'activate_xp_boost',
            'enter_lottery',
            'change_profile_display_name'
        ]
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    durationMinutes: { type: Number, default: 0 },
    uses: { type: Number, default: 0 },
    commandScope: [{ type: String }],
    message: { type: String, default: "Você usou o item!" }
}, { _id: false });

// Sub-schema para receitas de evolução
const evolutionRecipeSchema = new mongoose.Schema({
    evolvesToItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    requiredLevel: { type: Number, default: 0 },
    requiredCurrency: { type: Number, default: 0 },
    requiredEnergy: { type: Number, default: 0 },
    requiredItems: [requiredItemSchema]
}, { _id: false });

// Schema principal do Item
const itemSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
        type: String,
        required: true,
        enum: ['tool', 'resource', 'collectible', 'consumable', 'generator', 'evolutionMaterial', 'decoration', 'special', 'lootbox', 'key']
    },
    rarity: {
        type: String,
        required: true,
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique', 'event'],
        default: 'common'
    },
    buyPrice: { type: Number, default: 0, min: 0 },
    sellPrice: { type: Number, default: 0, min: 0 },
    isObtainable: { type: Boolean, default: true },
    imageUrl: { type: String, default: null, trim: true },

    effects: itemEffectSchema, 
    
    usable: { type: Boolean, default: false },
    useEffects: itemUseEffectSchema, // Contém o enum corrigido

    evolutionRecipe: evolutionRecipeSchema,
    
    stackable: { type: Boolean, default: true },
    maxStack: { type: Number, default: 99, min: 1 },
    tags: [{ type: String, trim: true, lowercase: true }]

}, { timestamps: true });

itemSchema.index({ name: 'text', category: 1, rarity: 1 });

module.exports = mongoose.model('Item', itemSchema);