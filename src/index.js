// src/index.js
require('dotenv').config();

const { Client, Events, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const connectDB = require('./database/mongoose');
const fs = require('node:fs');
const path = require('node:path');

// --- Importar e configurar Gemini ---
let geminiTextModelGlobal;

if (process.env.GEMINI_API_KEY) {
    try {
        const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        geminiTextModelGlobal = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ]
        });
        console.log("✨ Modelo Gemini (texto) inicializado com sucesso!");
    } catch (error) {
        console.error("❌ Falha ao inicializar o modelo Gemini:", error.message);
        geminiTextModelGlobal = null;
    }
} else {
    console.warn("⚠️  Chave da API Gemini (GEMINI_API_KEY) não encontrada no .env. Comandos de IA não funcionarão.");
    geminiTextModelGlobal = null;
}
// --- FIM: Importar e configurar Gemini ---


// Inicialização do Cliente Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates // <<< ADICIONE ESTA LINHA AQUI
    ]
});

// Adicionar propriedades ao client
client.commands = new Collection(); // Para Slash Commands
client.prefixCommands = new Collection(); // Para Comandos de Prefixo
client.models = {};
client.geminiTextModel = geminiTextModelGlobal;
client.chatSessions = new Map();
client.commandCooldowns = new Map(); // Para cooldowns (usado tanto em prefixo quanto slash)

// Conectar ao MongoDB
connectDB();

// Carregar Modelos do Mongoose
const modelsPath = path.join(__dirname, 'models');
if (fs.existsSync(modelsPath)) {
    const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith('.js'));
    for (const file of modelFiles) {
        const filePath = path.join(modelsPath, file);
        try {
            const model = require(filePath);
            const modelName = model.modelName || path.basename(file, '.js').replace(/Schema$/, '');
            client.models[modelName] = model;
            console.log(`📚 Modelo Mongoose carregado: ${modelName}`);
        } catch (error) {
            console.error(`❌ Erro ao carregar modelo ${file}:`, error);
        }
    }
} else {
    console.warn("⚠️  Pasta de modelos não encontrada em: ", modelsPath);
}


// --- Carregar Slash Commands (da pasta src/slashCommands) ---
const slashCommandsPath = path.join(__dirname, 'slashCommands');
if (fs.existsSync(slashCommandsPath)) {
    const slashCommandFolders = fs.readdirSync(slashCommandsPath);

    for (const folder of slashCommandFolders) {
        const commandsPathInsideFolder = path.join(slashCommandsPath, folder);
        if (fs.statSync(commandsPathInsideFolder).isDirectory()) { // Verifica se é um diretório
            const slashCommandFiles = fs.readdirSync(commandsPathInsideFolder).filter(file => file.endsWith('.js'));
            for (const file of slashCommandFiles) {
                const filePath = path.join(commandsPathInsideFolder, file);
                try {
                    const command = require(filePath);
                    if ('data' in command && 'execute' in command) {
                        client.commands.set(command.data.name, command);
                        console.log(`🚀 Comando Slash carregado: /${command.data.name} de ${folder}/${file}`);
                    } else {
                        console.log(`[AVISO] O comando slash em ${filePath} está faltando a propriedade "data" ou "execute".`);
                    }
                } catch (error) {
                    console.error(`❌ Erro ao carregar comando slash ${folder}/${file}:`, error);
                }
            }
        }
    }
} else {
    console.warn("⚠️  Pasta de slash commands ('src/slashCommands') não encontrada. Nenhum slash command será carregado.");
}
// --- FIM: Carregar Slash Commands ---


// Carregar Handlers (Comandos de Prefixo e Eventos)
try {
    const commandHandlerPath = path.join(__dirname, 'handlers', 'commandHandler.js');
    if (fs.existsSync(commandHandlerPath)) {
        require(commandHandlerPath)(client); // Passando apenas o client, o handler usará seus próprios fs e path
        console.log('🔧 Command Handler (prefixo) invocado.');
    } else {
        console.error('❌ commandHandler.js não encontrado em src/handlers/');
    }

    const eventHandlerPath = path.join(__dirname, 'handlers', 'eventHandler.js');
    if (fs.existsSync(eventHandlerPath)) {
        require(eventHandlerPath)(client); // Passando apenas o client
        console.log('🔧 Event Handler invocado.');
    } else {
        console.error('❌ eventHandler.js não encontrado em src/handlers/');
    }
} catch (error) {
    console.error('❌ Erro ao invocar handlers:', error);
}


// Evento ClientReady
client.once(Events.ClientReady, readyClient => {
    console.log(`✅ Logado como ${readyClient.user.tag}!`);
    const prefix = process.env.PREFIX || "s!";
    const guildCount = readyClient.guilds.cache.size;
    const activityName = `em ${guildCount} servidor${guildCount === 1 ? '' : 'es'} com ${prefix}help`;

    readyClient.user.setPresence({
        activities: [{
            name: activityName,
            type: ActivityType.Playing
        }],
        status: 'online',
    });
    console.log(`🎮 Status definido para: Jogando ${activityName}`);
});


// --- Listener para Interações de Slash Command ---
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`Nenhum comando slash correspondente a ${interaction.commandName} foi encontrado.`);
        try {
            await interaction.reply({ content: '⚠️ Comando slash não encontrado!', ephemeral: true });
        } catch (err) {
            console.error("Erro ao responder sobre comando slash não encontrado:", err);
        }
        return;
    }

    // Lógica de Cooldown para Slash Commands
    const { commandCooldowns } = client; // client.commandCooldowns já inicializado
    if (!commandCooldowns.has(command.data.name)) {
        commandCooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = commandCooldowns.get(command.data.name);
    const defaultCooldownDuration = 3; 
    const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

    if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
        if (now < expirationTime) {
            const expiredTimestamp = Math.round(expirationTime / 1000);
            try {
                return interaction.reply({
                    content: `Por favor, espere \`${((expirationTime - now) / 1000).toFixed(1)}\` segundo(s) antes de reusar o comando \`/${command.data.name}\`. Você poderá usá-lo novamente em <t:${expiredTimestamp}:R>.`,
                    ephemeral: true
                });
            } catch (err) {
                 console.error("Erro ao responder sobre cooldown (slash):", err);
            }
            return;
        }
    }
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    // Fim Cooldown

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(`Erro ao executar o comando slash /${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
            try {
                await interaction.followUp({ content: '❌ Ocorreu um erro ao executar este comando slash!', ephemeral: true });
            } catch (err) {
                console.error("Erro ao usar followUp para erro de execução (slash):", err);
            }
        } else {
            try {
                await interaction.reply({ content: '❌ Ocorreu um erro ao executar este comando slash!', ephemeral: true });
            } catch (err) {
                console.error("Erro ao usar reply para erro de execução (slash):", err);
            }
        }
    }
});
// --- FIM: Listener para Interações de Slash Command ---

// Login do Bot
client.login(process.env.DISCORD_TOKEN);