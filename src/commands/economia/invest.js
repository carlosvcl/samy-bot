// src/commands/economia/invest.js
const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const ms = require('ms'); // Para formatar a duração

// Configurações de investimento (poderiam vir de um config ou .env)
const MIN_INVESTMENT = 1000;
const MAX_INVESTMENT = 100000;
const INVESTMENT_DURATION_MINUTES = 60 * 24; // 24 horas
const INVESTMENT_RETURN_RATE_PERCENT = 5; // 5% de retorno

module.exports = {
    name: 'invest',
    description: `Investe suas moedas por ${INVESTMENT_DURATION_MINUTES / 60} horas para um retorno de ${INVESTMENT_RETURN_RATE_PERCENT}%.`,
    aliases: ['investir', 'aplicar'], // Adicionando aliases
    category: 'economia', // Categoria definida
    args: true,
    usage: '<quantia>',
    // cooldown: 60, // Exemplo: cooldown de 1 minuto para o comando em si, se necessário
    async execute({ client, message, args }) {
        const User = client.models.User;
        const amountToInvest = parseInt(args[0]);

        if (isNaN(amountToInvest) || amountToInvest < MIN_INVESTMENT || amountToInvest > MAX_INVESTMENT) {
            const embedError = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('⚠️ Quantia de Investimento Inválida')
                .setDescription(`Você deve investir uma quantia entre **${MIN_INVESTMENT.toLocaleString()}** e **${MAX_INVESTMENT.toLocaleString()}** moedas.`)
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [embedError] });
        }

        const userProfile = await User.findOrCreate(message.author.id, message.author.tag);

        if (userProfile.balance < amountToInvest) {
             const embedNoFunds = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('⚠️ Saldo Insuficiente para Investir')
                .setDescription(`${message.author.toString()}, você não tem **${amountToInvest.toLocaleString()}** moedas para investir.`)
                .addFields({ name: 'Seu Saldo Atual', value: `🪙 ${userProfile.balance.toLocaleString()}`})
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [embedNoFunds] });
        }

        // Limitar o número de investimentos ativos por usuário (opcional)
        // const MAX_ACTIVE_INVESTMENTS = 3;
        // if (userProfile.activeInvestments.length >= MAX_ACTIVE_INVESTMENTS) {
        //     return message.reply(`Você já atingiu o limite de ${MAX_ACTIVE_INVESTMENTS} investimentos ativos.`);
        // }

        userProfile.balance -= amountToInvest;
        const newInvestment = {
            investmentId: new mongoose.Types.ObjectId(),
            principal: amountToInvest,
            startTime: new Date(),
            durationMinutes: INVESTMENT_DURATION_MINUTES,
            returnRatePercent: INVESTMENT_RETURN_RATE_PERCENT
        };
        userProfile.activeInvestments.push(newInvestment);
        
        try {
            await userProfile.save();

            const maturityTimestamp = Math.floor((newInvestment.startTime.getTime() + (newInvestment.durationMinutes * 60 * 1000)) / 1000);
            const expectedReturn = Math.floor(amountToInvest * (1 + newInvestment.returnRatePercent / 100));

            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('📈 Investimento Realizado com Sucesso!')
                .setDescription(`${message.author.toString()}, seu investimento de **${amountToInvest.toLocaleString()} moedas** foi registrado.`)
                .addFields(
                    { name: '💰 Valor Investido', value: `🪙 ${amountToInvest.toLocaleString()}`, inline: true },
                    { name: '📈 Taxa de Retorno', value: `${newInvestment.returnRatePercent}%`, inline: true },
                    { name: '💸 Retorno Estimado', value: `🪙 ${expectedReturn.toLocaleString()}`, inline: true },
                    { name: '⏰ Duração', value: ms(newInvestment.durationMinutes * 60 * 1000, { long: true }), inline: false },
                    { name: '🗓️ Coletável em', value: `<t:${maturityTimestamp}:F> (<t:${maturityTimestamp}:R>)`, inline: false },
                    { name: '🆔 ID do Investimento', value: `\`${newInvestment.investmentId}\` (use \`${process.env.PREFIX}collectinvestment ${newInvestment.investmentId}\` para coletar)` }
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error("Erro ao salvar investimento:", error);
            // Reverter o balance se o save falhar (importante)
            userProfile.balance += amountToInvest; 
            // Não salvar aqui, apenas logar o erro ou notificar o usuário
            message.reply("Ocorreu um erro ao processar seu investimento. Nenhuma moeda foi deduzida. Tente novamente.");
        }
    }
};