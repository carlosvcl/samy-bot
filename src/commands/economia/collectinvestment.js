// src/commands/economia/collectinvestment.js
const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const ms = require('ms'); // <--- ADICIONADO: Importação do pacote ms

module.exports = {
    name: 'collectinvestment',
    aliases: ['collectinv', 'resgatarinv'],
    description: 'Coleta seus investimentos maduros ou um específico por ID.',
    usage: '[ID do investimento]',
    category: 'economia',
    async execute({ client, message, args }) {
        const User = client.models.User;
        const investmentIdToCollect = args[0]; // ID específico do investimento (opcional)

        let userProfile;
        let collectedCount = 0;
        let totalReturnValue = 0; // Valor total retornado (principal + lucro)
        let totalProfitCollected = 0;
        let totalPrincipalCollected = 0;
        const collectedDetails = []; // Detalhes dos investimentos coletados

        try {
            userProfile = await User.findOrCreate(message.author.id, message.author.tag);
            if (!userProfile || !userProfile.activeInvestments || userProfile.activeInvestments.length === 0) {
                return message.reply('Você não tem nenhum investimento ativo para coletar.');
            }

            const now = new Date();
            let investmentsToKeep = []; // Array para os investimentos que não serão coletados

            if (investmentIdToCollect) {
                // --- Lógica para coletar um investimento específico por ID ---
                const targetInvestment = userProfile.activeInvestments.find(
                    inv => inv.investmentId.toString() === investmentIdToCollect || inv.investmentId.toString().slice(-6) === investmentIdToCollect // Permite ID completo ou últimos 6 dígitos
                );

                if (!targetInvestment) {
                    return message.reply(`Nenhum investimento ativo encontrado com o ID fornecido (\`${investmentIdToCollect}\`).`);
                }

                const investmentEndTime = new Date(targetInvestment.startTime.getTime() + targetInvestment.durationMinutes * 60000);

                if (now >= investmentEndTime) { // Investimento maduro
                    const profit = targetInvestment.principal * (targetInvestment.returnRatePercent / 100);
                    const currentReturn = targetInvestment.principal + profit;
                    
                    userProfile.balance += currentReturn;
                    totalReturnValue += currentReturn;
                    totalPrincipalCollected += targetInvestment.principal;
                    totalProfitCollected += profit;
                    collectedCount = 1;
                    collectedDetails.push(`- ID \`...${targetInvestment.investmentId.toString().slice(-6)}\`: 🪙 +${currentReturn.toLocaleString('pt-BR')} (Lucro: ${profit.toLocaleString('pt-BR')})`);

                    // Remove o investimento coletado da lista de ativos
                    investmentsToKeep = userProfile.activeInvestments.filter(
                        inv => inv.investmentId.toString() !== targetInvestment.investmentId.toString()
                    );
                } else { // Investimento específico não está maduro
                    const timeLeft = ms(investmentEndTime.getTime() - now.getTime(), { long: true });
                    return message.reply(`O investimento com ID \`...${targetInvestment.investmentId.toString().slice(-6)}\` (Principal: 🪙 ${targetInvestment.principal.toLocaleString('pt-BR')}) ainda não está pronto. Tempo restante: **${timeLeft}**.`);
                }
            } else {
                // --- Lógica para coletar TODOS os investimentos maduros ---
                userProfile.activeInvestments.forEach(investment => {
                    const investmentEndTime = new Date(investment.startTime.getTime() + investment.durationMinutes * 60000);
                    if (now >= investmentEndTime) { // Investimento maduro
                        const profit = investment.principal * (investment.returnRatePercent / 100);
                        const currentReturn = investment.principal + profit;

                        userProfile.balance += currentReturn;
                        totalReturnValue += currentReturn;
                        totalPrincipalCollected += investment.principal;
                        totalProfitCollected += profit;
                        collectedCount++;
                        collectedDetails.push(`- ID \`...${investment.investmentId.toString().slice(-6)}\`: 🪙 +${currentReturn.toLocaleString('pt-BR')} (Lucro: ${profit.toLocaleString('pt-BR')})`);
                    } else {
                        investmentsToKeep.push(investment); // Mantém os não maduros
                    }
                });
            }

            // Se nenhum investimento foi coletado (seja geral ou um ID específico que não estava pronto/não existia)
            if (collectedCount === 0) {
                if (investmentIdToCollect) {
                    // Se um ID foi fornecido, a mensagem de "não encontrado" ou "não maduro" já foi enviada.
                    // Este return aqui é um fallback, mas idealmente não seria atingido se a lógica acima estiver correta.
                    return message.reply(`O investimento com ID \`${investmentIdToCollect}\` não estava pronto para coleta ou não foi encontrado.`);
                }
                return message.reply('Você não tem nenhum investimento maduro para coletar no momento.');
            }

            userProfile.activeInvestments = investmentsToKeep;
            await userProfile.save();

            const embed = new EmbedBuilder()
                .setColor('#00FF00') // Verde para sucesso
                .setTitle('🏦 Investimentos Coletados!')
                .setDescription(`${message.author.toString()}, você resgatou **${collectedCount} investimento(s)**!`)
                .addFields(
                    { name: '💰 Total Retornado (Principal + Lucro)', value: `🪙 ${totalReturnValue.toLocaleString('pt-BR')}`, inline: true },
                    { name: '📈 Lucro Total Obtido', value: `🪙 ${totalProfitCollected.toLocaleString('pt-BR')}`, inline: true },
                    { name: '💸 Principal Coletado', value: `🪙 ${totalPrincipalCollected.toLocaleString('pt-BR')}`, inline: true },
                    { name: '💳 Saldo Atualizado', value: `🪙 ${userProfile.balance.toLocaleString('pt-BR')}` }
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            
            if (collectedDetails.length > 0) {
                embed.addFields({ name: "📝 Detalhes da Coleta", value: collectedDetails.join('\n').substring(0,1020) });
            }

            message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error("Erro ao coletar investimentos:", error);
            message.reply("Ocorreu um erro ao tentar coletar seus investimentos. Tente novamente mais tarde.");
        }
    }
};