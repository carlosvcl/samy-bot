// src/commands/dev/dashboard.js
const { EmbedBuilder, version: djsVersion, PermissionsBitField } = require('discord.js');
const mongoose = require('mongoose');
const os = require('os');
const prettyMs = require('pretty-ms').default;
const packageJson = require('../../../package.json'); 

module.exports = {
    name: 'dashboard',
    aliases: ['botstats', 'devinfo', 'statusdev'],
    description: 'Mostra um painel com estatísticas e informações de desenvolvimento do bot.',
    category: 'dev',
    devOnly: true, // <--- ADICIONADO PARA MARCAR COMO COMANDO DE DESENVOLVEDOR
    // args: false, 
    // usage: '',
    // cooldown: 5, 
    // permissionsUser: [], 
    // permissionsBot: [PermissionsBitField.Flags.EmbedLinks], 
    async execute({ client, message, args }) {
        // Restrição para Desenvolvedores
        const ownerIds = (process.env.OWNER_IDS || "").split(',').map(id => id.trim());
        if (!ownerIds.includes(message.author.id)) {
            // Para acesso direto, podemos não responder nada ou uma mensagem genérica
            // já que o help não vai mostrar para usuários normais.
            // Se preferir uma resposta, pode ser algo como:
            // return message.reply({ content: "Comando desconhecido.", ephemeral: false }); 
            return; // Ou simplesmente não fazer nada se tentarem acesso direto e não forem donos
        }

        // Coletando Informações
        const uptime = prettyMs(client.uptime, { verbose: true, secondsDecimalDigits: 0 });
        const guildsCount = client.guilds.cache.size;
        const usersCount = client.users.cache.size; 
        const channelsCount = client.channels.cache.size;
        const commandsCount = client.commands.filter(cmd => cmd.name).map(cmd => cmd.name).length; 
        
        const memoryUsage = process.memoryUsage();
        const ramUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const ramTotalProcess = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const ramRss = (memoryUsage.rss / 1024 / 1024).toFixed(2); 
        const osTotalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2); 
        const osFreeRam = (os.freemem() / 1024 / 1024 / 1024).toFixed(2); 

        const pingAPI = Math.round(client.ws.ping);

        let dbStatus = 'Desconhecido';
        const dbState = mongoose.connection.readyState;
        if (dbState === 0) dbStatus = '🔴 Desconectado';
        if (dbState === 1) dbStatus = '🟢 Conectado';
        if (dbState === 2) dbStatus = '🟡 Conectando';
        if (dbState === 3) dbStatus = '🟠 Desconectando';

        let userDocs = 'N/A';
        let itemDocs = 'N/A';
        let modLogDocs = 'N/A';
        try {
            if (client.models.User) userDocs = (await client.models.User.countDocuments()).toLocaleString();
            if (client.models.Item) itemDocs = (await client.models.Item.countDocuments()).toLocaleString();
            // Verifique se você tem o model ModerationLog carregado em client.models
            if (client.models.ModerationLog) modLogDocs = (await client.models.ModerationLog.countDocuments()).toLocaleString();
            else modLogDocs = 'Modelo não carregado';
        } catch (dbError) {
            console.error("Erro ao contar documentos para o dashboard:", dbError);
            userDocs = itemDocs = modLogDocs = 'Erro ao buscar';
        }
        
        const botVersion = packageJson.version || "N/A";
        const cpuInfo = os.cpus()[0]; 

        const embed = new EmbedBuilder()
            .setColor('#FF69B4') 
            .setTitle(`🛠️ Painel de Desenvolvedor - ${client.user.username}`)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🤖 Informações do Bot', value: `**Versão:** v${botVersion}\n**Discord.js:** v${djsVersion}\n**Node.js:** ${process.version}\n**ID:** \`${client.user.id}\``, inline: false },
                { name: '🕒 Uptime', value: uptime, inline: false },
                { name: '💻 Host/Sistema', value: `**Plataforma:** ${os.platform()} (${os.arch()})\n**CPU:** ${cpuInfo.model.split('@')[0].trim()} (${os.cpus().length} Cores)\n**RAM Total (OS):** ${osTotalRam} GB\n**RAM Livre (OS):** ${osFreeRam} GB`, inline: false },
                { name: '💾 Memória do Processo', value: `**Heap Usada:** ${ramUsed} MB / ${ramTotalProcess} MB\n**RSS:** ${ramRss} MB`, inline: false },
                
                { name: '🌐 Estatísticas Discord', value: `**Servidores:** ${guildsCount.toLocaleString()}\n**Usuários (Cache):** ${usersCount.toLocaleString()}\n**Canais (Cache):** ${channelsCount.toLocaleString()}\n**Comandos Carregados:** ${commandsCount}`, inline: false },
                { name: '🛰️ Latência da API', value: `${pingAPI}ms`, inline: true },

                { name: '🗄️ Banco de Dados (MongoDB)', value: `**Status:** ${dbStatus}\n**Perfis de Usuário:** ${userDocs}\n**Itens Definidos:** ${itemDocs}\n**Logs de Moderação:** ${modLogDocs}`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Painel acessado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        await message.channel.send({ embeds: [embed] });
    }
};